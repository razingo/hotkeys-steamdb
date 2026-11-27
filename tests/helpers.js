// @ts-check
'use strict';

const fs = require( 'node:fs' );
const path = require( 'node:path' );

const ROOT = path.join( __dirname, '..' );

/**
 * Runs in the test page before any of its scripts: a small stand-in for the browser's extension API
 * (storage.sync, storage.local, storage.onChanged and runtime.sendMessage).
 * Messages the content script sends end up in window.__sentMessages.
 * @param {{sync?: object, local?: object}} storage
 */
const InstallFakeExtensionApi = ( storage ) =>
{
	const clone = ( value ) => value === undefined ? undefined : JSON.parse( JSON.stringify( value ) );
	const data = { sync: clone( storage.sync ) || {}, local: clone( storage.local ) || {} };
	const listeners = [];

	const Area = ( name ) => ( {
		get: async( keys ) =>
		{
			const stored = data[ name ];

			if( keys === null || keys === undefined )
			{
				return clone( stored );
			}

			const list = typeof keys === 'string' ? [ keys ] : Array.isArray( keys ) ? keys : Object.keys( keys );
			const result = {};

			for( const key of list )
			{
				if( key in stored )
				{
					result[ key ] = clone( stored[ key ] );
				}
			}

			return result;
		},
		set: async( items ) =>
		{
			const changes = {};

			for( const [ key, value ] of Object.entries( items ) )
			{
				changes[ key ] = { oldValue: clone( data[ name ][ key ] ), newValue: clone( value ) };
				data[ name ][ key ] = clone( value );
			}

			for( const listener of listeners )
			{
				listener( changes, name );
			}
		},
	} );

	window.__storage = data;
	window.__sentMessages = [];

	// The extension's scripts use `browser` when it exists, so this takes priority over Chromium's own `chrome` object
	window.browser = {
		storage: {
			sync: Area( 'sync' ),
			local: Area( 'local' ),
			onChanged: { addListener: ( listener ) => listeners.push( listener ) },
		},
		runtime: {
			sendMessage: async( message ) =>
			{
				window.__sentMessages.push( message );
				return { success: true };
			},
			getManifest: () => ( { version: 'test' } ),
		},
	};
};

/** The content scripts the manifest runs on this address, in order */
const ContentScriptsFor = ( url ) =>
{
	const manifest = JSON.parse( fs.readFileSync( path.join( ROOT, 'manifest.json' ), 'utf8' ) );
	const Matches = ( pattern ) => new RegExp( `^${pattern.replace( /[.?+^$()[\]{}|\\]/g, '\\$&' ).replaceAll( '*', '.*' )}$` ).test( url );

	return manifest.content_scripts
		.filter( ( entry ) => entry.matches.some( Matches ) )
		.flatMap( ( entry ) => entry.js );
};

/**
 * Opens a fake page at a real-looking address and runs the manifest's content scripts on it, as the extension would.
 * They all run in the page's own context here; tests/extension.spec.js covers the real separation.
 * @param {import('@playwright/test').Page} page
 * @param {{url: string, html: string, storage?: {sync?: object, local?: object}}} options
 */
const OpenWithContentScript = async( page, { url, html, storage = {} } ) =>
{
	await page.addInitScript( InstallFakeExtensionApi, storage );
	await page.route( url, ( route ) => route.fulfill( { contentType: 'text/html', body: html } ) );
	await page.goto( url );

	for( const script of ContentScriptsFor( url ) )
	{
		await page.addScriptTag( { path: path.join( ROOT, script ) } );
	}

	// The content script loads its settings asynchronously before it starts listening for keys
	await page.evaluate( () => new Promise( ( resolve ) => setTimeout( resolve, 50 ) ) );
};

/**
 * Opens the settings page with the fake extension API. The extension's files are served from https://extension.test/.
 * @param {import('@playwright/test').Page} page
 * @param {{sync?: object, local?: object}} [storage]
 */
const OpenOptionsPage = async( page, storage = {} ) =>
{
	await page.addInitScript( InstallFakeExtensionApi, storage );
	await page.route( 'https://extension.test/**', ( route ) =>
	{
		const file = path.join( ROOT, new URL( route.request().url() ).pathname );
		const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

		if( !file.startsWith( ROOT ) || !fs.existsSync( file ) )
		{
			return route.fulfill( { status: 404 } );
		}

		return route.fulfill( { contentType: types[ path.extname( file ) ], body: fs.readFileSync( file ) } );
	} );
	await page.goto( 'https://extension.test/options.html' );
	await page.locator( '#shortcuts .row' ).first().waitFor();
};

