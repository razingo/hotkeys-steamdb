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

// steam-page-click.js runs in the page's own context ("world": "MAIN"), which needs Chrome 111
test( 'the manifest asks for a Chrome version that supports everything it uses', () =>
{
	expect( Number( manifest.minimum_chrome_version ) ).toBeGreaterThanOrEqual( 111 );
} );

test( 'version is a plain x.y.z number, as the stores require', () =>
{
	expect( manifest.version ).toMatch( /^\d+\.\d+\.\d+$/ );
} );

// The links between files that nothing else would catch if one side changed

const Read = ( file ) => fs.readFileSync( path.join( ROOT, file ), 'utf8' );

test( 'every script and stylesheet options.html loads is packaged, with shared.js first', () =>
{
	const html = Read( 'options.html' );
	const loaded = [ ...html.matchAll( /(?:src|href)="([\w.-]+\.(?:js|css))"/g ) ].map( ( match ) => match[ 1 ] );
	const packaged = new Set( ExtensionFiles() );

	for( const file of loaded )
	{
		expect( packaged.has( file ), `${file} is in the ZIP built by build.ps1` ).toBe( true );
	}

	// tabs.js and options.js both use names from shared.js
	const scripts = loaded.filter( ( file ) => file.endsWith( '.js' ) );
	expect( scripts[ 0 ] ).toBe( 'shared.js' );
} );

test( 'every element options.js and tabs.js look up exists in options.html', () =>
{
	const ids = new Set( [ ...Read( 'options.html' ).matchAll( /\bid="([\w-]+)"/g ) ].map( ( match ) => match[ 1 ] ) );

	for( const file of [ 'options.js', 'tabs.js' ] )
	{
		for( const [ , id ] of Read( file ).matchAll( /getElementById\( '([\w-]+)' \)/g ) )
		{
			expect( ids.has( id ), `#${id} (used by ${file}) is in options.html` ).toBe( true );
		}
	}
} );

test( 'steam-page-click.js listens for every event content.js sends it', () =>
{
	const listens = [ ...Read( 'steam-page-click.js' ).matchAll( /addEventListener\( '(hotkeys-steamdb:[\w-]+)'/g ) ].map( ( match ) => match[ 1 ] );
	const content = Read( 'content.js' );

	// content.js sends "click" as is, and toggle-/capsule- followed by the action, for Wishlist and Ignore
	expect( content ).toContain( "'hotkeys-steamdb:click'" );
	expect( content ).toContain( '`hotkeys-steamdb:toggle-${action}`' );
	expect( content ).toContain( '`hotkeys-steamdb:capsule-${action}`' );

	expect( listens.sort() ).toEqual( [
		'hotkeys-steamdb:capsule-ignore',
		'hotkeys-steamdb:capsule-wishlist',
		'hotkeys-steamdb:click',
		'hotkeys-steamdb:toggle-ignore',
		'hotkeys-steamdb:toggle-wishlist',
	] );
} );

test( 'background.js handles the open-store message content.js sends', () =>
{
	const content = Read( 'content.js' );
	const background = Read( 'background.js' );

	expect( content ).toContain( "type: 'open-store', url: href, background:" );
	expect( background ).toContain( "message.type !== 'open-store'" );
	expect( background ).toContain( 'message.url' );
	expect( background ).toContain( 'message.background' );
} );

test( 'every shortcut action has a default key and a cooldown group', () =>
{
	const shared = Read( 'shared.js' );
	const actions = [ ...shared.match( /var SHORTCUT_ACTIONS = \[([\s\S]*?)\];/ )[ 1 ].matchAll( /id: '(\w+)'/g ) ].map( ( match ) => match[ 1 ] );
	const defaults = [ ...shared.match( /shortcuts: \{([\s\S]*?)\},/ )[ 1 ].matchAll( /(\w+): PlainKey/g ) ].map( ( match ) => match[ 1 ] );
	const cooldowns = [ ...Read( 'content.js' ).match( /const COOLDOWN_GROUP = \{([\s\S]*?)\};/ )[ 1 ].matchAll( /(\w+):/g ) ].map( ( match ) => match[ 1 ] );

	expect( defaults.sort() ).toEqual( [ ...actions ].sort() );
	expect( cooldowns.sort() ).toEqual( [ ...actions ].sort() );
} );

test( 'the README lists the same default keys as shared.js', () =>
{
	const shared = Read( 'shared.js' );
	const readme = Read( 'README.md' );
	const defaults = [ ...shared.match( /shortcuts: \{([\s\S]*?)\},/ )[ 1 ].matchAll( /PlainKey\( '(\w)' \)/g ) ].map( ( match ) => match[ 1 ] );

	// The shortcut table, one row per key, in the same order as the settings page
	const table = [ ...readme.matchAll( /^\| <kbd>(\w)<\/kbd> \|/gm ) ].map( ( match ) => match[ 1 ] );
	expect( table ).toEqual( defaults );

	// "Reset to defaults restores Q / W / E / R / T"
	expect( readme ).toContain( `restores ${defaults.join( ' / ' )}` );

	// The settings page names the shortcuts instead of keys, so it stays right after you change them.
	// Its notes shouldn't mention any default key as a word of its own, like the "W, E, R and T" it once had.
	const notes = [ ...Read( 'options.html' ).matchAll( /class="toggle-note[^"]*">([^<]*)</g ) ].map( ( match ) => match[ 1 ] );
	expect( notes.length ).toBeGreaterThan( 0 );

	for( const note of notes )
	{
		for( const key of defaults )
		{
			expect( note, `the note "${note}" names the key ${key}` ).not.toMatch( new RegExp( `\\b${key}\\b` ) );
		}
	}
} );

test( 'the changelog and the bug report form have the manifest\'s version', () =>
{
	expect( Read( 'CHANGELOG.md' ).match( /^## (\d+\.\d+\.\d+)/m )[ 1 ] ).toBe( manifest.version );
	expect( Read( '.github/ISSUE_TEMPLATE/bug_report.yml' ).match( /placeholder: (\d+\.\d+\.\d+)/ )[ 1 ] ).toBe( manifest.version );
} );

test( 'the README sections the issue forms link to exist', () =>
{
	const headings = new Set( [ ...Read( 'README.md' ).matchAll( /^#+ (.+)$/gm ) ]
		.map( ( match ) => match[ 1 ].toLowerCase().replace( /[^\w\s-]/g, '' ).trim().replace( /\s+/g, '-' ) ) );

	for( const form of [ 'bug_report.yml', 'idea.yml' ] )
	{
		for( const [ , anchor ] of Read( `.github/ISSUE_TEMPLATE/${form}` ).matchAll( /hotkeys-steamdb#([\w-]+)/g ) )
		{
			expect( headings.has( anchor ), `#${anchor} (linked from ${form}) is a README heading` ).toBe( true );
		}
	}
} );

// Firefox runs each content script file separately: a top-level const or let in shared.js
// can't be seen from content.js, which then stops working (this happened before 1.5.0)
test( 'shared.js declares its top-level names with var, so Firefox content scripts can see them', () =>
{
	const source = fs.readFileSync( path.join( ROOT, 'shared.js' ), 'utf8' );
	const topLevel = source.split( '\n' ).filter( ( line ) => /^(const|let|class)\s/.test( line ) );

	expect( topLevel ).toEqual( [] );
} );
