'use strict';

// Shared by content.js and options.js
//
// Top-level names use `var`, not `const`: Firefox runs each content script file separately,
// and a top-level `const` or `let` from one file can't be seen from the next, so content.js would fail.
// `var` puts the name on the shared global object, which works in both Chrome and Firefox.

/**
 * @typedef {{code: string, label: string, ctrl: boolean, alt: boolean, shift: boolean, meta: boolean}} Shortcut
 * @typedef {{shortcuts: Record<string, Shortcut|null>, storeInBackground: boolean}} Settings
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
		const stored = ( await ExtApi.storage.sync.get( 'settings' ) ).settings;

		if( stored && typeof stored === 'object' )
		{
			if( typeof stored.storeInBackground === 'boolean' )
			{
				settings.storeInBackground = stored.storeInBackground;
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
var SaveSettings = ( settings ) => ExtApi.storage.sync.set( { settings } );

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