/**
 * A SteamDB page with a "Store" link in its navigation and, optionally, a game popup.
 * Clicks on the popup's buttons are counted in window.clicks; window.keysSeenByPage lists keys the extension let through.
 * @param {{popup?: 'none'|'store-only'|'all-buttons', hint?: boolean, hidden?: boolean}} [options]
 */
const SteamDbPage = ( { popup = 'all-buttons', hint = true, hidden = false } = {} ) =>
{
	const buttons = popup === 'all-buttons'
		? '<button onclick="clicks.wishlist++">Wishlist</button><button onclick="clicks.follow++">Follow</button><button onclick="clicks.ignore++">Ignore</button>'
		: '';

	const popupHtml = popup === 'none' ? '' : `
		<div class="hover" style="${hidden ? 'display: none' : ''}">
			<div class="hover-buttons"><a href="https://store.steampowered.com/app/730/">Store</a>${buttons}</div>
			<div class="hover-screenshot"><img alt="" width="300" height="160"><div>${hint ? 'Click to view screenshots ↑' : ''}</div></div>
			<h3>Counter-Strike 2</h3>
			<div>Developer: Valve</div>
		</div>`;

	return `<!doctype html>
		<title>SteamDB</title>
		<nav><a id="nav-store" href="https://store.steampowered.com/">Store</a> <a href="/apps/">Apps</a></nav>
		<main><input id="search" placeholder="Search"><table><tr><td>Counter-Strike 2</td></tr></table></main>
		${popupHtml}
		<script>
			window.clicks = { wishlist: 0, follow: 0, ignore: 0, navStore: 0 };
			window.keysSeenByPage = [];
			window.addEventListener( 'keydown', ( e ) => keysSeenByPage.push( e.code ) );
			document.getElementById( 'nav-store' ).addEventListener( 'click', ( e ) => { e.preventDefault(); clicks.navStore++; } );
		</script>`;
};

/**
 * A Steam store game page, built like Steam's own markup: each button comes as an inactive and an active
 * version (e.g. "Follow" and "Following"), and only one of them is shown.
 * Like on Steam, the Wishlist buttons are javascript: links, which content scripts can't run by clicking them.
 * @param {{signedIn?: boolean, wishlisted?: boolean, following?: boolean, ignored?: boolean}} [options]
 */
const SteamStorePage = ( { signedIn = true, wishlisted = false, following = false, ignored = false } = {} ) =>
{
	const hide = ( hidden ) => hidden ? 'style="display: none"' : '';

	const Pair = ( name, active, inactiveLabel, activeLabel ) => `
		<div class="queue_control_button queue_btn_${name}">
			<div class="btnv6_blue_hoverfade btn_medium queue_btn_inactive" ${hide( active )} onclick="clicks.${name}++"><span>${inactiveLabel}</span></div>
			<div class="btnv6_blue_hoverfade btn_medium queue_btn_active" ${hide( !active )} onclick="clicks.un${name}++"><span>${activeLabel}</span></div>
		</div>`;

	const actions = signedIn ? `
		<div id="add_to_wishlist_area" ${hide( wishlisted )}>
			<a class="btnv6_blue_hoverfade btn_medium" href="javascript:void( clicks.wishlist++ )"><span>Add to your wishlist</span></a>
		</div>
		<div id="add_to_wishlist_area_success" ${hide( !wishlisted )}>
			<a class="btnv6_blue_hoverfade btn_medium queue_btn_active" href="javascript:void( clicks.unwishlist++ )"><span>On Wishlist</span></a>
		</div>
		${Pair( 'follow', following, 'Follow', 'Following' )}
		<div class="queue_control_button queue_btn_ignore">
			<button class="btnv6_blue_hoverfade btn_medium queue_btn_inactive" ${hide( ignored )} onclick="clicks.ignore++"><span>Ignore</span></button>
			<div class="btnv6_blue_hoverfade btn_medium queue_btn_active" ${hide( !ignored )} onclick="clicks.unignore++"><span>Ignored</span></div>
		</div>
		<div class="queue_ignore_menu" style="display: none">
			<button id="queue_ignore_menu_option_not_interested" class="queue_menu_option" role="menuitem" onclick="clicks.ignore++">
				<div class="option_title">Ignore This (Default)</div>
				<div class="option_subtitle">Hide from store, ignore notifications, and don't use this to generate other recommendations.</div>
			</button>
			<button id="queue_ignore_menu_option_owned_elsewhere" class="queue_menu_option" role="menuitem" onclick="clicks.ignoreElsewhere++">
				<div class="queue_menu_option_label"><div class="option_title">Played on Another Platform</div> Hide from store. Can be used to generate recommendations.</div>
			</button>
		</div>`
		: '<p>Sign in to add this item to your wishlist, follow it, or mark it as ignored</p>';

	return `<!doctype html>
		<title>Counter-Strike 2 on Steam</title>
		<header><a class="menuitem" href="https://store.steampowered.com/wishlist/">Wishlist</a> <input id="store_nav_search_term"></header>
		<div class="queue_actions_ctn">${actions}</div>
		<script>
			window.clicks = { wishlist: 0, unwishlist: 0, follow: 0, unfollow: 0, ignore: 0, unignore: 0, ignoreElsewhere: 0 };
			window.keysSeenByPage = [];
			window.addEventListener( 'keydown', ( e ) => keysSeenByPage.push( e.code ) );
		</script>`;
};

