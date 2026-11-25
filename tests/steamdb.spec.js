// @ts-check
'use strict';

const { test, expect } = require( '@playwright/test' );
const { OpenWithContentScript, SteamDbPage, Key, SettingsWith } = require( './helpers' );

const URL = 'https://steamdb.info/charts/';

const Clicks = ( page ) => page.evaluate( () => window.clicks );
const SentMessages = ( page ) => page.evaluate( () => window.__sentMessages );
const KeysSeenByPage = ( page ) => page.evaluate( () => window.keysSeenByPage );

test.describe( 'steamdb.info popup with the SteamDB extension', () =>
{
	test.beforeEach( async( { page } ) =>
	{
		await OpenWithContentScript( page, { url: URL, html: SteamDbPage() } );
	} );

	test( 'S opens the store page in a background tab', async( { page } ) =>
	{
		await page.keyboard.press( 'KeyS' );

		expect( await SentMessages( page ) ).toEqual( [
			{ type: 'open-store', url: 'https://store.steampowered.com/app/730/', background: true },
		] );
		expect( ( await Clicks( page ) ).navStore ).toBe( 0 );
	} );

	test( 'W, F and I press Wishlist, Follow and Ignore', async( { page } ) =>
	{
		// They share a 1 second cooldown, so wait between presses
		await page.keyboard.press( 'KeyW' );
		await page.waitForTimeout( 1100 );
		await page.keyboard.press( 'KeyF' );
		await page.waitForTimeout( 1100 );
		await page.keyboard.press( 'KeyI' );

		expect( await Clicks( page ) ).toMatchObject( { wishlist: 1, follow: 1, ignore: 1 } );
		expect( await KeysSeenByPage( page ) ).toEqual( [] );
	} );

	test( 'Wishlist, Follow and Ignore share a cooldown', async( { page } ) =>
	{
		await page.keyboard.press( 'KeyW' );
		await page.keyboard.press( 'KeyF' );

		expect( await Clicks( page ) ).toMatchObject( { wishlist: 1, follow: 0 } );

		await page.waitForTimeout( 1100 );
		await page.keyboard.press( 'KeyF' );

		expect( ( await Clicks( page ) ).follow ).toBe( 1 );
	} );

	test( 'Store has its own cooldown, so a double press opens one tab', async( { page } ) =>
	{
		await page.keyboard.press( 'KeyW' );
		await page.keyboard.press( 'KeyS' );
		await page.keyboard.press( 'KeyS' );

		expect( await SentMessages( page ) ).toHaveLength( 1 );
		expect( ( await Clicks( page ) ).wishlist ).toBe( 1 );
	} );

	test( 'keys are ignored while typing in a text field', async( { page } ) =>
	{
		await page.locator( '#search' ).focus();
		await page.keyboard.type( 'swfi' );

		expect( await page.locator( '#search' ).inputValue() ).toBe( 'swfi' );
		expect( await Clicks( page ) ).toMatchObject( { wishlist: 0, follow: 0, ignore: 0 } );
		expect( await SentMessages( page ) ).toEqual( [] );
	} );

	test( 'other keys and key combinations are left alone', async( { page } ) =>
	{
		await page.keyboard.press( 'KeyX' );
		await page.keyboard.press( 'Control+KeyS' );

		// The page also sees Ctrl itself go down; only the letters matter here
		const letters = ( await KeysSeenByPage( page ) ).filter( ( code ) => code.startsWith( 'Key' ) );
		expect( letters ).toEqual( [ 'KeyX', 'KeyS' ] );
		expect( await SentMessages( page ) ).toEqual( [] );
	} );
} );

test.describe( 'steamdb.info popup without the SteamDB extension', () =>
{
	test.beforeEach( async( { page } ) =>
	{
		await OpenWithContentScript( page, { url: URL, html: SteamDbPage( { popup: 'store-only' } ) } );
	} );

	test( 'S still opens the store page', async( { page } ) =>
	{
		await page.keyboard.press( 'KeyS' );

		expect( await SentMessages( page ) ).toHaveLength( 1 );
	} );

	test( 'W, F and I are left alone for the page', async( { page } ) =>
	{
		await page.keyboard.press( 'KeyW' );
		await page.keyboard.press( 'KeyF' );
		await page.keyboard.press( 'KeyI' );

		expect( await KeysSeenByPage( page ) ).toEqual( [ 'KeyW', 'KeyF', 'KeyI' ] );
	} );
} );

