// @ts-check
'use strict';

const { test, expect } = require( '@playwright/test' );
const { OpenWithContentScript, SteamFrontPage, SteamStorePage } = require( './helpers' );

const Clicks = ( page ) => page.evaluate( () => window.clicks );
const KeysSeenByPage = ( page ) => page.evaluate( () => window.keysSeenByPage );
const SentMessages = ( page ) => page.evaluate( () => window.__sentMessages );

const OpenStoreMessage = ( url ) => ( { type: 'open-store', url, background: true } );

// Wishlist and Ignore share a 1 second cooldown
const Cooldown = ( page ) => page.waitForTimeout( 1100 );

const OpenFrontPage = ( { page } ) => OpenWithContentScript( page, { url: 'https://store.steampowered.com/', html: SteamFrontPage() } );

test.describe( 'recommendation box', () =>
{
	test.beforeEach( OpenFrontPage );

	test( 'W removes a wishlisted game and adds it back, using Steam\'s own functions, not the add-only button', async( { page } ) =>
	{
		await page.hover( '.box-screenshot' );
		await page.keyboard.press( 'KeyW' );
		await Cooldown( page );
		await page.keyboard.press( 'KeyW' );

		expect( await Clicks( page ) ).toMatchObject( { wishlist: [ 'remove:333', '333' ], boxButtonWishlist: 0, headerWishlist: 0 } );
		expect( await KeysSeenByPage( page ) ).toEqual( [] );
	} );

	test( 'the "ON WISHLIST" and "IGNORED" look updates right away, without waiting for Steam\'s server', async( { page } ) =>
	{
		// The mock's server answers after 300 ms; the look must change well before that
		const item = page.locator( '.home_content [data-ds-appid="333"]' );
		const fast = { timeout: 150 };
		await page.hover( '.box-screenshot' );

		await page.keyboard.press( 'KeyW' );
		await expect( item ).not.toHaveClass( /ds_wishlist/, fast );

		await Cooldown( page );
		await page.keyboard.press( 'KeyR' );
		await expect( item ).toHaveClass( /ds_ignored/, fast );

		await Cooldown( page );
		await page.keyboard.press( 'KeyR' );
		await expect( item ).not.toHaveClass( /ds_ignored/, fast );
	} );

	test( 'the thin margin around the box counts as the box', async( { page } ) =>
	{
		await page.evaluate( () =>
		{
			const box = document.querySelector( '.home_content.single' );
			const ctn = document.createElement( 'div' );
			ctn.className = 'home_content_single_ctn';
			ctn.style.padding = '20px';
			box.replaceWith( ctn );
			ctn.append( box );
		} );
		const margin = await page.locator( '.home_content_single_ctn' ).boundingBox();
		await page.mouse.move( margin.x + 5, margin.y + 5 );
		await page.keyboard.press( 'KeyW' );

		expect( await Clicks( page ) ).toMatchObject( { wishlist: [ 'remove:333' ], boxButtonWishlist: 0 } );
	} );

	test( 'R ignores and unignores, anywhere over the box (here its buttons)', async( { page } ) =>
	{
		await page.hover( '.home_content .actions' );
		await page.keyboard.press( 'KeyR' );
		await Cooldown( page );
		await page.keyboard.press( 'KeyR' );

		expect( await Clicks( page ) ).toMatchObject( { ignore: [ '333', 'remove:333' ], boxButtonIgnore: 0 } );
	} );

	test( 'Q opens the box\'s game in a background tab', async( { page } ) =>
	{
		await page.hover( '.home_content .title' );
		await page.keyboard.press( 'KeyQ' );

		expect( await SentMessages( page ) ).toEqual( [ OpenStoreMessage( 'https://store.steampowered.com/app/333/The_Wolf_Among_Us/?snr=1_239' ) ] );
		expect( ( await Clicks( page ) ).opened ).toBe( 0 );
	} );

	test( 'hovering "Since you wish for ..." is about that other game: Q opens it, W is left alone', async( { page } ) =>
	{
		await page.hover( '#since' );
		await page.keyboard.press( 'KeyQ' );
		await page.keyboard.press( 'KeyW' );

		expect( await SentMessages( page ) ).toEqual( [ OpenStoreMessage( 'https://store.steampowered.com/app/777/Golden_Idol/' ) ] );
		expect( ( await Clicks( page ) ).wishlist ).toEqual( [] );
		expect( await KeysSeenByPage( page ) ).toEqual( [ 'KeyW' ] );
	} );

	test( 'an older box without Steam\'s game data: W and R press its own buttons', async( { page } ) =>
	{
		await page.hover( '.older-title' );
		await page.keyboard.press( 'KeyW' );
		await Cooldown( page );
		await page.keyboard.press( 'KeyR' );

		expect( await Clicks( page ) ).toMatchObject( { olderBoxWishlist: 1, olderBoxIgnore: 1, wishlist: [] } );
	} );
} );

