// @ts-check
'use strict';

// Loads the real, packaged extension into Chromium and uses it on fake steamdb.info and Steam store pages.
// This covers what the other tests fake: the manifest, the background script, opening the store tab,
// and content scripts running in their own context, separate from the page's scripts.
// Playwright can only load extensions into Chromium, so this doesn't run for Firefox.

const fs = require( 'node:fs' );
const os = require( 'node:os' );
const path = require( 'node:path' );
const { test, expect, chromium } = require( '@playwright/test' );
const { ROOT, SteamDbPage, SteamStorePage, SteamListPage, SteamFrontPage, SteamSalePage, ExtensionFiles } = require( './helpers' );

test.skip( ( { browserName } ) => browserName !== 'chromium', 'Playwright can only load extensions into Chromium' );

/** Copies just the packaged files, as in the ZIP, so the test uses what users get */
const CopyExtension = () =>
{
	const dir = fs.mkdtempSync( path.join( os.tmpdir(), 'hotkeys-steamdb-' ) );

	for( const file of ExtensionFiles() )
	{
		fs.mkdirSync( path.dirname( path.join( dir, file ) ), { recursive: true } );
		fs.copyFileSync( path.join( ROOT, file ), path.join( dir, file ) );
	}

	return dir;
};

/** @type {import('@playwright/test').BrowserContext} */
let context;
let extension = '';

test.beforeEach( async() =>
{
	extension = CopyExtension();
	context = await chromium.launchPersistentContext( '', {
		channel: 'chromium',
		args: [ `--disable-extensions-except=${extension}`, `--load-extension=${extension}` ],
	} );
} );

test.afterEach( async() =>
{
	await context?.close();
	fs.rmSync( extension, { recursive: true, force: true } );
} );

/** Content scripts start at document_idle: press the key until the extension handles it (the page sees it until then) */
const PressUntilClicked = async( page, key, counter ) =>
{
	await expect.poll( async() =>
	{
		await page.keyboard.press( key );
		return page.evaluate( ( name ) => window.clicks[ name ], counter );
	}, { timeout: 10_000 } ).toBeGreaterThan( 0 );
};

test( 'on steamdb.info, the packaged extension presses buttons and opens the store page in a new tab', async() =>
{
	await context.route( 'https://steamdb.info/**', ( route ) => route.fulfill( { contentType: 'text/html', body: SteamDbPage() } ) );
	await context.route( 'https://store.steampowered.com/**', ( route ) => route.fulfill( { contentType: 'text/html', body: '<title>Steam</title>' } ) );

	// The background script started without errors
	const worker = context.serviceWorkers()[ 0 ] ?? await context.waitForEvent( 'serviceworker' );
	expect( worker.url() ).toMatch( /^chrome-extension:\/\/[a-p]{32}\/background\.js$/ );

	const page = await context.newPage();
	await page.goto( 'https://steamdb.info/charts/' );
	await PressUntilClicked( page, 'KeyW', 'wishlist' );

	const storeTab = context.waitForEvent( 'page' );
	await page.keyboard.press( 'KeyQ' );

	expect( ( await storeTab ).url() ).toBe( 'https://store.steampowered.com/app/730/' );
} );

// Steam's Wishlist button is a javascript: link. Clicking it from a content script does nothing,
// so steam-page-click.js does the click from the page's own context.
test( 'on a Steam store page, the packaged extension presses Wishlist (a javascript: link) and Follow', async() =>
{
	await context.route( 'https://store.steampowered.com/**', ( route ) => route.fulfill( { contentType: 'text/html', body: SteamStorePage() } ) );

	const page = await context.newPage();
	await page.goto( 'https://store.steampowered.com/app/730/CounterStrike_2/' );
	await PressUntilClicked( page, 'KeyW', 'wishlist' );

	await page.waitForTimeout( 1100 );
	await page.keyboard.press( 'KeyE' );

	expect( await page.evaluate( () => window.clicks ) ).toMatchObject( { wishlist: 1, follow: 1 } );
} );

test( 'in a Steam store list, the packaged extension picks "Add to your wishlist" from a hovered game\'s menu', async() =>
{
	await context.route( 'https://store.steampowered.com/**', ( route ) => route.fulfill( { contentType: 'text/html', body: SteamListPage() } ) );

	const page = await context.newPage();
	await page.goto( 'https://store.steampowered.com/' );
	await page.hover( '[data-ds-appid="111"]' );

	// Content scripts start at document_idle: press until the extension handles it
	await expect.poll( async() =>
	{
		await page.keyboard.press( 'KeyW' );
		await page.waitForTimeout( 100 );
		return page.evaluate( () => window.clicks.wishlist.length );
	}, { timeout: 10_000 } ).toBeGreaterThan( 0 );

	expect( ( await page.evaluate( () => window.clicks.wishlist ) )[ 0 ] ).toBe( '111' );
} );

/** Hovers a game and presses a key until the extension has started and the counter moves */
const HoverAndPressUntil = async( page, selector, key, Counter ) =>
{
	await page.hover( selector );
	await expect.poll( async() =>
	{
		await page.keyboard.press( key );
		await page.waitForTimeout( 150 );
		return page.evaluate( Counter );
	}, { timeout: 10_000 } ).toBeGreaterThan( 0 );
};

test( 'on Steam\'s front page, the packaged extension uses a capsule\'s "..." menu', async() =>
{
	await context.route( 'https://store.steampowered.com/**', ( route ) => route.fulfill( { contentType: 'text/html', body: SteamFrontPage() } ) );

	const page = await context.newPage();
	await page.goto( 'https://store.steampowered.com/' );
	await HoverAndPressUntil( page, 'a[href*="/app/555/"]', 'KeyW', () => window.clicks.capsuleWishlist.length );

	expect( ( await page.evaluate( () => window.clicks.capsuleWishlist ) )[ 0 ] ).toBe( '555' );
} );

test( 'on a Steam sale page, the packaged extension presses a tile\'s wishlist button', async() =>
{
	await context.route( 'https://store.steampowered.com/**', ( route ) => route.fulfill( { contentType: 'text/html', body: SteamSalePage() } ) );

	const page = await context.newPage();
	await page.goto( 'https://store.steampowered.com/specials' );
	await HoverAndPressUntil( page, '.tile[data-app="1111"] img', 'KeyW', () => window.clicks.wishlist.length );

	expect( ( await page.evaluate( () => window.clicks.wishlist ) )[ 0 ] ).toBe( '1111' );
} );