test.describe( 'when no popup is open', () =>
{
	for( const [ name, options ] of /** @type {const} */ ( [
		[ 'no popup on the page', { popup: 'none' } ],
		[ 'popup is hidden', { hidden: true } ],
		[ 'popup without the screenshot hint or other buttons', { popup: 'store-only', hint: false } ],
	] ) )
	{
		test( `nothing happens: ${name}`, async( { page } ) =>
		{
			await OpenWithContentScript( page, { url: URL, html: SteamDbPage( options ) } );
			await page.keyboard.press( 'KeyS' );
			await page.keyboard.press( 'KeyW' );

			expect( await SentMessages( page ) ).toEqual( [] );
			expect( await Clicks( page ) ).toMatchObject( { wishlist: 0, navStore: 0 } );
			expect( await KeysSeenByPage( page ) ).toEqual( [ 'KeyS', 'KeyW' ] );
		} );
	}
} );

test.describe( 'settings', () =>
{
	test( 'custom shortcuts replace the defaults', async( { page } ) =>
	{
		const settings = SettingsWith( { shortcuts: { wishlist: Key( 'Q', { ctrl: true, shift: true } ) } } );
		await OpenWithContentScript( page, { url: URL, html: SteamDbPage(), storage: { sync: { settings } } } );

		await page.keyboard.press( 'KeyW' );
		expect( ( await Clicks( page ) ).wishlist ).toBe( 0 );

		await page.keyboard.press( 'Control+Shift+KeyQ' );
		expect( ( await Clicks( page ) ).wishlist ).toBe( 1 );
	} );

	test( 'a shortcut can be turned off', async( { page } ) =>
	{
		const settings = SettingsWith( { shortcuts: { follow: null } } );
		await OpenWithContentScript( page, { url: URL, html: SteamDbPage(), storage: { sync: { settings } } } );

		await page.keyboard.press( 'KeyF' );

		expect( ( await Clicks( page ) ).follow ).toBe( 0 );
		expect( await KeysSeenByPage( page ) ).toEqual( [ 'KeyF' ] );
	} );

	test( 'the store page can open in the foreground', async( { page } ) =>
	{
		const settings = SettingsWith( { storeInBackground: false } );
		await OpenWithContentScript( page, { url: URL, html: SteamDbPage(), storage: { sync: { settings } } } );

		await page.keyboard.press( 'KeyS' );

		expect( ( await SentMessages( page ) )[ 0 ].background ).toBe( false );
	} );

	test( 'settings are read from local storage when sync is off', async( { page } ) =>
	{
		const local = { syncSettings: false, settings: SettingsWith( { shortcuts: { wishlist: Key( 'Q' ) } } ) };
		const sync = { settings: SettingsWith( { shortcuts: { wishlist: Key( 'Z' ) } } ) };
		await OpenWithContentScript( page, { url: URL, html: SteamDbPage(), storage: { sync, local } } );

		await page.keyboard.press( 'KeyQ' );

		expect( ( await Clicks( page ) ).wishlist ).toBe( 1 );
	} );

	test( 'changed settings apply without reloading the page', async( { page } ) =>
	{
		await OpenWithContentScript( page, { url: URL, html: SteamDbPage() } );

		const settings = SettingsWith( { shortcuts: { ignore: Key( 'G' ) } } );
		await page.evaluate( ( value ) => window.browser.storage.sync.set( { settings: value } ), settings );
		await page.waitForTimeout( 50 );
		await page.keyboard.press( 'KeyG' );

		expect( ( await Clicks( page ) ).ignore ).toBe( 1 );
	} );

	test( 'broken stored settings fall back to the defaults', async( { page } ) =>
	{
		const settings = { shortcuts: 'nonsense', storeInBackground: 'yes' };
		await OpenWithContentScript( page, { url: URL, html: SteamDbPage(), storage: { sync: { settings } } } );

		await page.keyboard.press( 'KeyS' );

		expect( await SentMessages( page ) ).toEqual( [
			{ type: 'open-store', url: 'https://store.steampowered.com/app/730/', background: true },
		] );
	} );
} );
