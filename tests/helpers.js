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

/**
 * Opens a fake page at a real-looking address and runs the content script on it, as the extension would.
 * @param {import('@playwright/test').Page} page
 * @param {{url: string, html: string, storage?: {sync?: object, local?: object}}} options
 */
const OpenWithContentScript = async( page, { url, html, storage = {} } ) =>
{
	await page.addInitScript( InstallFakeExtensionApi, storage );
	await page.route( url, ( route ) => route.fulfill( { contentType: 'text/html', body: html } ) );
	await page.goto( url );
	await page.addScriptTag( { path: path.join( ROOT, 'shared.js' ) } );
	await page.addScriptTag( { path: path.join( ROOT, 'content.js' ) } );

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
			<a class="btnv6_blue_hoverfade btn_medium" href="#" onclick="clicks.wishlist++; return false"><span>Add to your wishlist</span></a>
		</div>
		<div id="add_to_wishlist_area_success" ${hide( !wishlisted )}>
			<a class="btnv6_blue_hoverfade btn_medium queue_btn_active" href="#" onclick="clicks.unwishlist++; return false"><span>On Wishlist</span></a>
		</div>
		${Pair( 'follow', following, 'Follow', 'Following' )}
		${Pair( 'ignore', ignored, 'Ignore', 'Ignored' )}`
		: '<p>Sign in to add this item to your wishlist, follow it, or mark it as ignored</p>';

	return `<!doctype html>
		<title>Counter-Strike 2 on Steam</title>
		<header><a class="menuitem" href="https://store.steampowered.com/wishlist/">Wishlist</a> <input id="store_nav_search_term"></header>
		<div class="queue_actions_ctn">${actions}</div>
		<script>
			window.clicks = { wishlist: 0, unwishlist: 0, follow: 0, unfollow: 0, ignore: 0, unignore: 0 };
			window.keysSeenByPage = [];
			window.addEventListener( 'keydown', ( e ) => keysSeenByPage.push( e.code ) );
		</script>`;
};

/** A plain key shortcut, as the extension stores it */
const Key = ( letter, modifiers = {} ) => ( { code: `Key${letter}`, label: letter, ctrl: false, alt: false, shift: false, meta: false, ...modifiers } );

/**
 * Settings as the extension stores them: the defaults, with the given shortcuts and options changed
 * @param {{shortcuts?: object, storeInBackground?: boolean, steamStorePages?: boolean}} [changes]
 */
const SettingsWith = ( { shortcuts = {}, ...options } = {} ) => ( {
	shortcuts: { store: Key( 'S' ), wishlist: Key( 'W' ), follow: Key( 'F' ), ignore: Key( 'I' ), ...shortcuts },
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

module.exports = { ROOT, OpenWithContentScript, OpenOptionsPage, SteamDbPage, SteamStorePage, Key, SettingsWith, ExtensionFiles };
