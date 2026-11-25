'use strict';

// Shared by content.js and options.js
//
// Settings are stored under "settings" in storage.sync, or storage.local when the user turns sync off.
// That choice is stored as "syncSettings" in storage.local.
//
// Top-level names use `var`, not `const`: Firefox runs each content script file separately,
// and a top-level `const` or `let` from one file can't be seen from the next, so content.js would fail.
// `var` puts the name on the shared global object, which works in both Chrome and Firefox.

/**
 * @typedef {{code: string, label: string, ctrl: boolean, alt: boolean, shift: boolean, meta: boolean}} Shortcut
 * @typedef {{shortcuts: Record<string, Shortcut|null>, storeInBackground: boolean, steamStorePages: boolean}} Settings
 */

var SHORTCUT_ACTIONS = [
	{ id: 'store', name: 'Store', description: 'Open the Steam store page' },
	{ id: 'wishlist', name: 'Wishlist', description: 'Add to or remove from wishlist' },
	{ id: 'follow', name: 'Follow', description: 'Follow or unfollow' },
	{ id: 'ignore', name: 'Ignore', description: 'Ignore or unignore' },
];

/** @param {string} letter @returns {Shortcut} */
var PlainKey = ( letter ) => ( {
	code: `Key${letter}`,
	label: letter,
	ctrl: false,
	alt: false,
	shift: false,
	meta: false,
} );

/** @type {Settings} */
var DEFAULT_SETTINGS = {
	shortcuts: {
		store: PlainKey( 'S' ),
		wishlist: PlainKey( 'W' ),
		follow: PlainKey( 'F' ),
		ignore: PlainKey( 'I' ),
	},
	storeInBackground: true,
	// Wishlist, Follow and Ignore also work on Steam store game pages
	steamStorePages: true,
};

var ExtApi = globalThis.browser ?? globalThis.chrome;

var MODIFIER_KEYS = new Set( [ 'Control', 'Alt', 'AltGraph', 'Shift', 'Meta', 'OS', 'CapsLock', 'Fn' ] );

var IS_MAC = /Mac|iPhone|iPad/.test( navigator.platform || navigator.userAgent );

/** @returns {Settings} */
var CloneDefaults = () => JSON.parse( JSON.stringify( DEFAULT_SETTINGS ) );

/**
 * Reads settings and fills in anything missing with defaults.
 * @returns {Promise<Settings>}
 */
var LoadSettings = async() =>
{
	const settings = CloneDefaults();

	try
	{
		const area = await IsSyncEnabled() ? 'sync' : 'local';
		const stored = ( await ExtApi.storage[ area ].get( 'settings' ) ).settings;

		if( stored && typeof stored === 'object' )
		{
			for( const option of [ 'storeInBackground', 'steamStorePages' ] )
			{
				if( typeof stored[ option ] === 'boolean' )
				{
					settings[ option ] = stored[ option ];
				}
			}

			for( const { id } of SHORTCUT_ACTIONS )
			{
				if( stored.shortcuts && Object.hasOwn( stored.shortcuts, id ) )
				{
					settings.shortcuts[ id ] = stored.shortcuts[ id ];
				}
			}
		}
	}
	catch( error )
	{
		console.error( '[SteamDB hotkeys] Failed to load settings', error );
	}

	return settings;
};

/** @param {Settings} settings */
var SaveSettings = async( settings ) =>
{
	const area = await IsSyncEnabled() ? 'sync' : 'local';
	await ExtApi.storage[ area ].set( { settings } );
};

// Whether settings sync between browsers. This choice itself is stored locally, so each browser decides for itself.
/** @returns {Promise<boolean>} */
var IsSyncEnabled = async() =>
{
	try
	{
		const { syncSettings } = await ExtApi.storage.local.get( 'syncSettings' );
		return syncSettings !== false;
	}
	catch
	{
		return true;
	}
};

/**
 * Turns sync on or off, and carries the current settings over so nothing changes for the user.
 * @param {boolean} enabled @param {Settings} settings
 */
var SetSyncEnabled = async( enabled, settings ) =>
{
	await ExtApi.storage.local.set( { syncSettings: enabled } );
	await SaveSettings( settings );
};

/**
 * Human readable name for the key itself, independent of keyboard layout where possible.
 * @param {KeyboardEvent} e
 */
var KeyLabel = ( e ) =>
{
	if( /^Key[A-Z]$/.test( e.code ) )
	{
		return e.code.slice( 3 );
	}

	if( /^Digit\d$/.test( e.code ) )
	{
		return e.code.slice( 5 );
	}

	if( /^Numpad\d$/.test( e.code ) )
	{
		return `Num ${e.code.slice( 6 )}`;
	}

	if( e.key === ' ' )
	{
		return 'Space';
	}

	return e.key.length === 1 ? e.key.toUpperCase() : e.key;
};

/**
 * @param {KeyboardEvent} e
 * @returns {Shortcut|null} null when only modifiers are held
 */
var ShortcutFromEvent = ( e ) =>
{
	if( MODIFIER_KEYS.has( e.key ) )
	{
		return null;
	}

	return {
		code: e.code,
		label: KeyLabel( e ),
		ctrl: e.ctrlKey,
		alt: e.altKey,
		shift: e.shiftKey,
		meta: e.metaKey,
	};
};

/** @param {Partial<Shortcut>} s */
var ModifierNames = ( s ) =>
{
	const parts = [];

	if( s.ctrl )
	{
		parts.push( 'Ctrl' );
	}

	if( s.alt )
	{
		parts.push( IS_MAC ? 'Option' : 'Alt' );
	}

	if( s.shift )
	{
		parts.push( 'Shift' );
	}

	if( s.meta )
	{
		parts.push( IS_MAC ? 'Cmd' : 'Win' );
	}

	return parts;
};

/** @param {Shortcut|null} s */
var FormatShortcut = ( s ) => s ? [ ...ModifierNames( s ), s.label ].join( ' + ' ) : '';

/** @param {Shortcut|null} a @param {Shortcut|null} b */
var SameShortcut = ( a, b ) => !!a && !!b &&
	a.code === b.code &&
	a.ctrl === b.ctrl &&
	a.alt === b.alt &&
	a.shift === b.shift &&
	a.meta === b.meta;

/** @param {KeyboardEvent} e @param {Shortcut|null} s */
var EventMatches = ( e, s ) => !!s &&
	e.code === s.code &&
	e.ctrlKey === s.ctrl &&
	e.altKey === s.alt &&
	e.shiftKey === s.shift &&
	e.metaKey === s.meta;