/**
 * Page script: a stand-in for Steam's own wishlist and ignore functions (GDynamicStore and jQuery's $J),
 * which steam-page-click.js uses for games with data-ds-appid. Changes are recorded in window.clicks.wishlist and
 * .ignore as app IDs, "remove:<app ID>" when removing. wishlistedIds are already on the wishlist.
 */
const FakeDynamicStore = ( wishlistedIds = [] ) => `
	// jQuery-like: selector strings become a list with removeClass, elements stay as they are
	window.$J = ( x ) => typeof x !== 'string' ? x : {
		elements: [ ...document.querySelectorAll( x ) ],
		removeClass( name ) { this.elements.forEach( ( el ) => el.classList.remove( name ) ); return this; },
	};
	window.GDynamicStore = {
		wishlist: new Set( ${JSON.stringify( wishlistedIds.map( Number ) )} ),
		ignored: new Set(),
		BIsAppOnWishlist( appid ) { return this.wishlist.has( appid ); },
		BIsAppIgnored( appid ) { return this.ignored.has( appid ); },
		// Like Steam's: the in-page list changes at once, the server answers a moment later
		ModifyWishlist( $el, appid, remove, onSuccess ) { this.wishlist[ remove ? 'delete' : 'add' ]( appid ); clicks.wishlist.push( ( remove ? 'remove:' : '' ) + appid ); setTimeout( () => onSuccess?.( appid ), 300 ); },
		ModifyIgnoredApp( $el, appid, remove, onSuccess ) { this.ignored[ remove ? 'delete' : 'add' ]( appid ); clicks.ignore.push( ( remove ? 'remove:' : '' ) + appid ); setTimeout( () => onSuccess?.( appid ), 300 ); },
		// Like Steam's: does nothing unless forced, and doesn't clear ds_ignored itself
		DecorateDynamicItems( $items, force )
		{
			if( !force ) return;
			for( const el of $items.elements || [] )
			{
				const appid = Number( el.dataset.dsAppid );
				el.classList.remove( 'ds_wishlist' );
				if( this.wishlist.has( appid ) ) el.classList.add( 'ds_wishlist' );
				else if( this.ignored.has( appid ) ) el.classList.add( 'ds_ignored' );
			}
		},
	};`;

/**
 * A Steam store list (like the tabs on the front page), built like Steam's markup: each game row has data-ds-appid
 * and, when signed in, an options button (.ds_options). Clicking it shows a .ds_options_tooltip menu a moment later.
 * Menu choices are recorded in window.clicks.wishlist / .ignore as app IDs; window.clicks.opened counts rows opened by a click.
 * With dynamicStore (the default), the page also has Steam's own wishlist functions, which the extension prefers.
 * @param {{signedIn?: boolean, wishlisted?: boolean, dynamicStore?: boolean}} [options]
 */
