// @ts-check
'use strict';

const { test, expect } = require( '@playwright/test' );
const { OpenWithContentScript, SteamSalePage } = require( './helpers' );

const URL = 'https://store.steampowered.com/specials?snr=1_4_4_';

const Clicks = ( page ) => page.evaluate( () => window.clicks );
const KeysSeenByPage = ( page ) => page.evaluate( () => window.keysSeenByPage );

test( 'W presses the hovered tile\'s wishlist button, and again to remove', async( { page } ) =>
{
	await OpenWithContentScript( page, { url: URL, html: SteamSalePage() } );
	await page.hover( '.tile[data-app="2222"] img' );
	await page.keyboard.press( 'KeyW' );
	await page.waitForTimeout( 1100 );
	await page.keyboard.press( 'KeyW' );

	expect( ( await Clicks( page ) ).wishlist ).toEqual( [ '2222', 'remove:2222' ] );
	expect( await KeysSeenByPage( page ) ).toEqual( [] );
} );

test( 'Q opens the hovered tile\'s game in a background tab', async( { page } ) =>
{
	await OpenWithContentScript( page, { url: URL, html: SteamSalePage() } );
	await page.hover( '.tile[data-app="1111"] img' );
	await page.keyboard.press( 'KeyQ' );

	expect( await page.evaluate( () => window.__sentMessages ) ).toEqual( [
		{ type: 'open-store', url: 'https://store.steampowered.com/app/1111/Castaway?snr=1_2300_4', background: true },
	] );
	expect( ( await Clicks( page ) ).opened ).toBe( 0 );
} );

test( 'R is left alone: sale tiles have no Ignore', async( { page } ) =>
{
	await OpenWithContentScript( page, { url: URL, html: SteamSalePage() } );
	await page.hover( '.tile[data-app="1111"] img' );
	await page.keyboard.press( 'KeyR' );

	expect( await KeysSeenByPage( page ) ).toEqual( [ 'KeyR' ] );
} );

test( 'signed out: tiles have no wishlist button, so W is left alone', async( { page } ) =>
{
	await OpenWithContentScript( page, { url: URL, html: SteamSalePage( { signedIn: false } ) } );
	await page.hover( '.tile[data-app="1111"] img' );
	await page.keyboard.press( 'KeyW' );

	expect( ( await Clicks( page ) ).wishlist ).toEqual( [] );
	expect( await KeysSeenByPage( page ) ).toEqual( [ 'KeyW' ] );
} );
