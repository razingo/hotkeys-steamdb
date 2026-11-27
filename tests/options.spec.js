// @ts-check
'use strict';

const { test, expect } = require( '@playwright/test' );
const { OpenOptionsPage, Key, SettingsWith } = require( './helpers' );

const StoredSync = ( page ) => page.evaluate( () => window.__storage.sync.settings );
const StoredLocal = ( page ) => page.evaluate( () => window.__storage.local );

// The key button's accessible name changes while recording, so find it through its row
const KeyButton = ( page, name ) => page.locator( '.row' )
	.filter( { has: page.locator( '.row-name', { hasText: new RegExp( `^${name}$` ) } ) } )
	.locator( '.key' );

test( 'shows the default shortcuts and options', async( { page } ) =>
{
	await OpenOptionsPage( page );

	await expect( KeyButton( page, 'Store' ) ).toHaveText( 'Q' );
	await expect( KeyButton( page, 'Wishlist' ) ).toHaveText( 'W' );
	await expect( KeyButton( page, 'Follow' ) ).toHaveText( 'E' );
	await expect( KeyButton( page, 'Ignore' ) ).toHaveText( 'R' );
	await expect( KeyButton( page, 'Ignore: played elsewhere' ) ).toHaveText( 'T' );
	await expect( page.locator( '#store-in-background' ) ).toBeChecked();
	await expect( page.locator( '#steam-store-pages' ) ).toBeChecked();
	await expect( page.locator( '#sync-settings' ) ).toBeChecked();
} );

test( 'shows stored shortcuts', async( { page } ) =>
{
	await OpenOptionsPage( page, { sync: { settings: SettingsWith( { shortcuts: { wishlist: Key( 'Q', { ctrl: true } ), ignore: null } } ) } } );

	await expect( KeyButton( page, 'Wishlist' ) ).toHaveText( 'Ctrl + Q' );
	await expect( KeyButton( page, 'Ignore' ) ).toHaveText( 'Off' );
} );

test( 'records a new shortcut, with modifiers', async( { page } ) =>
{
	await OpenOptionsPage( page );

	await KeyButton( page, 'Wishlist' ).click();
	await expect( KeyButton( page, 'Wishlist' ) ).toHaveText( 'Press a key…' );
	await page.keyboard.press( 'Alt+KeyQ' );

	await expect( KeyButton( page, 'Wishlist' ) ).toContainText( 'Q' );
	expect( ( await StoredSync( page ) ).shortcuts.wishlist ).toMatchObject( { code: 'KeyQ', label: 'Q', alt: true, ctrl: false } );
} );

test( 'refuses a key that another shortcut uses', async( { page } ) =>
{
	await OpenOptionsPage( page );

	await KeyButton( page, 'Wishlist' ).click();
	await page.keyboard.press( 'KeyQ' );

	await expect( page.getByText( 'Q is already used by Store.' ) ).toBeVisible();
	await expect( KeyButton( page, 'Wishlist' ) ).toHaveText( 'W' );
} );

test( 'refuses Tab', async( { page } ) =>
{
	await OpenOptionsPage( page );

	await KeyButton( page, 'Follow' ).click();
	await page.keyboard.press( 'Tab' );

	await expect( page.getByText( 'Tab is needed to move around pages' ) ).toBeVisible();
} );

test( 'refuses shortcuts the browser keeps for itself', async( { page } ) =>
{
	await OpenOptionsPage( page );

	await KeyButton( page, 'Follow' ).click();

	// Sent as a DOM event, so the test browser doesn't actually open a tab
	await page.evaluate( () => document.dispatchEvent( new KeyboardEvent( 'keydown', {
		key: 't', code: 'KeyT', ctrlKey: !/Mac/.test( navigator.platform ), metaKey: /Mac/.test( navigator.platform ), bubbles: true,
	} ) ) );

	await expect( page.getByText( /is the browser's shortcut to open a new tab, and browsers don't let extensions use it/ ) ).toBeVisible();
	await expect( KeyButton( page, 'Follow' ) ).toHaveText( 'E' );
} );

