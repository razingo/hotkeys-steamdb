'use strict';

( async() =>
{
	const list = document.getElementById( 'shortcuts' );
	const template = /** @type {HTMLTemplateElement} */ ( document.getElementById( 'shortcut-row' ) );
	const storeInBackground = /** @type {HTMLInputElement} */ ( document.getElementById( 'store-in-background' ) );
	const steamStorePages = /** @type {HTMLInputElement} */ ( document.getElementById( 'steam-store-pages' ) );
	const syncSettings = /** @type {HTMLInputElement} */ ( document.getElementById( 'sync-settings' ) );
	const resetButton = document.getElementById( 'reset' );
	const status = document.getElementById( 'status' );

	let settings = await LoadSettings();
	syncSettings.checked = await IsSyncEnabled();

	/** @type {string|null} id of the action currently waiting for a key */
	let recording = null;

	/** @type {Record<string, {key: HTMLButtonElement, clear: HTMLButtonElement, error: HTMLElement, warning: HTMLElement}>} */
	const rows = {};

	let statusTimer = 0;

	// Recording Space or Enter on a focused button would otherwise "click" it again and restart recording
	let lastRecordedAt = 0;

	const ShowStatus = ( text ) =>
	{
		status.textContent = text;
		clearTimeout( statusTimer );
		statusTimer = setTimeout( () => status.textContent = '', 2000 );
	};

	const Save = async() =>
	{
		try
		{
			await SaveSettings( settings );
			ShowStatus( 'Saved' );
		}
		catch( error )
		{
			ShowStatus( `Could not save: ${error.message}` );
		}
	};

	const ShowError = ( id, text ) =>
	{
		const { error } = rows[ id ];
		error.textContent = text;
		error.hidden = !text;
	};

	const Render = () =>
	{
		for( const { id, name } of SHORTCUT_ACTIONS )
		{
			const { key, clear } = rows[ id ];
			const shortcut = settings.shortcuts[ id ];
			const isRecording = recording === id;

			key.classList.toggle( 'recording', isRecording );
			key.classList.toggle( 'off', !isRecording && !shortcut );

			if( isRecording )
			{
				key.textContent = 'Press a key…';
				key.setAttribute( 'aria-label', `${name}: press the new shortcut, or Escape to cancel` );
			}
			else
			{
				key.textContent = shortcut ? FormatShortcut( shortcut ) : 'Off';
				key.setAttribute( 'aria-label', `${name} shortcut: ${shortcut ? FormatShortcut( shortcut ) : 'off'}. Click to change` );
			}

			clear.disabled = !shortcut || isRecording;

			// A shortcut the browser also uses works, but replaces the browser's action while it's active
			const { warning } = rows[ id ];
			const clash = isRecording ? null : BrowserShortcutFor( shortcut );
			warning.textContent = clash ? `${FormatShortcut( shortcut )} is also the browser's shortcut to ${clash.does}. On SteamDB popups and the Steam store, it will do ${name} instead.` : '';
			warning.hidden = !clash;
		}

		storeInBackground.checked = settings.storeInBackground;
		steamStorePages.checked = settings.steamStorePages;
	};

	const StopRecording = () =>
	{
		recording = null;
		Render();
	};

	for( const action of SHORTCUT_ACTIONS )
	{
		const row = /** @type {DocumentFragment} */ ( template.content.cloneNode( true ) );
		const key = row.querySelector( '.key' );
		const clear = row.querySelector( '.clear' );
		const error = row.querySelector( '.row-error' );
		const warning = row.querySelector( '.row-warning' );
		const description = row.querySelector( '.row-description' );

		row.querySelector( '.row-name' ).textContent = action.name;
		description.textContent = action.description;
		description.id = `desc-${action.id}`;
		key.setAttribute( 'aria-describedby', description.id );
		clear.setAttribute( 'aria-label', `Turn off ${action.name} shortcut` );

		key.addEventListener( 'click', ( e ) =>
		{
			// detail is 0 for clicks synthesized by the keyboard, real mouse clicks always go through
			if( e.detail === 0 && Date.now() - lastRecordedAt < 500 )
			{
				return;
			}

			ShowError( action.id, '' );
			recording = recording === action.id ? null : action.id;
			Render();
		} );

		// Clicking or tabbing away cancels recording
		key.addEventListener( 'blur', () =>
		{
			if( recording === action.id )
			{
				StopRecording();
			}
		} );

		clear.addEventListener( 'click', () =>
		{
			settings.shortcuts[ action.id ] = null;
			ShowError( action.id, '' );
			Render();
			Save();
		} );

		rows[ action.id ] = { key, clear, error, warning };
		list.append( row );
	}

	document.addEventListener( 'keydown', ( e ) =>
	{
		if( !recording )
		{
			return;
		}

		const id = recording;
		lastRecordedAt = Date.now();

		e.preventDefault();
		e.stopPropagation();

		const noModifiers = !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey;

		if( e.key === 'Escape' && noModifiers )
		{
			StopRecording();
			return;
		}

		if( ( e.key === 'Backspace' || e.key === 'Delete' ) && noModifiers )
		{
			settings.shortcuts[ id ] = null;
			StopRecording();
			Save();
			return;
		}

		const shortcut = ShortcutFromEvent( e );

		if( !shortcut )
		{
			// Only modifiers so far, show them while waiting for the actual key
			rows[ id ].key.textContent = `${ModifierNames( {
				ctrl: e.ctrlKey,
				alt: e.altKey,
				shift: e.shiftKey,
				meta: e.metaKey,
			} ).join( ' + ' )} + …`;
			return;
		}

		// Shift + Tab moves back the other way, so it's just as needed as Tab itself
		if( e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey )
		{
			ShowError( id, `${e.shiftKey ? 'Shift + Tab is' : 'Tab is'} needed to move around pages, pick another key.` );
			StopRecording();
			return;
		}

		// Some keys (on-screen keyboards, a few media keys) have no key code. Saved like that, the shortcut
		// would be thrown away as broken next time the settings load, and quietly turn back into the default.
		if( !shortcut.code )
		{
			ShowError( id, 'This key can\'t be used for a shortcut, pick another one.' );
			StopRecording();
			return;
		}

		const browserShortcut = BrowserShortcutFor( shortcut );

		if( browserShortcut?.reserved )
		{
			ShowError( id, `${FormatShortcut( shortcut )} is the browser's shortcut to ${browserShortcut.does}, and browsers don't let extensions use it. Pick another key.` );
			StopRecording();
			return;
		}

		const clash = SHORTCUT_ACTIONS.find( ( other ) => other.id !== id && SameShortcut( settings.shortcuts[ other.id ], shortcut ) );

		if( clash )
		{
			ShowError( id, `${FormatShortcut( shortcut )} is already used by ${clash.name}.` );
			StopRecording();
			return;
		}

		settings.shortcuts[ id ] = shortcut;
		StopRecording();
		Save();
	}, true );

	document.addEventListener( 'keyup', ( e ) =>
	{
		// Releasing a modifier without pressing a key: go back to the prompt
		if( recording && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey )
		{
			Render();
		}
	} );

	storeInBackground.addEventListener( 'change', () =>
	{
		settings.storeInBackground = storeInBackground.checked;
		Save();
	} );

	steamStorePages.addEventListener( 'change', () =>
	{
		settings.steamStorePages = steamStorePages.checked;
		Save();
	} );

	const syncChoice = document.getElementById( 'sync-choice' );

	/** Turns sync on or off; keep says which settings win if the synced ones differ from this browser's */
	const ChangeSync = async( enabled, keep ) =>
	{
		try
		{
			const result = await SetSyncEnabled( enabled, settings, keep );

			// Different settings on both sides: ask before replacing either. The switch stays on while asking.
			if( result === 'conflict' )
			{
				syncChoice.hidden = false;
				document.getElementById( 'sync-keep-this' ).focus();
				return;
			}

			syncChoice.hidden = true;
			syncSettings.checked = enabled;

			if( result === 'adopted' )
			{
				settings = await LoadSettings();
				Render();
				ShowStatus( 'Sync turned on, using the synced settings' );
			}
			else
			{
				ShowStatus( enabled ? 'Sync turned on' : 'Sync turned off' );
			}
		}
		catch( error )
		{
			syncChoice.hidden = true;
			syncSettings.checked = !enabled;
			ShowStatus( `Could not change sync: ${error.message}` );
		}
	};

	syncSettings.addEventListener( 'change', () =>
	{
		if( !syncSettings.checked && !syncChoice.hidden )
		{
			// Switched off again while we were asking: nothing was changed yet, so just stop asking
			syncChoice.hidden = true;
			return;
		}

		ChangeSync( syncSettings.checked );
	} );

	// The question disappears once answered, so put keyboard focus back on the switch instead of losing it
	const AnswerSyncQuestion = async( keep ) =>
	{
		await ChangeSync( true, keep );
		syncSettings.focus();
	};

	document.getElementById( 'sync-keep-this' ).addEventListener( 'click', () => AnswerSyncQuestion( 'this' ) );
	document.getElementById( 'sync-keep-synced' ).addEventListener( 'click', () => AnswerSyncQuestion( 'synced' ) );

	// Reset asks for a second click, so one stray click can't wipe out your own shortcuts
	const RESET_LABEL = resetButton.textContent;
	let resetArmedUntil = 0;
	let resetTimer = 0;

	const DisarmReset = () =>
	{
		resetArmedUntil = 0;
		resetButton.textContent = RESET_LABEL;
		resetButton.classList.remove( 'confirm' );
	};

	resetButton.addEventListener( 'click', () =>
	{
		if( Date.now() > resetArmedUntil )
		{
			resetArmedUntil = Date.now() + 4000;
			resetButton.textContent = 'Click again to reset';
			resetButton.classList.add( 'confirm' );
			clearTimeout( resetTimer );
			resetTimer = setTimeout( DisarmReset, 4000 );
			return;
		}

		clearTimeout( resetTimer );
		DisarmReset();
		settings = CloneDefaults();

		for( const { id } of SHORTCUT_ACTIONS )
		{
			ShowError( id, '' );
		}

		StopRecording();
		Save();
	} );

	resetButton.addEventListener( 'blur', () =>
	{
		clearTimeout( resetTimer );
		DisarmReset();
	} );

	Render();

	// Keep in sync if settings are changed in another window (e.g. popup and options tab both open)
	ExtApi?.storage?.onChanged.addListener( async( changes ) =>
	{
		if( ( changes.settings || changes.syncSettings ) && !recording )
		{
			settings = await LoadSettings();

			// While asking which settings to keep, the switch shows "on" before sync really is, so leave it be
			if( syncChoice.hidden )
			{
				syncSettings.checked = await IsSyncEnabled();
			}

			Render();
		}
	} );
} )();
