'use strict';

( async() =>
{
	const list = document.getElementById( 'shortcuts' );
	const template = /** @type {HTMLTemplateElement} */ ( document.getElementById( 'shortcut-row' ) );
	const storeInBackground = /** @type {HTMLInputElement} */ ( document.getElementById( 'store-in-background' ) );
	const resetButton = document.getElementById( 'reset' );
	const status = document.getElementById( 'status' );

	let settings = await LoadSettings();

	/** @type {string|null} id of the action currently waiting for a key */
	let recording = null;

	/** @type {Record<string, {key: HTMLButtonElement, clear: HTMLButtonElement, error: HTMLElement}>} */
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
		}

		storeInBackground.checked = settings.storeInBackground;
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

		rows[ action.id ] = { key, clear, error };
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

		if( e.key === 'Tab' && noModifiers )
		{
			ShowError( id, 'Tab is needed to move around pages, pick another key.' );
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

	resetButton.addEventListener( 'click', () =>
	{
		settings = CloneDefaults();

		for( const { id } of SHORTCUT_ACTIONS )
		{
			ShowError( id, '' );
		}

		StopRecording();
		Save();
	} );

	Render();

	// Keep in sync if settings are changed in another window (e.g. popup and options tab both open)
	ExtApi?.storage?.onChanged.addListener( async( changes, area ) =>
	{
		if( area === 'sync' && changes.settings && !recording )
		{
			settings = await LoadSettings();
			Render();
		}
	} );
} )();
