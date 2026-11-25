// @ts-check
'use strict';

// Loads the real, packaged extension into Chromium and uses it on a fake steamdb.info page.
// This covers what the other tests fake: the manifest, the background script and opening the store tab.
// Playwright can only load extensions into Chromium, so this doesn't run for Firefox.

const fs = require( 'node:fs' );
const os = require( 'node:os' );
const path = require( 'node:path' );
const { test, expect, chromium } = require( '@playwright/test' );
const { ROOT, SteamDbPage, ExtensionFiles } = require( './helpers' );

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

test( 'the packaged extension opens the store page in a new tab', async() =>
{
	const extension = CopyExtension();
	const context = await chromium.launchPersistentContext( '', {
		channel: 'chromium',
		args: [ `--disable-extensions-except=${extension}`, `--load-extension=${extension}` ],
	} );

	try
	{
		await context.route( 'https://steamdb.info/**', ( route ) => route.fulfill( { contentType: 'text/html', body: SteamDbPage() } ) );
		await context.route( 'https://store.steampowered.com/**', ( route ) => route.fulfill( { contentType: 'text/html', body: '<title>Steam</title>' } ) );

		// The background script started without errors
		const worker = context.serviceWorkers()[ 0 ] ?? await context.waitForEvent( 'serviceworker' );
		expect( worker.url() ).toMatch( /^chrome-extension:\/\/[a-p]{32}\/background\.js$/ );

		const page = await context.newPage();
		await page.goto( 'https://steamdb.info/charts/' );

		// Content scripts start at document_idle; wait until the extension handles W (it's left alone until then)
		await expect.poll( async() =>
		{
			await page.keyboard.press( 'KeyW' );
			return page.evaluate( () => window.clicks.wishlist );
		}, { timeout: 10_000 } ).toBeGreaterThan( 0 );

		const storeTab = context.waitForEvent( 'page' );
		await page.keyboard.press( 'KeyS' );

		expect( ( await storeTab ).url() ).toBe( 'https://store.steampowered.com/app/730/' );
	}
	finally
	{
		await context.close();
		fs.rmSync( extension, { recursive: true, force: true } );
	}
} );