const SteamListPage = ( { signedIn = true, wishlisted = false, dynamicStore = true } = {} ) =>
{
	const Row = ( appid, name ) => `
		<a class="tab_item" data-ds-appid="${appid}" href="https://store.steampowered.com/app/${appid}/${name}/" style="display: block; height: 60px">
			<div class="tab_item_name">${name}</div>
			${signedIn ? '<div class="ds_options"><div></div></div>' : ''}
		</a>`;

	return `<!doctype html>
		<title>Welcome to Steam</title>
		<header style="height: 80px"><input id="store_nav_search_term">${signedIn ? '<span id="account_pulldown">Account</span>' : ''}</header>
		<div class="tab_content">${Row( 111, 'Fleshborn' )}${Row( 222, 'Me_and_You' )}</div>
		<script>
			window.clicks = { wishlist: [], ignore: [], opened: 0 };
			${dynamicStore ? FakeDynamicStore( wishlisted ? [ 111 ] : [] ) : ''}
			window.keysSeenByPage = [];
			window.addEventListener( 'keydown', ( e ) => keysSeenByPage.push( e.code ) );

			document.addEventListener( 'click', ( e ) =>
			{
				const options = e.target.closest( '.ds_options' );

				if( !options )
				{
					if( e.target.closest( 'a.tab_item' ) )
					{
						e.preventDefault();
						clicks.opened++;
					}

					return;
				}

				e.preventDefault();
				e.stopPropagation();

				const appid = options.closest( '[data-ds-appid]' ).dataset.dsAppid;
				document.querySelectorAll( '.ds_options_tooltip' ).forEach( ( menu ) => menu.remove() );

				setTimeout( () =>
				{
					const menu = document.createElement( 'div' );
					menu.className = 'ds_options_tooltip';
					menu.innerHTML = '<div class="option" data-choice="wishlist">${wishlisted ? 'Remove from your wishlist' : 'Add to your wishlist'}</div>' +
						'<div class="option" data-choice="ignore">Ignore</div><a class="option" href="#">Store preferences</a>';
					menu.addEventListener( 'click', ( event ) =>
					{
						event.preventDefault();
						const choice = event.target.closest( '.option' ).dataset.choice;

						if( choice )
						{
							clicks[ choice ].push( appid );
						}

						menu.remove();
					} );
					document.body.append( menu );
				}, 30 );
			}, true );
		</script>`;
};

/**
 * Steam's front page, built like the real one (checked on the live page while signed in):
 * - the header's "Wishlist" link, which must never be pressed
 * - a recommendation box (.home_content.single): its game has data-ds-appid and an "ON WISHLIST" badge, its own
 *   buttons only add (never remove), and it links to the game it was recommended for ("Since you wish for ...")
 * - an older box without data-ds-appid, with only its own buttons
 * - newer capsules (Discounts & Events, the Calendar): "Focusable" links; hovering one shows a "..." button whose menu
 *   offers "Add to wishlist" / "Remove from wishlist" and "Ignore Game" / "Remove from ignore list"
 * - a plain link to a game
 * Steam's own wishlist functions record into window.clicks.wishlist / .ignore, capsule menus into
 * .capsuleWishlist / .capsuleIgnore ("remove:<app ID>" when removing), and buttons into their own counters.
 */