test.describe( 'capsules', () =>
{
	test.beforeEach( OpenFrontPage );

	test( 'W adds and removes through the capsule\'s "..." menu', async( { page } ) =>
	{
		await page.hover( 'a[href*="/app/555/"]' );
		await page.keyboard.press( 'KeyW' );
		await expect.poll( async() => ( await Clicks( page ) ).capsuleWishlist ).toEqual( [ '555' ] );

		await Cooldown( page );
		await page.keyboard.press( 'KeyW' );
		await expect.poll( async() => ( await Clicks( page ) ).capsuleWishlist ).toEqual( [ '555', 'remove:555' ] );
		expect( await KeysSeenByPage( page ) ).toEqual( [] );
	} );

	test( 'R picks "Ignore Game" from the hovered capsule\'s menu', async( { page } ) =>
	{
		await page.hover( 'a[href*="/app/444/"]' );
		await page.keyboard.press( 'KeyR' );

		await expect.poll( async() => ( await Clicks( page ) ).capsuleIgnore ).toEqual( [ '444' ] );
	} );

	test( 'Q opens the hovered capsule\'s game', async( { page } ) =>
	{
		await page.hover( 'a[href*="/app/555/"]' );
		await page.keyboard.press( 'KeyQ' );

		expect( await SentMessages( page ) ).toEqual( [ OpenStoreMessage( 'https://store.steampowered.com/app/555/Cat_Cafe/' ) ] );
	} );

	test( 'empty space between capsules: keys are left alone, and the box isn\'t touched', async( { page } ) =>
	{
		await page.hover( '.capsules .gap' );
		await page.keyboard.press( 'KeyW' );

		expect( await Clicks( page ) ).toMatchObject( { wishlist: [], capsuleWishlist: [], boxButtonWishlist: 0 } );
		expect( await KeysSeenByPage( page ) ).toEqual( [ 'KeyW' ] );
	} );
} );

test.describe( 'other links', () =>
{
	test.beforeEach( OpenFrontPage );

	test( 'a plain link to a game: Q opens it, W and R are left alone', async( { page } ) =>
	{
		await page.hover( '#plain-game' );
		await page.keyboard.press( 'KeyQ' );
		await page.keyboard.press( 'KeyW' );
		await page.keyboard.press( 'KeyR' );

		expect( await SentMessages( page ) ).toEqual( [ OpenStoreMessage( 'https://store.steampowered.com/app/888/Plain/' ) ] );
		expect( await KeysSeenByPage( page ) ).toEqual( [ 'KeyW', 'KeyR' ] );
	} );

	test( 'the header\'s "Wishlist" link is never pressed', async( { page } ) =>
	{
		await page.hover( '#header-wishlist' );
		await page.keyboard.press( 'KeyW' );

		expect( await Clicks( page ) ).toMatchObject( { headerWishlist: 0, wishlist: [] } );
		expect( await KeysSeenByPage( page ) ).toEqual( [ 'KeyW' ] );
	} );
} );

test.describe( 'Steam game page with links to other games', () =>
{
	const URL = 'https://store.steampowered.com/app/730/CounterStrike_2/';
	const html = SteamStorePage().replace( '</header>', '</header><a id="other-game" href="https://store.steampowered.com/app/999/Other/" style="display: block; height: 50px" onclick="return false">More like this</a><a id="same-game" href="https://store.steampowered.com/app/730/CounterStrike_2/" style="display: block; height: 50px" onclick="return false">Counter-Strike 2</a>' );

	test( 'game page: hovering another game, Q opens it and W doesn\'t wishlist the page\'s game', async( { page } ) =>
	{
		await OpenWithContentScript( page, { url: URL, html } );
		await page.hover( '#other-game' );
		await page.keyboard.press( 'KeyQ' );
		await page.keyboard.press( 'KeyW' );

		expect( await SentMessages( page ) ).toEqual( [ OpenStoreMessage( 'https://store.steampowered.com/app/999/Other/' ) ] );
		expect( ( await Clicks( page ) ).wishlist ).toBe( 0 );
	} );

	test( 'game page: hovering a link to the same game, the page\'s own buttons still work', async( { page } ) =>
	{
		await OpenWithContentScript( page, { url: URL, html } );
		await page.hover( '#same-game' );
		await page.keyboard.press( 'KeyW' );

		// Steam's Wishlist button is a javascript: link, which runs a moment after the click
		await expect.poll( async() => ( await Clicks( page ) ).wishlist ).toBe( 1 );
	} );
} );
