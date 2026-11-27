// @ts-check
'use strict';

// The browser-shortcut list in shared.js, checked in each browser's own page (IS_MAC decides Ctrl or Cmd)

const path = require( 'node:path' );
const { test, expect } = require( '@playwright/test' );
const { ROOT } = require( './helpers' );

test.beforeEach( async( { page } ) =>
{
	await page.route( 'https://extension.test/', ( route ) => route.fulfill( { contentType: 'text/html', body: '<!doctype html><title>test</title>' } ) );
	await page.goto( 'https://extension.test/' );
	await page.addScriptTag( { path: path.join( ROOT, 'shared.js' ) } );
} );

const Check = ( page, shortcut ) => page.evaluate( ( s ) =>
{
	const mod = IS_MAC ? { meta: true } : { ctrl: true };
	const full = { label: '', ctrl: false, alt: false, shift: false, meta: false, ...( s.mod ? mod : {} ), ...s };
	delete full.mod;
	return BrowserShortcutFor( full );
}, shortcut );

test( 'knows reserved browser shortcuts', async( { page } ) =>
{
	expect( await Check( page, { code: 'KeyT', mod: true } ) ).toMatchObject( { does: 'open a new tab', reserved: true } );
	expect( await Check( page, { code: 'KeyT', mod: true, shift: true } ) ).toMatchObject( { does: 'reopen a closed tab', reserved: true } );
	expect( await Check( page, { code: 'Tab', ctrl: true } ) ).toMatchObject( { reserved: true } );
} );

test( 'knows common browser shortcuts that extensions can take over', async( { page } ) =>
{
	expect( await Check( page, { code: 'KeyF', mod: true } ) ).toEqual( { keys: 'Mod+KeyF', does: 'find in the page' } );
	expect( await Check( page, { code: 'Space' } ) ).toMatchObject( { does: 'scroll down' } );
	expect( await Check( page, { code: 'ArrowLeft', alt: true } ) ).toMatchObject( { does: 'go back' } );
	expect( await Check( page, { code: 'F5' } ) ).toMatchObject( { does: 'reload the page' } );
} );

test( 'plain letters and unusual combinations are fine', async( { page } ) =>
{
	for( const shortcut of [ { code: 'KeyS' }, { code: 'KeyW' }, { code: 'KeyF', shift: true }, { code: 'KeyQ', mod: true, shift: true, alt: true } ] )
	{
		expect( await Check( page, shortcut ), JSON.stringify( shortcut ) ).toBeNull();
	}

	expect( await page.evaluate( () => BrowserShortcutFor( null ) ) ).toBeNull();
} );

test( 'Firefox-only shortcuts only count in Firefox', async( { page, browserName } ) =>
{
	const privateWindow = await Check( page, { code: 'KeyP', mod: true, shift: true } );

	// Ctrl + Shift + N is taken in both, but does something else in each
	const shiftN = await Check( page, { code: 'KeyN', mod: true, shift: true } );

	if( browserName === 'firefox' )
	{
		expect( privateWindow ).toMatchObject( { does: 'open a private window', reserved: true } );
		expect( shiftN ).toMatchObject( { does: 'reopen a closed window', reserved: true } );
	}
	else
	{
		expect( privateWindow ).toBeNull();
		expect( shiftN ).toMatchObject( { does: 'open a private window', reserved: true } );
	}
} );

// Cmd + Q on a Mac, Ctrl + Q in Firefox on Linux, Ctrl + Shift + Q in Firefox on Windows.
// Chrome on Windows and Linux has no quit key, so Ctrl + Q is free there.
test( 'the quit key is only refused where it really quits', async( { page, browserName } ) =>
{
	const platform = await page.evaluate( () => navigator.platform );
	const ctrlQ = await Check( page, { code: 'KeyQ', mod: true } );
	const ctrlShiftQ = await Check( page, { code: 'KeyQ', mod: true, shift: true } );
	const quits = { does: 'quit the browser', reserved: true };

	if( /Mac/.test( platform ) )
	{
		expect( ctrlQ ).toMatchObject( quits );
		expect( ctrlShiftQ ).toBeNull();
	}
	else if( browserName !== 'firefox' )
	{
		expect( ctrlQ ).toBeNull();
		expect( ctrlShiftQ ).toBeNull();
	}
	else if( /Win/.test( platform ) )
	{
		expect( ctrlQ ).toBeNull();
		expect( ctrlShiftQ ).toMatchObject( quits );
	}
	else
	{
		expect( ctrlQ ).toMatchObject( quits );
		expect( ctrlShiftQ ).toBeNull();
	}
} );

test( 'the default shortcuts don\'t clash with the browser', async( { page } ) =>
{
	expect( await page.evaluate( () => Object.values( DEFAULT_SETTINGS.shortcuts ).map( BrowserShortcutFor ) ) ).toEqual( [ null, null, null, null, null ] );
} );
