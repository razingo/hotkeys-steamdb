// @ts-check
'use strict';

const { test, expect } = require( '@playwright/test' );
const { OpenWithContentScript, SteamListPage, SettingsWith } = require( './helpers' );

const URL = 'https://store.steampowered.com/';

const Clicks = ( page ) => page.evaluate( () => window.clicks );
const KeysSeenByPage = ( page ) => page.evaluate( () => window.keysSeenByPage );

test( 'W adds a hovered game to the wishlist', async( { page } ) =>
{
	await OpenWithContentScript( page, { url: URL, html: SteamListPage() } );
	await page.hover( '[data-ds-appid="111"]' );
	await page.keyboard.press( 'KeyW' );

	await expect.poll( async() => ( await Clicks( page ) ).wishlist ).toEqual( [ '111' ] );
	expect( await Clicks( page ) ).toMatchObject( { ignore: [], opened: 0 } );
	expect( await KeysSeenByPage( page ) ).toEqual( [] );
} );

test( 'R ignores the game under the mouse', async( { page } ) =>
{
	await OpenWithContentScript( page, { url: URL, html: SteamListPage() } );
	await page.hover( '[data-ds-appid="222"]' );
	await page.keyboard.press( 'KeyR' );

	await expect.poll( async() => ( await Clicks( page ) ).ignore ).toEqual( [ '222' ] );
} );

test( 'W on a game that\'s already wishlisted removes it', async( { page } ) =>
{
	await OpenWithContentScript( page, { url: URL, html: SteamListPage( { wishlisted: true } ) } );
	await page.hover( '[data-ds-appid="111"]' );
	await page.keyboard.press( 'KeyW' );

	await expect.poll( async() => ( await Clicks( page ) ).wishlist ).toEqual( [ 'remove:111' ] );
} );

test( 'without Steam\'s own wishlist functions, W falls back to the row\'s options menu', async( { page } ) =>
{
	await OpenWithContentScript( page, { url: URL, html: SteamListPage( { dynamicStore: false, wishlisted: true } ) } );
	await page.hover( '[data-ds-appid="111"]' );
	await page.keyboard.press( 'KeyW' );

	// The menu offers "Remove from your wishlist" for a wishlisted game; the mock records the chosen option
	await expect.poll( async() => ( await Clicks( page ) ).wishlist ).toEqual( [ '111' ] );
} );

test( 'Q on a hovered game opens its store page in a background tab', async( { page } ) =>
{
	await OpenWithContentScript( page, { url: URL, html: SteamListPage() } );
	await page.hover( '[data-ds-appid="111"]' );
	await page.keyboard.press( 'KeyQ' );

	expect( await page.evaluate( () => window.__sentMessages ) ).toEqual( [
		{ type: 'open-store', url: 'https://store.steampowered.com/app/111/Fleshborn/', background: true },
	] );
	expect( ( await Clicks( page ) ).opened ).toBe( 0 );
} );

test( 'E and T are left alone: list menus don\'t have them', async( { page } ) =>
{
	await OpenWithContentScript( page, { url: URL, html: SteamListPage() } );
	await page.hover( '[data-ds-appid="111"]' );
	await page.keyboard.press( 'KeyE' );
	await page.keyboard.press( 'KeyT' );

	expect( await KeysSeenByPage( page ) ).toEqual( [ 'KeyE', 'KeyT' ] );
} );

test( 'keys are left alone when the mouse isn\'t over a game', async( { page } ) =>
{
	await OpenWithContentScript( page, { url: URL, html: SteamListPage() } );
	await page.hover( 'header' );
	await page.keyboard.press( 'KeyW' );
	await page.keyboard.press( 'KeyQ' );

	expect( await KeysSeenByPage( page ) ).toEqual( [ 'KeyW', 'KeyQ' ] );
	expect( await page.evaluate( () => window.__sentMessages ) ).toEqual( [] );
} );

test( 'when there\'s nothing to do, the amber flash doesn\'t leave the highlight stuck', async( { page } ) =>
{
	// No Steam wishlist functions and no options menu: the row flashes amber and nothing else happens
	const html = SteamListPage( { dynamicStore: false } ).replaceAll( '<div class="ds_options"><div></div></div>', '' );
	await OpenWithContentScript( page, { url: URL, html } );
	const row = page.locator( '[data-ds-appid="111"]' );

	await row.hover();
	await page.keyboard.press( 'KeyW' );

	await expect( row ).toHaveCSS( 'outline-style', 'none', { timeout: 1000 } );
	await expect( row ).toHaveCSS( 'box-shadow', 'none', { timeout: 1000 } );
} );

test( 'signed out: W is left alone', async( { page } ) =>
{
	await OpenWithContentScript( page, { url: URL, html: SteamListPage( { signedIn: false } ) } );
	await page.hover( '[data-ds-appid="111"]' );
	await page.keyboard.press( 'KeyW' );

	expect( await KeysSeenByPage( page ) ).toEqual( [ 'KeyW' ] );
} );

test( 'turned off with the Steam store setting', async( { page } ) =>
{
	const settings = SettingsWith( { steamStorePages: false } );
	await OpenWithContentScript( page, { url: URL, html: SteamListPage(), storage: { sync: { settings } } } );
	await page.hover( '[data-ds-appid="111"]' );
	await page.keyboard.press( 'KeyW' );

	expect( await KeysSeenByPage( page ) ).toEqual( [ 'KeyW' ] );
} );
