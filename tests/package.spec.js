// @ts-check
'use strict';

// Checks on the extension's files themselves. They don't need a browser, so they run once.

const fs = require( 'node:fs' );
const path = require( 'node:path' );
const { test, expect } = require( '@playwright/test' );
const { ROOT, ExtensionFiles } = require( './helpers' );

const manifest = JSON.parse( fs.readFileSync( path.join( ROOT, 'manifest.json' ), 'utf8' ) );

test.skip( ( { browserName } ) => browserName !== 'chromium', 'No browser needed, runs once' );

test( 'every file the manifest refers to exists and is packaged', () =>
{
	const packaged = new Set( ExtensionFiles() );
	const referenced = [
		...Object.values( manifest.icons ),
		...Object.values( manifest.action.default_icon ),
		manifest.action.default_popup,
		manifest.options_ui.page,
		manifest.background.service_worker,
		...manifest.background.scripts,
		...manifest.content_scripts.flatMap( ( script ) => script.js ),
	];

	for( const file of referenced )
	{
		expect( fs.existsSync( path.join( ROOT, file ) ), `${file} exists` ).toBe( true );
		expect( packaged.has( file ), `${file} is in the ZIP built by build.ps1` ).toBe( true );
	}
} );

test( 'every file build.ps1 packages exists', () =>
{
	for( const file of ExtensionFiles() )
	{
		expect( fs.existsSync( path.join( ROOT, file ) ), `${file} exists` ).toBe( true );
	}
} );

test( 'content scripts load shared.js first and only run on SteamDB and the Steam store', () =>
{
	const [ script, steamPageClick ] = manifest.content_scripts;

	expect( script.js ).toEqual( [ 'shared.js', 'content.js' ] );
	expect( script.matches ).toEqual( [ 'https://steamdb.info/*', 'https://store.steampowered.com/*' ] );

	// Clicks Steam's javascript: links from the page's own context
	expect( steamPageClick ).toEqual( {
		matches: [ 'https://store.steampowered.com/*' ],
		js: [ 'steam-page-click.js' ],
		run_at: 'document_idle',
		world: 'MAIN',
	} );
	expect( manifest.content_scripts ).toHaveLength( 2 );
	expect( manifest.permissions ).toEqual( [ 'storage' ] );
	expect( manifest.host_permissions ).toBeUndefined();
} );

test( 'version is a plain x.y.z number, as the stores require', () =>
{
	expect( manifest.version ).toMatch( /^\d+\.\d+\.\d+$/ );
} );

// Firefox runs each content script file separately: a top-level const or let in shared.js
// can't be seen from content.js, which then stops working (this happened before 1.5.0)
test( 'shared.js declares its top-level names with var, so Firefox content scripts can see them', () =>
{
	const source = fs.readFileSync( path.join( ROOT, 'shared.js' ), 'utf8' );
	const topLevel = source.split( '\n' ).filter( ( line ) => /^(const|let|class)\s/.test( line ) );

	expect( topLevel ).toEqual( [] );
} );
