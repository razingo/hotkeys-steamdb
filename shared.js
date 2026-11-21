'use strict';

// Shared by content.js and options.js

/**
 * @typedef {{code: string, label: string, ctrl: boolean, alt: boolean, shift: boolean, meta: boolean}} Shortcut
 * @typedef {{shortcuts: Record<string, Shortcut|null>, storeInBackground: boolean}} Settings
 */

const SHORTCUT_ACTIONS = [
	{ id: 'store', name: 'Store', description: 'Open the Steam store page' },
	{ id: 'wishlist', name: 'Wishlist', description: 'Add to or remove from wishlist' },
	{ id: 'follow', name: 'Follow', description: 'Follow or unfollow' },
	{ id: 'ignore', name: 'Ignore', description: 'Ignore or unignore' },
];

/** @param {string} letter @returns {Shortcut} */
const PlainKey = ( letter ) => ( {
	code: `Key${letter}`,
	label: letter,
	ctrl: false,
	alt: false,
	shift: false,
	meta: false,
} );

/** @type {Settings} */
const DEFAULT_SETTINGS = {
	shortcuts: {
		store: PlainKey( 'S' ),
		wishlist: PlainKey( 'W' ),
		follow: PlainKey( 'F' ),
		ignore: PlainKey( 'I' ),
	},
	storeInBackground: true,
};

const ExtApi = globalThis.browser ?? globalThis.chrome;

const MODIFIER_KEYS = new Set( [ 'Control', 'Alt', 'AltGraph', 'Shift', 'Meta', 'OS', 'CapsLock', 'Fn' ] );

const IS_MAC = /Mac|iPhone|iPad/.test( navigator.platform || navigator.userAgent );

/** @returns {Settings} */
const CloneDefaults = () => JSON.parse( JSON.stringify( DEFAULT_SETTINGS ) );

/**
 * Reads settings and fills in anything missing with defaults.
 * @returns {Promise<Settings>}
 */
const LoadSettings = async() =>
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
const SaveSettings = ( settings ) => ExtApi.storage.sync.set( { settings } );

/**
 * Human readable name for the key itself, independent of keyboard layout where possible.
 * @param {KeyboardEvent} e
 */
const KeyLabel = ( e ) =>
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
const ShortcutFromEvent = ( e ) =>
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
const ModifierNames = ( s ) =>
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
const FormatShortcut = ( s ) => s ? [ ...ModifierNames( s ), s.label ].join( ' + ' ) : '';

/** @param {Shortcut|null} a @param {Shortcut|null} b */
const SameShortcut = ( a, b ) => !!a && !!b &&
	a.code === b.code &&
	a.ctrl === b.ctrl &&
	a.alt === b.alt &&
	a.shift === b.shift &&
	a.meta === b.meta;

/** @param {KeyboardEvent} e @param {Shortcut|null} s */
const EventMatches = ( e, s ) => !!s &&
	e.code === s.code &&
	e.ctrlKey === s.ctrl &&
	e.altKey === s.alt &&
	e.shiftKey === s.shift &&
	e.metaKey === s.meta;