const SteamFrontPage = () => `<!doctype html>
	<title>Welcome to Steam</title>
	<header style="height: 60px"><a id="header-wishlist" href="https://store.steampowered.com/wishlist/" onclick="clicks.headerWishlist++; return false">Wishlist (2)</a> <span id="account_pulldown">Account</span></header>
	<div class="home_page_content" style="padding: 20px">
		<div class="home_content single">
			<div class="title">The Wolf Among Us Remastered</div>
			<div class="reason">Since you wish for <a id="since" href="https://store.steampowered.com/app/777/Golden_Idol/" onclick="return false">The Rise of the Golden Idol</a></div>
			<div class="actions">
				<a class="btnv6_white_transparent btn_small_tall" href="https://store.steampowered.com/app/333/The_Wolf_Among_Us/?snr=1_239" onclick="clicks.opened++; return false">Visit Product Page</a>
				<a class="btnv6_white_transparent btn_small_tall" href="#" onclick="clicks.boxButtonWishlist++; return false">Add to your wishlist</a>
				<a class="btnv6_white_transparent btn_small_tall" onclick="clicks.boxButtonIgnore++; return false">Ignore</a>
				<a class="btnv6_white_transparent btn_small_tall" href="https://store.steampowered.com/recommended/morelike/app/333/" onclick="return false">Find More like this</a>
			</div>
			<div class="gamelink home_content_items ds_flagged ds_wishlist" data-ds-appid="333">
				<a class="capsule_image_ctn" href="https://store.steampowered.com/app/333/The_Wolf_Among_Us/?snr=1_239" onclick="clicks.opened++; return false">
					<div class="ds_flag ds_wishlist_flag">ON WISHLIST</div><img class="box-screenshot" alt="" width="300" height="100">
				</a>
			</div>
		</div>
		<div class="older_box" style="margin-top: 20px">
			<div class="older-title">An older recommendation</div>
			<a class="btn_small" href="https://store.steampowered.com/app/666/Older/" onclick="return false">Visit Product Page</a>
			<a class="btn_small" href="javascript:void( clicks.olderBoxWishlist++ )"><span>Add to your wishlist</span></a>
			<a class="btn_small" href="javascript:void( clicks.olderBoxIgnore++ )"><span>Ignore</span></a>
		</div>
		<div class="capsules" style="display: flex; gap: 40px; margin-top: 20px">
			${[ [ 444, 'Doom' ], [ 555, 'Cat_Cafe' ] ].map( ( [ appid, name ] ) => `
			<div class="capsule-ctn Panel Focusable" data-app="${appid}">
				<div class="hover-wrap"><a class="Focusable" href="https://store.steampowered.com/app/${appid}/${name}/" style="display: block; width: 200px; height: 120px" onclick="clicks.opened++; return false"></a></div>
				<div class="menu-ctn"><button class="menu-button" style="display: none">⋯</button></div>
			</div>` ).join( '<div class="gap" style="width: 40px; height: 120px"></div>' )}
		</div>
		<a id="plain-game" href="https://store.steampowered.com/app/888/Plain/" style="display: block; height: 40px; margin-top: 20px" onclick="clicks.opened++; return false">A plain link to a game</a>
	</div>
	<script>
		window.clicks = { wishlist: [], ignore: [], boxButtonWishlist: 0, boxButtonIgnore: 0, olderBoxWishlist: 0, olderBoxIgnore: 0, headerWishlist: 0, opened: 0, capsuleWishlist: [], capsuleIgnore: [] };
		window.keysSeenByPage = [];
		window.addEventListener( 'keydown', ( e ) => keysSeenByPage.push( e.code ) );
		${FakeDynamicStore( [ 333 ] )}

		// Like Steam: hovering a capsule shows its "..." button, which opens a menu a moment later
		const capsuleState = { wishlist: new Set(), ignored: new Set() };

		for( const capsule of document.querySelectorAll( '.capsule-ctn' ) )
		{
			const button = capsule.querySelector( '.menu-button' );
			capsule.addEventListener( 'mouseenter', () => button.style.display = '' );
			capsule.addEventListener( 'mouseleave', () => button.style.display = 'none' );

			button.addEventListener( 'click', () =>
			{
				const appid = capsule.dataset.app;
				document.querySelectorAll( '.contextMenuPopup' ).forEach( ( menu ) => menu.remove() );

				setTimeout( () =>
				{
					const wishlisted = capsuleState.wishlist.has( appid );
					const ignored = capsuleState.ignored.has( appid );
					const menu = document.createElement( 'div' );
					menu.className = 'contextMenuPopup visible ready';
					menu.innerHTML = '<div class="contextMenuItem" role="menuitem" data-choice="wishlist">' + ( wishlisted ? 'Remove from wishlist' : 'Add to wishlist' ) + '</div>' +
						'<div class="contextMenuItem" role="menuitem" data-choice="ignore">' + ( ignored ? 'Remove from ignore list' : 'Ignore Game' ) + '</div>' +
						'<div class="contextMenuItem" role="menuitem">Preferences</div>';
					menu.addEventListener( 'click', ( event ) =>
					{
						const choice = event.target.closest( '.contextMenuItem' ).dataset.choice;
						const set = choice === 'wishlist' ? capsuleState.wishlist : capsuleState.ignored;
						const list = choice === 'wishlist' ? clicks.capsuleWishlist : clicks.capsuleIgnore;

						if( choice )
						{
							list.push( ( set.has( appid ) ? 'remove:' : '' ) + appid );
							set.has( appid ) ? set.delete( appid ) : set.add( appid );
						}

						menu.remove();
					} );
					document.body.append( menu );
				}, 30 );
			} );
		}
	</script>`;