test( 'warns about a common browser shortcut, but keeps it', async( { page } ) =>
{
	await OpenOptionsPage( page );

	await KeyButton( page, 'Follow' ).click();
	await page.keyboard.press( 'ControlOrMeta+KeyF' );

	await expect( page.getByText( /is also the browser's shortcut to find in the page\. On SteamDB popups and the Steam store, it will do Follow instead\./ ) ).toBeVisible();
	expect( ( await StoredSync( page ) ).shortcuts.follow.code ).toBe( 'KeyF' );

	// The warning goes away with a different key
	await KeyButton( page, 'Follow' ).click();
	await page.keyboard.press( 'KeyG' );

	await expect( page.locator( '.row-warning:visible' ) ).toHaveCount( 0 );
} );

test( 'shows the warning for stored shortcuts too', async( { page } ) =>
{
	await OpenOptionsPage( page, { sync: { settings: SettingsWith( { shortcuts: { wishlist: { code: 'Space', label: 'Space', ctrl: false, alt: false, shift: false, meta: false } } } ) } } );

	await expect( page.getByText( 'Space is also the browser\'s shortcut to scroll down.', { exact: false } ) ).toBeVisible();
} );

test( 'Escape cancels and Backspace turns a shortcut off', async( { page } ) =>
{
	await OpenOptionsPage( page );

	await KeyButton( page, 'Follow' ).click();
	await page.keyboard.press( 'Escape' );
	await expect( KeyButton( page, 'Follow' ) ).toHaveText( 'E' );

	await KeyButton( page, 'Follow' ).click();
	await page.keyboard.press( 'Backspace' );
	await expect( KeyButton( page, 'Follow' ) ).toHaveText( 'Off' );
	expect( ( await StoredSync( page ) ).shortcuts.follow ).toBeNull();
} );

test( 'the × button turns a shortcut off', async( { page } ) =>
{
	await OpenOptionsPage( page );

	await page.getByRole( 'button', { name: 'Turn off Ignore shortcut' } ).click();

	await expect( KeyButton( page, 'Ignore' ) ).toHaveText( 'Off' );
	expect( ( await StoredSync( page ) ).shortcuts.ignore ).toBeNull();
} );

test( 'options are saved', async( { page } ) =>
{
	await OpenOptionsPage( page );

	await page.locator( '#store-in-background' ).uncheck();
	await page.locator( '#steam-store-pages' ).uncheck();

	await expect.poll( () => StoredSync( page ) ).toMatchObject( { storeInBackground: false, steamStorePages: false } );
} );

test( 'turning sync off keeps the settings, in this browser only', async( { page } ) =>
{
	const settings = SettingsWith( { shortcuts: { wishlist: Key( 'Z' ) } } );
	await OpenOptionsPage( page, { sync: { settings } } );

	await page.locator( '#sync-settings' ).uncheck();

	await expect.poll( () => StoredLocal( page ) ).toMatchObject( { syncSettings: false, settings: { shortcuts: { wishlist: { code: 'KeyZ' } } } } );
	await expect( page.getByText( 'Sync turned off' ) ).toBeVisible();

	// Changes now go to local storage, and the synced copy stays as it was for other browsers
	await KeyButton( page, 'Follow' ).click();
	await page.keyboard.press( 'KeyG' );

	await expect.poll( async() => ( await StoredLocal( page ) ).settings.shortcuts.follow.code ).toBe( 'KeyG' );
	expect( ( await StoredSync( page ) ).shortcuts.follow.code ).toBe( 'KeyE' );
} );

test( 'turning sync back on uploads this browser\'s settings', async( { page } ) =>
{
	const local = { syncSettings: false, settings: SettingsWith( { shortcuts: { wishlist: Key( 'Z' ) } } ) };
	await OpenOptionsPage( page, { local } );

	await expect( page.locator( '#sync-settings' ) ).not.toBeChecked();
	await expect( KeyButton( page, 'Wishlist' ) ).toHaveText( 'Z' );

	await page.locator( '#sync-settings' ).check();

	await expect.poll( async() => ( await StoredSync( page ) )?.shortcuts.wishlist.code ).toBe( 'KeyZ' );
} );

test( 'reset restores the defaults', async( { page } ) =>
{
	await OpenOptionsPage( page, { sync: { settings: SettingsWith( { shortcuts: { store: Key( 'Z' ) }, steamStorePages: false } ) } } );

	await page.getByRole( 'button', { name: 'Reset to defaults' } ).click();

	await expect( KeyButton( page, 'Store' ) ).toHaveText( 'Q' );
	await expect( page.locator( '#steam-store-pages' ) ).toBeChecked();
	await expect.poll( async() => ( await StoredSync( page ) ).shortcuts.store.code ).toBe( 'KeyQ' );
} );

test( 'About tab shows the links', async( { page } ) =>
{
	await OpenOptionsPage( page );

	await page.getByRole( 'tab', { name: 'About' } ).click();

	await expect( page.getByRole( 'link', { name: 'github.com/razingo/hotkeys-steamdb' } ) ).toHaveAttribute( 'href', 'https://github.com/razingo/hotkeys-steamdb' );
	await expect( page.getByRole( 'link', { name: /Buy me a coffee/ } ) ).toHaveAttribute( 'href', 'https://buymeacoffee.com/razingo' );
	await expect( page.getByRole( 'link', { name: /GitHub/ } ).last() ).toHaveAttribute( 'href', 'https://github.com/razingo/hotkeys-steamdb' );
} );
