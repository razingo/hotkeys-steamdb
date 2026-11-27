'use strict';

// Uses SHORTCUT_ACTIONS, LoadSettings, EventMatches and ExtApi from shared.js
//
// Runs on steamdb.info (buttons in the game popup) and on the Steam store: game pages, the front page,
// store lists, recommendations and sale pages. On Steam, steam-page-click.js does the actual clicking.

( async() =>
{
	let settings = await LoadSettings();

	// Settings live in sync or local storage depending on the sync switch, so react to both
	ExtApi.storage.onChanged.addListener( async( changes ) =>
	{
		if( changes.settings || changes.syncSettings )
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

	const LabelOf = ( el ) => ( el.textContent || el.getAttribute( 'aria-label' ) || '' ).trim().replace( /\s+/g, ' ' );

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

	// Steam's own buttons are divs and links styled as buttons
	const STEAM_CLICKABLE = `${CLICKABLE}, [class*="btn"]`;

	// Finds Wishlist, Follow and Ignore on a Steam store game page (store.steampowered.com/app/...).
	// They're only shown when signed in to Steam. There's no Store button: you're already on the store.
	const FindSteamStoreButtons = () =>
	{
		// The box under the game's header that holds these buttons
		const container = document.querySelector( '.queue_actions_ctn' );

		if( !container )
		{
			return null;
		}

		const candidates = [ ...container.querySelectorAll( STEAM_CLICKABLE ) ].filter( IsVisible );
		const found = {};

		for( const action of [ 'wishlist', 'follow', 'ignore' ] )
		{
			const matching = candidates.filter( ( el ) => Matches( el, action ) );

			// Steam wraps each button in another element with "btn" in its class, so take the innermost match
			found[ action ] = matching.find( ( el ) => !matching.some( ( other ) => other !== el && el.contains( other ) ) );
		}

		// "Played on Another Platform" sits in the menu next to Ignore, which is usually closed.
		// It's pressed while hidden, so it only counts when the Ignore button is there too.
		if( found.ignore )
		{
			found.ignoreElsewhere = document.getElementById( 'queue_ignore_menu_option_owned_elsewhere' ) ??
				[ ...document.querySelectorAll( '[role="menuitem"]' ) ].find( ( el ) => /played on another platform/i.test( LabelOf( el ) ) );
		}

		return found;
	};

	const STEAM_GAME_LINK = /^https:\/\/store\.steampowered\.com\/app\/(\d+)/;
	const IS_STEAM_STORE = location.hostname === 'store.steampowered.com';

	// Read on every key press: Steam's newer pages can change the address without reloading
	const PageAppId = () => STEAM_GAME_LINK.exec( location.href )?.[ 1 ];

	const Hovered = () => [ ...document.querySelectorAll( ':hover' ) ].pop();

	// Steam's older header has an account menu, the newer one doesn't. Signed out, both show a link to the login page.
	const IsSignedInToSteam = () => !!document.getElementById( 'account_pulldown' ) ||
		!document.querySelector( 'a[href*="store.steampowered.com/login"], a[href^="/login"]' );

	const AppIdOf = ( link ) => link ? STEAM_GAME_LINK.exec( link.href )?.[ 1 ] : undefined;

	// Games in Steam's older store sections carry data-ds-appid: rows in store lists (front page tabs, search results),
	// recommendation rows ("Under 40 zł" and the like) and the recommendation boxes at the bottom of the front page
	// ("Since you wish for ..."). For these, steam-page-click.js uses Steam's own wishlist and ignore functions, so
	// Wishlist and Ignore toggle: they also remove from the wishlist and unignore, which the boxes' own buttons can't.
	// Only when signed in to Steam.
	const FindSteamDynamicItem = () =>
	{
		const hovered = Hovered();
		// The box, or the thin margin around it that belongs to its container
		const box = hovered?.closest( '.home_content.single' ) ?? hovered?.closest( '.home_content_single_ctn' );
		const item = hovered?.closest( '[data-ds-appid]' ) ?? box?.querySelector( '[data-ds-appid]' );
		const appid = item?.dataset.dsAppid;

		// Bundles list several apps; signed out, there's no wishlist to change
		if( !appid || !/^\d+$/.test( appid ) || !IsSignedInToSteam() )
		{
			return null;
		}

		// Hovering a link to another game, such as "Since you wish for ...", isn't about this game
		const hoveredAppId = AppIdOf( hovered.closest( 'a[href]' ) );

		if( hoveredAppId && hoveredAppId !== appid )
		{
			return null;
		}

		const links = [ item.closest( 'a[href]' ), ...item.querySelectorAll( 'a[href]' ), ...( box ? box.querySelectorAll( 'a[href]' ) : [] ) ];
		const link = links.find( ( el ) => el && AppIdOf( el ) === appid );

		return { store: link, wishlist: item, ignore: item, dynamicItem: item };
	};

	// Exact labels of Steam's action buttons, so links such as "Wishlist (2)" in Steam's header don't count
	const STEAM_BUTTON_LABELS = {
		wishlist: /^(add to (your )?wishlist|on wishlist|remove from (your )?wishlist)$/i,
		follow: /^(follow|following|unfollow)$/i,
		ignore: /^(ignore|ignored|ignore game)$/i,
	};

	// A box under the mouse with its own Wishlist / Ignore buttons, like the recommendation on Steam's front page.
	// Walks up from the mouse until it finds exactly one Wishlist button. It stops when it has clearly left the box:
	// a second Wishlist button, or links to more than two games (a box links to its game, and maybe to the game
	// it was recommended for, as in "Since you wish for ...").
	const FindSteamHoveredBox = () =>
	{
		const hovered = Hovered();
		const hoveredAppId = AppIdOf( hovered?.closest( 'a[href]' ) );
		let container = hovered;

		for( let depth = 0; container && container !== document.body && depth < 10; depth++, container = container.parentElement )
		{
			const gameLinks = [ ...container.querySelectorAll( 'a[href]' ) ].filter( ( el ) => STEAM_GAME_LINK.test( el.href ) );

			if( new Set( gameLinks.map( AppIdOf ) ).size > 2 )
			{
				return null;
			}

			// Links to a game page aren't action buttons, even when their text says "ON WISHLIST" (a badge on the image)
			const buttons = [ ...container.querySelectorAll( STEAM_CLICKABLE ) ]
				.filter( ( el ) => IsVisible( el ) && !AppIdOf( el.closest( 'a[href]' ) ) );
			const Innermost = ( label ) =>
			{
				const matching = buttons.filter( ( el ) => label.test( LabelOf( el ) ) );
				return matching.filter( ( el ) => !matching.some( ( other ) => other !== el && el.contains( other ) ) );
			};

			const wishlist = Innermost( STEAM_BUTTON_LABELS.wishlist );

			if( wishlist.length > 1 )
			{
				return null;
			}

			if( wishlist.length === 1 )
			{
				// The game page's own buttons are handled by FindSteamStoreButtons, which also knows "Played elsewhere"
				if( wishlist[ 0 ].closest( '.queue_actions_ctn' ) )
				{
					return null;
				}

				// The box's own game: its "Visit Product Page" link, otherwise its first game link
				const gameLink = gameLinks.find( ( el ) => /^visit product page$/i.test( LabelOf( el ) ) ) ?? gameLinks[ 0 ];

				// Hovering a link to another game, such as "Since you wish for ...", isn't about this box's game
				if( hoveredAppId && hoveredAppId !== AppIdOf( gameLink ) )
				{
					return null;
				}

				return {
					store: gameLink,
					wishlist: wishlist[ 0 ],
					follow: Innermost( STEAM_BUTTON_LABELS.follow )[ 0 ],
					ignore: Innermost( STEAM_BUTTON_LABELS.ignore )[ 0 ],
				};
			}
		}

		return null;
	};

	// Any other game under the mouse: Store opens its page. On a game page, hovering a link to the same game
	// doesn't count, so the page's own buttons still work.
	// Steam's newer capsules (Discounts & Events, the Personal Calendar, ...) are links marked "Focusable".
	// While the mouse is over one, Steam shows a "..." button next to it, whose menu Wishlist and Ignore use.
	const HasCapsuleMenuButton = ( link ) =>
	{
		let container = link;

		for( let depth = 0; depth < 4 && container; depth++, container = container.parentElement )
		{
			const buttons = [ ...container.querySelectorAll( 'button' ) ].filter( IsVisible );

			if( buttons.length )
			{
				return buttons.length === 1;
			}
		}

		return false;
	};

	// Tiles on Steam's sale pages (e.g. /specials) show their own "Add to wishlist" / "Remove from wishlist" button
	// while the mouse is over them. There's no Ignore there. Only looks inside this one game's tile.
	const WISHLIST_TOGGLE = /^(add to|remove from) (your )?wishlist$/i;

	const FindTileWishlistButton = ( link ) =>
	{
		let container = link;

		for( let depth = 0; depth < 5 && container && container !== document.body; depth++, container = container.parentElement )
		{
			const games = new Set( [ ...container.querySelectorAll( 'a[href]' ) ].map( AppIdOf ).filter( Boolean ) );

			if( games.size > 1 )
			{
				return null;
			}

			// innerText only has visible text, so a wrapper around a hidden button doesn't count as the button
			const matching = [ ...container.querySelectorAll( 'div, span, button, a' ) ]
				.filter( ( el ) => IsVisible( el ) && WISHLIST_TOGGLE.test( ( el.innerText || '' ).trim().replace( /\s+/g, ' ' ) ) );
			const innermost = matching.find( ( el ) => !matching.some( ( other ) => other !== el && el.contains( other ) ) );

			if( innermost )
			{
				return innermost;
			}
		}

		return null;
	};

	const FindSteamHoveredGame = () =>
	{
		const link = Hovered()?.closest( 'a[href]' );
		const appid = AppIdOf( link );

		if( !appid || appid === PageAppId() )
		{
			return null;
		}

		if( link.closest( '.Focusable' ) && HasCapsuleMenuButton( link ) )
		{
			return { store: link, wishlist: link, ignore: link, capsule: link };
		}

		return { store: link, wishlist: FindTileWishlistButton( link ) ?? undefined };
	};

	/** @returns {Record<string, HTMLElement|undefined>|null} the buttons that can be pressed right now */
	const FindButtons = () =>
	{
		if( IS_STEAM_STORE )
		{
			if( !settings.steamStorePages )
			{
				return null;
			}

			// Whatever is under the mouse comes first, then the game page's own buttons
			return FindSteamDynamicItem() ?? FindSteamHoveredBox() ?? FindSteamHoveredGame() ?? FindSteamStoreButtons();
		}

		return FindPopupButtons();
	};

	const FLASH_OK = '#66c0f4';
	const FLASH_COOLDOWN = '#e0a100';

	// Remembers each button's own outline while it's flashing. Without this, a second flash within 300 ms
	// would save the first flash's outline as "the original" and leave it on for good.
	/** @type {WeakMap<HTMLElement, {outline: string, timer: number}>} */
	const flashing = new WeakMap();

	const Flash = ( el, color = FLASH_OK ) =>
	{
		const current = flashing.get( el );
		const outline = current ? current.outline : el.style.outline;
		clearTimeout( current?.timer );

		el.style.outline = `2px solid ${color}`;
		flashing.set( el, {
			outline,
			timer: setTimeout( () =>
			{
				el.style.outline = outline;
				flashing.delete( el );
			}, 300 ),
		} );
	};

	// Wishlist, Follow and Ignore each send a request to the Steam store (on steamdb.info, through the SteamDB extension).
	// Pressing keys quickly can get you temporarily blocked by Steam, so these share one cooldown.
	// The store shortcut has its own, so a double press doesn't open two tabs.
	const COOLDOWN_MS = 1000;
	const COOLDOWN_GROUP = {
		store: 'store',
		wishlist: 'steam-request',
		follow: 'steam-request',
		ignore: 'steam-request',
		ignoreElsewhere: 'steam-request',
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

	// On Steam, the click is done by steam-page-click.js in the page's own context: Steam's Wishlist button is a
	// javascript: link, and browsers don't run those when an extension's content script clicks them.
	const Press = ( button ) =>
	{
		if( IS_STEAM_STORE )
		{
			button.dispatchEvent( new CustomEvent( 'hotkeys-steamdb:click', { bubbles: true } ) );
			return;
		}

		button.click();
	};

	const OpenStore = ( href ) =>
	{
		const fallback = () => window.open( href, '_blank', 'noopener' );

		try
		{
			ExtApi.runtime.sendMessage( { type: 'open-store', url: href, background: settings.storeInBackground } )
				.then( ( response ) =>
				{
					if( !response?.success )
					{
						fallback();
					}
				} )
				.catch( fallback );
		}
		catch
		{
			// After the extension updates, tabs that were already open keep running the old copy of this script.
			// It can't talk to the extension any more and sendMessage throws right away, so open the page directly.
			fallback();
		}
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

		// Don't steal keys while typing in search boxes etc. isContentEditable also covers
		// contenteditable="plaintext-only" and elements inside an editable area.
		if( e.target instanceof Element && ( e.target.closest( 'input, textarea, select' ) || ( e.target instanceof HTMLElement && e.target.isContentEditable ) ) )
		{
			return;
		}

		const buttons = FindButtons();
		const button = buttons?.[ action ];

		// No popup open, or this button isn't there (e.g. Wishlist without the SteamDB extension,
		// or Store on Steam's own page): leave the key alone
		if( !button )
		{
			return;
		}

		e.preventDefault();
		e.stopPropagation();

		// An option in Steam's closed Ignore menu can't show a flash, so the Ignore button shows it
		const flashTarget = IsVisible( button ) ? button : ( buttons.ignore ?? button );

		if( !TryStartCooldown( action ) )
		{
			// Too soon after the previous one: ignore the press, with an amber flash so it's clear why
			Flash( flashTarget, FLASH_COOLDOWN );
			return;
		}

		Flash( flashTarget );

		// A game in Steam's older store sections, or one of Steam's newer capsules:
		// steam-page-click.js does it from the page's own context
		if( buttons.dynamicItem && ( action === 'wishlist' || action === 'ignore' ) )
		{
			buttons.dynamicItem.dispatchEvent( new CustomEvent( `hotkeys-steamdb:toggle-${action}`, { bubbles: true } ) );
			return;
		}

		if( buttons.capsule && ( action === 'wishlist' || action === 'ignore' ) )
		{
			buttons.capsule.dispatchEvent( new CustomEvent( `hotkeys-steamdb:capsule-${action}`, { bubbles: true } ) );
			return;
		}

		if( action === 'store' )
		{
			const href = button.closest( 'a[href]' )?.href;

			if( href )
			{
				OpenStore( href );
				return;
			}
		}

		Press( button );
	}, true );
} )();
