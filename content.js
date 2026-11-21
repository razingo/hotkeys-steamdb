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

	// Finds the open popup: the smallest element that holds all four buttons.
	const FindPopupButtons = () =>
	{
		const candidates = [ ...document.querySelectorAll( CLICKABLE ) ]
			.filter( ( el ) => Matches( el, 'wishlist' ) && IsVisible( el ) );

		// Prefer the most recently added one, popups are usually appended at the end of the page
		for( const wishlist of candidates.reverse() )
		{
			let container = wishlist.parentElement;

			for( let depth = 0; container && depth < 5; depth++, container = container.parentElement )
			{
				const buttons = [ ...container.querySelectorAll( CLICKABLE ) ].filter( IsVisible );
				const found = {};

				for( const action of Object.keys( LABELS ) )
				{
					found[ action ] = buttons.find( ( el ) => Matches( el, action ) );
				}

				if( found.store && found.wishlist && found.follow && found.ignore )
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

		const buttons = FindPopupButtons();

		if( !buttons )
		{
			return;
		}

		const button = buttons[ action ];

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
