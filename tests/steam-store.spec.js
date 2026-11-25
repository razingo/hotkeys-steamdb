// @ts-check
'use strict';

const { test, expect } = require( '@playwright/test' );
const { OpenWithContentScript, SteamStorePage, SettingsWith } = require( './helpers' );

const URL = 'https://store.steampowered.com/app/730/CounterStrike_2/';

const Clicks = ( page ) => page.evaluate( () => window.clicks );
const KeysSeenByPage = ( page ) => page.evaluate( () => window.keysSeenByPage );

// Wishlist, Follow and Ignore share a 1 second cooldown
const PressEach = async( page, keys ) =>
{
	for( const [ index, key ] of keys.entries() )
	{
		if( index > 0 )
		{
			await page.waitForTimeout( 1100 );
		}

		await page.keyboard.press( key );
	}
};

test( 'W, F and I press Steam\'s Wishlist, Follow and Ignore buttons', async( { page } ) =>
{
	await OpenWithContentScript( page, { url: URL, html: SteamStorePage() } );
	await PressEach( page, [ 'KeyW', 'KeyF', 'KeyI' ] );

	expect( await Clicks( page ) ).toEqual( { wishlist: 1, unwishlist: 0, follow: 1, unfollow: 0, ignore: 1, unignore: 0 } );
	expect( await KeysSeenByPage( page ) ).toEqual( [] );
} );

test( 'pressing again undoes it: the shown button is the one pressed', async( { page } ) =>
{
	await OpenWithContentScript( page, { url: URL, html: SteamStorePage( { wishlisted: true, following: true, ignored: true } ) } );
	await PressEach( page, [ 'KeyW', 'KeyF', 'KeyI' ] );

	expect( await Clicks( page ) ).toEqual( { wishlist: 0, unwishlist: 1, follow: 0, unfollow: 1, ignore: 0, unignore: 1 } );
} );

test( 'S is left alone: you\'re already on the store page', async( { page } ) =>
{
	await OpenWithContentScript( page, { url: URL, html: SteamStorePage() } );
	await page.keyboard.press( 'KeyS' );

	expect( await page.evaluate( () => window.__sentMessages ) ).toEqual( [] );
	expect( await KeysSeenByPage( page ) ).toEqual( [ 'KeyS' ] );
} );

test( 'signed out: there are no buttons, so keys are left alone', async( { page } ) =>
{
	await OpenWithContentScript( page, { url: URL, html: SteamStorePage( { signedIn: false } ) } );
	await page.keyboard.press( 'KeyW' );

	expect( await KeysSeenByPage( page ) ).toEqual( [ 'KeyW' ] );
} );

test( 'keys are ignored while typing in Steam\'s search box', async( { page } ) =>
{
	await OpenWithContentScript( page, { url: URL, html: SteamStorePage() } );
	await page.locator( '#store_nav_search_term' ).focus();
	await page.keyboard.type( 'wfi' );

	expect( await page.locator( '#store_nav_search_term' ).inputValue() ).toBe( 'wfi' );
	expect( await Clicks( page ) ).toMatchObject( { wishlist: 0, follow: 0, ignore: 0 } );
} );

test( 'can be turned off in the settings', async( { page } ) =>
{
	const settings = SettingsWith( { steamStorePages: false } );
	await OpenWithContentScript( page, { url: URL, html: SteamStorePage(), storage: { sync: { settings } } } );
	await page.keyboard.press( 'KeyW' );

	expect( ( await Clicks( page ) ).wishlist ).toBe( 0 );
	expect( await KeysSeenByPage( page ) ).toEqual( [ 'KeyW' ] );
} );