/**
 * A Steam sale page like /specials, built like the real one (checked on the live page while signed in): each game is a
 * tile whose link covers the image; while the mouse is over the tile, Steam adds an "Add to wishlist" /
 * "Remove from wishlist" button next to the link. There's no Ignore. Button presses are recorded in
 * window.clicks.wishlist as app IDs ("remove:<app ID>" when removing).
 * @param {{signedIn?: boolean}} [options]
 */
const SteamSalePage = ( { signedIn = true } = {} ) => `<!doctype html>
	<title>Special Offers</title>
	<header style="height: 60px"><input id="store_nav_search_term"></header>
	<div class="sale-row" style="display: flex; gap: 30px">
		${[ [ 1111, 'Castaway' ], [ 2222, 'Lysfanga' ] ].map( ( [ appid, name ] ) => `
		<div class="tile Panel" data-app="${appid}">
			<div class="hover-wrap">
				<a href="https://store.steampowered.com/app/${appid}/${name}?snr=1_2300_4" onclick="clicks.opened++; return false"><img alt="" width="220" height="110"></a>
				<div class="wishlist-button Panel" style="display: none"><div class="WishlistButtonText">Add to wishlist</div></div>
			</div>
		</div>` ).join( '' )}
	</div>
	<script>
		window.clicks = { wishlist: [], opened: 0 };
		window.keysSeenByPage = [];
		window.addEventListener( 'keydown', ( e ) => keysSeenByPage.push( e.code ) );

		for( const tile of document.querySelectorAll( '.tile' ) )
		{
			const button = tile.querySelector( '.wishlist-button' );
			const text = button.querySelector( '.WishlistButtonText' );
			${signedIn ? `tile.addEventListener( 'mouseenter', () => button.style.display = '' );
			tile.addEventListener( 'mouseleave', () => button.style.display = 'none' );` : ''}
			button.addEventListener( 'click', () =>
			{
				const remove = text.textContent === 'Remove from wishlist';
				clicks.wishlist.push( ( remove ? 'remove:' : '' ) + tile.dataset.app );
				text.textContent = remove ? 'Add to wishlist' : 'Remove from wishlist';
			} );
		}
	</script>`;

/** A plain key shortcut, as the extension stores it */
const Key = ( letter, modifiers = {} ) => ( { code: `Key${letter}`, label: letter, ctrl: false, alt: false, shift: false, meta: false, ...modifiers } );

/**
 * Settings as the extension stores them: the defaults, with the given shortcuts and options changed
 * @param {{shortcuts?: object, storeInBackground?: boolean, steamStorePages?: boolean}} [changes]
 */
const SettingsWith = ( { shortcuts = {}, ...options } = {} ) => ( {
	shortcuts: { store: Key( 'Q' ), wishlist: Key( 'W' ), follow: Key( 'E' ), ignore: Key( 'R' ), ignoreElsewhere: Key( 'T' ), ...shortcuts },
	storeInBackground: true,
	steamStorePages: true,
	...options,
} );

/** The files that go into the extension, read from build.ps1 so there's one list */
const ExtensionFiles = () =>
{
	const script = fs.readFileSync( path.join( ROOT, 'build.ps1' ), 'utf8' );
	const list = script.match( /\$files = @\(([\s\S]*?)\)/ )[ 1 ];
	const files = [ ...list.matchAll( /'([^']+)'/g ) ].map( ( match ) => match[ 1 ] );
	const icons = fs.readdirSync( path.join( ROOT, 'icons' ) ).filter( ( name ) => name.endsWith( '.png' ) ).map( ( name ) => `icons/${name}` );

	return [ ...files, ...icons ];
};

module.exports = { ROOT, OpenWithContentScript, OpenOptionsPage, SteamDbPage, SteamStorePage, SteamListPage, SteamFrontPage, SteamSalePage, Key, SettingsWith, ExtensionFiles };
