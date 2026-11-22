'use strict';

// Uses SHORTCUT_ACTIONS, LoadSettings, EventMatches and ExtApi from shared.js

( async() =>
{
	let settings = await LoadSettings();

	ExtApi.storage.onChanged.addListener( async( changes, area ) =>
	{
		if( area === 'sync' && changes.settings )
		{
			settings = await LoadSettings();
		}
	} );

	// Buttons are found by their label, so this survives class name changes on the site.
	// Labels may change after a click (e.g. "Wishlisted", "Unfollow", "Ignored"), hence the loose patterns.
	const LABELS = {
		store: /^store$/i,
		wishlist: /wishlist/i,
		follow: /follow/i,
		ignore: /ignore/i,
	};

	const CLICKABLE = 'a, button, [role="button"]';

	const IsVisible = ( el ) =>
	{
		if( typeof el.checkVisibility === 'function' )
		{
			return el.checkVisibility( { checkOpacity: true, checkVisibilityCSS: true } );
		}

		return el.getClientRects().length > 0 && getComputedStyle( el ).visibility !== 'hidden';
	};

	const LabelOf = ( el ) => ( el.textContent || el.getAttribute( 'aria-label' ) || '' ).trim();

	const Matches = ( el, action ) => LABELS[ action ].test( LabelOf( el ) );

	// Text shown under the popup's screenshot, used to tell the popup apart from other "Store" links
	const POPUP_HINT = /click to view screenshots/i;

	// Finds the open popup, starting from its Store button. Wishlist, Follow and Ignore are optional:
	// steamdb.info only shows them when the SteamDB extension is installed.
	// Returns the buttons that are present, e.g. { store } or { store, wishlist, follow, ignore }.
	const FindPopupButtons = () =>
	{
		const candidates = [ ...document.querySelectorAll( CLICKABLE ) ]
			.filter( ( el ) => Matches( el, 'store' ) && IsVisible( el ) );

		// Prefer the most recently added one, popups are usually appended at the end of the page
		for( const store of candidates.reverse() )
		{
			let container = store.parentElement;

			// The popup never is the whole page, so stop below <body>
			for( let depth = 0; container && container !== document.body && depth < 6; depth++, container = container.parentElement )
			{
				const buttons = [ ...container.querySelectorAll( CLICKABLE ) ].filter( IsVisible );

				// Reached a container with another Store link, so we've walked out of the popup
				if( buttons.some( ( el ) => el !== store && Matches( el, 'store' ) ) )
				{
					break;
				}

				const found = { store };

				for( const action of [ 'wishlist', 'follow', 'ignore' ] )
				{
					found[ action ] = buttons.find( ( el ) => Matches( el, action ) );
				}

				// innerText only has visible text, so script contents and hidden elements don't count
				if( POPUP_HINT.test( container.innerText ) || ( found.wishlist && found.follow && found.ignore ) )
				{
					return found;
				}
			}
		}

		return null;
	};

	const FLASH_OK = '#66c0f4';
	const FLASH_COOLDOWN = '#e0a100';

	const Flash = ( el, color = FLASH_OK ) =>
	{
		const old = el.style.outline;
		el.style.outline = `2px solid ${color}`;
		setTimeout( () => el.style.outline = old, 300 );
	};

	// Wishlist, Follow and Ignore each send a request to the Steam store (through the SteamDB extension).
	// Pressing keys quickly can get you temporarily blocked by Steam, so these share one cooldown.
	// The store shortcut has its own, so a double press doesn't open two tabs.
	const COOLDOWN_MS = 1000;
	const COOLDOWN_GROUP = {
		store: 'store',
		wishlist: 'steam-request',
		follow: 'steam-request',
		ignore: 'steam-request',
	};

	/** @type {Record<string, number>} */
	const lastUsed = {};

	/** @returns {boolean} true if the action may run now (and starts its cooldown) */
	const TryStartCooldown = ( action ) =>
	{
		const group = COOLDOWN_GROUP[ action ];
		const now = performance.now();

		if( now - ( lastUsed[ group ] ?? -Infinity ) < COOLDOWN_MS )
		{
			return false;
		}

		lastUsed[ group ] = now;
		return true;
	};

	const OpenStore = ( href ) =>
	{
		const fallback = () => window.open( href, '_blank', 'noopener' );

		ExtApi.runtime.sendMessage( { type: 'open-store', url: href, background: settings.storeInBackground } )
			.then( ( response ) =>
			{
				if( !response?.success )
				{
					fallback();
				}
			} )
			.catch( fallback );
	};

	document.addEventListener( 'keydown', ( e ) =>
	{
		if( e.repeat || e.isComposing )
		{
			return;
		}

		const action = SHORTCUT_ACTIONS.find( ( { id } ) => EventMatches( e, settings.shortcuts[ id ] ) )?.id;

		if( !action )
		{
			return;
		}

		// Don't steal keys while typing in search boxes etc.
		if( e.target instanceof Element && e.target.closest( 'input, textarea, select, [contenteditable=""], [contenteditable="true"]' ) )
		{
			return;
		}

		const button = FindPopupButtons()?.[ action ];

		// No popup open, or this button isn't in it (e.g. Wishlist without the SteamDB extension): leave the key alone
		if( !button )
		{
			return;
		}

		e.preventDefault();
		e.stopPropagation();

		if( !TryStartCooldown( action ) )
		{
			// Too soon after the previous one: ignore the press, with an amber flash so it's clear why
			Flash( button, FLASH_COOLDOWN );
			return;
		}

		Flash( button );

		if( action === 'store' )
		{
			const href = button.closest( 'a[href]' )?.href;

			if( href )
			{
				OpenStore( href );
				return;
			}
		}

		button.click();
	}, true );
} )();
