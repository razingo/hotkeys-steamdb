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

	await expect( KeyButton( page, 'Store' ) ).toHaveText( 'S' );
	await expect( KeyButton( page, 'Wishlist' ) ).toHaveText( 'W' );
	await expect( KeyButton( page, 'Follow' ) ).toHaveText( 'F' );
	await expect( KeyButton( page, 'Ignore' ) ).toHaveText( 'I' );
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
	await page.keyboard.press( 'KeyS' );

	await expect( page.getByText( 'S is already used by Store.' ) ).toBeVisible();
	await expect( KeyButton( page, 'Wishlist' ) ).toHaveText( 'W' );
} );

test( 'refuses Tab', async( { page } ) =>
{
	await OpenOptionsPage( page );

	await KeyButton( page, 'Follow' ).click();
	await page.keyboard.press( 'Tab' );

	await expect( page.getByText( 'Tab is needed to move around pages' ) ).toBeVisible();
} );

test( 'Escape cancels and Backspace turns a shortcut off', async( { page } ) =>
{
	await OpenOptionsPage( page );

	await KeyButton( page, 'Follow' ).click();
	await page.keyboard.press( 'Escape' );
	await expect( KeyButton( page, 'Follow' ) ).toHaveText( 'F' );

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
	const settings = SettingsWith( { shortcuts: { wishlist: Key( 'Q' ) } } );
	await OpenOptionsPage( page, { sync: { settings } } );

	await page.locator( '#sync-settings' ).uncheck();

	await expect.poll( () => StoredLocal( page ) ).toMatchObject( { syncSettings: false, settings: { shortcuts: { wishlist: { code: 'KeyQ' } } } } );
	await expect( page.getByText( 'Sync turned off' ) ).toBeVisible();

	// Changes now go to local storage, and the synced copy stays as it was for other browsers
	await KeyButton( page, 'Follow' ).click();
	await page.keyboard.press( 'KeyG' );

	await expect.poll( async() => ( await StoredLocal( page ) ).settings.shortcuts.follow.code ).toBe( 'KeyG' );
	expect( ( await StoredSync( page ) ).shortcuts.follow.code ).toBe( 'KeyF' );
} );

test( 'turning sync back on uploads this browser\'s settings', async( { page } ) =>
{
	const local = { syncSettings: false, settings: SettingsWith( { shortcuts: { wishlist: Key( 'Q' ) } } ) };
	await OpenOptionsPage( page, { local } );

	await expect( page.locator( '#sync-settings' ) ).not.toBeChecked();
	await expect( KeyButton( page, 'Wishlist' ) ).toHaveText( 'Q' );

	await page.locator( '#sync-settings' ).check();

	await expect.poll( async() => ( await StoredSync( page ) )?.shortcuts.wishlist.code ).toBe( 'KeyQ' );
} );

test( 'reset restores the defaults', async( { page } ) =>
{
	await OpenOptionsPage( page, { sync: { settings: SettingsWith( { shortcuts: { store: Key( 'Q' ) }, steamStorePages: false } ) } } );

	await page.getByRole( 'button', { name: 'Reset to defaults' } ).click();

	await expect( KeyButton( page, 'Store' ) ).toHaveText( 'S' );
	await expect( page.locator( '#steam-store-pages' ) ).toBeChecked();
	await expect.poll( async() => ( await StoredSync( page ) ).shortcuts.store.code ).toBe( 'KeyS' );
} );

test( 'About tab shows the links', async( { page } ) =>
{
	await OpenOptionsPage( page );

	await page.getByRole( 'tab', { name: 'About' } ).click();

	await expect( page.getByRole( 'link', { name: 'github.com/razingo/hotkeys-steamdb' } ) ).toHaveAttribute( 'href', 'https://github.com/razingo/hotkeys-steamdb' );
	await expect( page.getByRole( 'link', { name: /Buy me a coffee/ } ) ).toHaveAttribute( 'href', 'https://buymeacoffee.com/razingo' );
	await expect( page.getByRole( 'link', { name: /GitHub/ } ).last() ).toHaveAttribute( 'href', 'https://github.com/razingo/hotkeys-steamdb' );
} );
