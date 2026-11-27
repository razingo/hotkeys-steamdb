'use strict';

// Shared by content.js, options.js and tabs.js
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

// Adding an action here also needs a default key below, a cooldown group in content.js (COOLDOWN_GROUP) and
// a way for content.js to find its button. tests/package.spec.js checks the first two.
var SHORTCUT_ACTIONS = [
	{ id: 'store', name: 'Store', description: 'Open the Steam store page' },
	{ id: 'wishlist', name: 'Wishlist', description: 'Add to or remove from wishlist' },
	{ id: 'follow', name: 'Follow', description: 'Follow or unfollow' },
	{ id: 'ignore', name: 'Ignore', description: 'Ignore or unignore' },
	{ id: 'ignoreElsewhere', name: 'Ignore: played elsewhere', description: 'Steam store pages only: ignore as played on another platform' },
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
		store: PlainKey( 'Q' ),
		wishlist: PlainKey( 'W' ),
		follow: PlainKey( 'E' ),
		ignore: PlainKey( 'R' ),
		ignoreElsewhere: PlainKey( 'T' ),
	},
	storeInBackground: true,
	// Shortcuts also work on the Steam store, not just on steamdb.info
	steamStorePages: true,
};

var ExtApi = globalThis.browser ?? globalThis.chrome;

var MODIFIER_KEYS = new Set( [ 'Control', 'Alt', 'AltGraph', 'Shift', 'Meta', 'OS', 'CapsLock', 'Fn' ] );

var IS_MAC = /Mac|iPhone|iPad/.test( navigator.platform || navigator.userAgent );

var IS_FIREFOX = /Firefox\//.test( navigator.userAgent );

var IS_WINDOWS = /Win/.test( navigator.platform || navigator.userAgent );

var IS_LINUX = !IS_MAC && !IS_WINDOWS && /Linux/.test( navigator.platform || navigator.userAgent );

/** A stored shortcut is either null (turned off) or a full shortcut object. Anything else is ignored. */
var IsValidShortcut = ( s ) => s === null || ( !!s && typeof s === 'object' &&
	typeof s.code === 'string' && s.code !== '' &&
	typeof s.label === 'string' &&
	[ s.ctrl, s.alt, s.shift, s.meta ].every( ( flag ) => typeof flag === 'boolean' ) );

/** @returns {Settings} */
var CloneDefaults = () => JSON.parse( JSON.stringify( DEFAULT_SETTINGS ) );

/**
 * Turns whatever was stored into complete settings: anything missing or broken gets its default.
 * @returns {Settings}
 */
var NormalizeSettings = ( stored ) =>
{
	const settings = CloneDefaults();

	if( !stored || typeof stored !== 'object' )
	{
		return settings;
	}

	for( const option of [ 'storeInBackground', 'steamStorePages' ] )
	{
		if( typeof stored[ option ] === 'boolean' )
		{
			settings[ option ] = stored[ option ];
		}
	}

	for( const { id } of SHORTCUT_ACTIONS )
	{
		// A broken entry keeps the default rather than showing up as "undefined" in the settings
		if( stored.shortcuts && Object.hasOwn( stored.shortcuts, id ) && IsValidShortcut( stored.shortcuts[ id ] ) )
		{
			settings.shortcuts[ id ] = stored.shortcuts[ id ];
		}
	}

	return settings;
};

/** @returns {Promise<Settings>} */
var LoadSettings = async() =>
{
	try
	{
		const area = await IsSyncEnabled() ? 'sync' : 'local';
		return NormalizeSettings( ( await ExtApi.storage[ area ].get( 'settings' ) ).settings );
	}
	catch( error )
	{
		console.error( '[Popup Hotkeys for SteamDB] Failed to load settings', error );
		return CloneDefaults();
	}
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
 * Whether two stored settings do the same thing. Shortcuts are compared by key and modifiers, not by their label:
 * the same key can be labelled differently on another keyboard layout (e.g. "'" here, "Ä" on a German one).
 */
var SameSettings = ( a, b ) =>
{
	const first = NormalizeSettings( a );
	const second = NormalizeSettings( b );

	return first.storeInBackground === second.storeInBackground &&
		first.steamStorePages === second.steamStorePages &&
		SHORTCUT_ACTIONS.every( ( { id } ) =>
		{
			const x = first.shortcuts[ id ];
			const y = second.shortcuts[ id ];
			return x === null || y === null ? x === y : SameShortcut( x, y );
		} );
};

/**
 * Turns sync on or off.
 *
 * Off: this browser keeps its current settings, now stored locally. Returns 'kept'.
 *
 * On: nothing is overwritten without asking.
 * - Nothing synced yet: this browser's settings become the synced ones ('uploaded').
 * - Synced settings are the same as this browser's: sync just turns on ('same').
 * - They differ: sync stays off and this returns 'conflict', so the settings page can ask which to keep.
 *   Call again with keep = 'this' (upload this browser's, 'uploaded') or 'synced' (switch to those, 'adopted').
 *
 * @param {boolean} enabled @param {Settings} settings @param {'this'|'synced'} [keep]
 * @returns {Promise<'kept'|'uploaded'|'same'|'adopted'|'conflict'>}
 */
var SetSyncEnabled = async( enabled, settings, keep ) =>
{
	if( !enabled )
	{
		await ExtApi.storage.local.set( { syncSettings: false, settings } );
		return 'kept';
	}

	const { settings: synced } = await ExtApi.storage.sync.get( 'settings' );
	const hasSynced = !!synced && typeof synced === 'object';
	const same = hasSynced && SameSettings( synced, settings );

	if( hasSynced && !same && !keep )
	{
		return 'conflict';
	}

	// Upload first, then switch over. The other way round, open tabs react to the switch and could read
	// the synced settings for a moment before this browser's have arrived there.
	const upload = !hasSynced || keep === 'this';

	if( upload )
	{
		await ExtApi.storage.sync.set( { settings } );
	}

	await ExtApi.storage.local.set( { syncSettings: true } );

	if( upload )
	{
		return 'uploaded';
	}

	return same ? 'same' : 'adopted';
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

	// Dead keys (^ and ´ on a German keyboard, ' and ` on US International) don't type anything by themselves,
	// so the browser calls them "Dead". Name them after the key at that spot on a US keyboard instead.
	if( ( e.key === 'Dead' || e.key === 'Unidentified' ) && Object.hasOwn( PUNCTUATION_KEYS, e.code ) )
	{
		return PUNCTUATION_KEYS[ e.code ];
	}

	return e.key.length === 1 ? e.key.toUpperCase() : e.key;
};

/** What the punctuation keys type on a US keyboard, by their position */
var PUNCTUATION_KEYS = {
	Backquote: '`',
	Minus: '-',
	Equal: '=',
	BracketLeft: '[',
	BracketRight: ']',
	Backslash: '\\',
	IntlBackslash: '\\',
	Semicolon: ';',
	Quote: '\'',
	Comma: ',',
	Period: '.',
	Slash: '/',
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

/**
 * Common browser shortcuts, written as "Mod+Shift+KeyT", where Mod is Ctrl (Cmd on a Mac).
 * Reserved ones are kept by the browser and never reach extensions. The others do reach the page,
 * so this extension's shortcut would replace what the browser does while it's active.
 * An entry with `when: false` doesn't exist in this browser or on this system, so its keys are free to use.
 * Quitting differs the most: Cmd + Q on a Mac, Ctrl + Q in Firefox on Linux, Ctrl + Shift + Q in Firefox on Windows.
 * Chrome on Windows and Linux has no quit key at all (it's Alt + F, then X).
 * @type {{keys: string, does: string, reserved?: boolean, when?: boolean}[]}
 */
var BROWSER_SHORTCUTS = [
	{ keys: 'Mod+KeyT', does: 'open a new tab', reserved: true },
	{ keys: 'Mod+KeyN', does: 'open a new window', reserved: true },
	{ keys: 'Mod+KeyW', does: 'close the tab', reserved: true },
	{ keys: 'Mod+Shift+KeyT', does: 'reopen a closed tab', reserved: true },
	// Chrome opens an incognito window, Firefox brings back the last window you closed
	{ keys: 'Mod+Shift+KeyN', does: IS_FIREFOX ? 'reopen a closed window' : 'open a private window', reserved: true },
	{ keys: 'Mod+Shift+KeyP', does: 'open a private window', reserved: true, when: IS_FIREFOX },
	{ keys: 'Mod+Shift+KeyW', does: 'close the window', reserved: true },
	{ keys: 'Mod+KeyQ', does: 'quit the browser', reserved: true, when: IS_MAC || ( IS_FIREFOX && IS_LINUX ) },
	{ keys: 'Mod+Shift+KeyQ', does: 'quit the browser', reserved: true, when: IS_FIREFOX && IS_WINDOWS },
	// macOS takes these for every app before the page sees them
	{ keys: 'Mod+KeyH', does: 'hide the browser', reserved: true, when: IS_MAC },
	{ keys: 'Mod+KeyM', does: 'minimize the window', reserved: true, when: IS_MAC },
	{ keys: 'Ctrl+Tab', does: 'switch to the next tab', reserved: true },
	{ keys: 'Ctrl+Shift+Tab', does: 'switch to the previous tab', reserved: true },
	{ keys: 'Mod+KeyF', does: 'find in the page' },
	{ keys: 'Mod+KeyG', does: 'find the next match' },
	{ keys: 'Mod+Shift+KeyG', does: 'find the previous match' },
	{ keys: 'Mod+KeyP', does: 'print' },
	{ keys: 'Mod+KeyS', does: 'save the page' },
	{ keys: 'Mod+KeyD', does: 'bookmark the page' },
	{ keys: 'Mod+Shift+KeyD', does: 'bookmark all open tabs' },
	{ keys: 'Mod+KeyR', does: 'reload the page' },
	{ keys: 'Mod+Shift+KeyR', does: 'reload the page' },
	{ keys: 'Mod+KeyL', does: 'go to the address bar' },
	{ keys: 'Mod+KeyA', does: 'select all' },
	{ keys: 'Mod+KeyC', does: 'copy' },
	{ keys: 'Mod+KeyV', does: 'paste' },
	{ keys: 'Mod+KeyX', does: 'cut' },
	{ keys: 'Mod+KeyZ', does: 'undo' },
	{ keys: 'Mod+Shift+KeyZ', does: 'redo' },
	{ keys: 'Mod+KeyO', does: 'open a file' },
	{ keys: 'Mod+Shift+KeyC', does: 'inspect the page' },
	{ keys: 'Mod+Shift+KeyB', does: 'show or hide the bookmarks bar' },
	{ keys: 'Mod+Shift+KeyM', does: IS_FIREFOX ? 'open Responsive Design Mode' : 'switch to another profile' },
	{ keys: 'Mod+Shift+Delete', does: 'clear browsing data' },
	{ keys: 'Mod+Equal', does: 'zoom in' },
	{ keys: 'Mod+Minus', does: 'zoom out' },
	{ keys: 'Mod+Digit0', does: 'reset the zoom' },
	...[ 1, 2, 3, 4, 5, 6, 7, 8, 9 ].map( ( n ) => ( { keys: `Mod+Digit${n}`, does: 'switch to a tab by number' } ) ),

	// Windows and Linux
	{ keys: 'Mod+KeyK', does: 'search the web', when: !IS_MAC },
	{ keys: 'Mod+KeyE', does: 'search the web', when: !IS_MAC },
	{ keys: 'Mod+KeyH', does: 'open your history', when: !IS_MAC },
	{ keys: 'Mod+KeyJ', does: 'open your downloads', when: !IS_MAC },
	{ keys: 'Mod+KeyU', does: 'view the page source', when: !IS_MAC },
	{ keys: 'Mod+KeyY', does: 'redo', when: !IS_MAC },
	{ keys: 'Mod+Shift+KeyI', does: 'open the developer tools', when: !IS_MAC },
	{ keys: 'Mod+Shift+KeyJ', does: 'open the console', when: !IS_MAC },
	{ keys: 'Mod+Shift+KeyO', does: 'open your bookmarks', when: !IS_MAC },
	{ keys: 'Alt+ArrowLeft', does: 'go back', when: !IS_MAC },
	{ keys: 'Alt+ArrowRight', does: 'go forward', when: !IS_MAC },
	{ keys: 'Alt+Home', does: 'open your home page', when: !IS_MAC },
	{ keys: 'Alt+KeyD', does: 'go to the address bar', when: !IS_MAC },
	{ keys: 'Alt+KeyF', does: 'open the browser menu', when: !IS_MAC },

	// A Mac has its own keys for many of the same things (Chrome's Mac list; Cmd + Option is Mod+Alt here)
	{ keys: 'Mod+KeyE', does: 'search for the selected text', when: IS_MAC },
	{ keys: 'Mod+KeyY', does: 'open your history', when: IS_MAC },
	{ keys: 'Mod+Shift+KeyJ', does: 'open your downloads', when: IS_MAC },
	{ keys: 'Mod+Shift+KeyI', does: 'email a link to the page', when: IS_MAC },
	{ keys: 'Mod+Shift+KeyH', does: 'open your home page', when: IS_MAC },
	{ keys: 'Mod+Comma', does: 'open the settings', when: IS_MAC },
	{ keys: 'Mod+Alt+KeyI', does: 'open the developer tools', when: IS_MAC },
	{ keys: 'Mod+Alt+KeyJ', does: 'open the console', when: IS_MAC },
	{ keys: 'Mod+Alt+KeyU', does: 'view the page source', when: IS_MAC },
	{ keys: 'Mod+Alt+KeyB', does: 'open your bookmarks', when: IS_MAC },
	{ keys: 'Mod+Alt+KeyF', does: 'search the web', when: IS_MAC },
	{ keys: 'Mod+Alt+KeyP', does: 'open the page setup', when: IS_MAC },
	{ keys: 'Mod+Alt+ArrowLeft', does: 'switch to the previous tab', when: IS_MAC },
	{ keys: 'Mod+Alt+ArrowRight', does: 'switch to the next tab', when: IS_MAC },
	{ keys: 'Mod+BracketLeft', does: 'go back', when: IS_MAC },
	{ keys: 'Mod+BracketRight', does: 'go forward', when: IS_MAC },
	{ keys: 'Mod+ArrowLeft', does: 'go back', when: IS_MAC },
	{ keys: 'Mod+ArrowRight', does: 'go forward', when: IS_MAC },

	// Chrome's Mac list only has F7, the others are Windows and Linux keys
	{ keys: 'F1', does: 'open help', when: !IS_MAC },
	{ keys: 'F3', does: 'find the next match', when: !IS_MAC },
	{ keys: 'F5', does: 'reload the page', when: !IS_MAC },
	{ keys: 'F6', does: 'go to the address bar', when: !IS_MAC },
	{ keys: 'F7', does: 'turn on caret browsing' },
	{ keys: 'F10', does: 'open the browser menu', when: !IS_MAC },
	{ keys: 'F11', does: 'go full screen', when: !IS_MAC },
	{ keys: 'F12', does: 'open the developer tools', when: !IS_MAC },
	{ keys: 'Space', does: 'scroll down' },
	{ keys: 'Shift+Space', does: 'scroll up' },
	{ keys: 'PageUp', does: 'scroll up' },
	{ keys: 'PageDown', does: 'scroll down' },
	{ keys: 'Home', does: 'scroll to the top' },
	{ keys: 'End', does: 'scroll to the bottom' },
	{ keys: 'ArrowUp', does: 'scroll' },
	{ keys: 'ArrowDown', does: 'scroll' },
	{ keys: 'ArrowLeft', does: 'scroll' },
	{ keys: 'ArrowRight', does: 'scroll' },
	{ keys: 'Enter', does: 'open links and press buttons' },
	{ keys: 'Slash', does: 'quick find', when: IS_FIREFOX },
	{ keys: 'Quote', does: 'quick find in links', when: IS_FIREFOX },
];

/**
 * The browser shortcut this would clash with, if any
 * @param {Shortcut|null} s
 * @returns {{keys: string, does: string, reserved?: boolean}|null}
 */
var BrowserShortcutFor = ( s ) =>
{
	if( !s )
	{
		return null;
	}

	return BROWSER_SHORTCUTS.find( ( { keys, when = true } ) =>
	{
		if( !when )
		{
			return false;
		}

		const parts = keys.split( '+' );
		const code = parts.pop();
		const mod = parts.includes( 'Mod' );
		const ctrl = parts.includes( 'Ctrl' ) || ( mod && !IS_MAC );
		const meta = mod && IS_MAC;

		return s.code === code &&
			s.ctrl === ctrl &&
			s.meta === meta &&
			s.shift === parts.includes( 'Shift' ) &&
			s.alt === parts.includes( 'Alt' );
	} ) ?? null;
};

/** @param {KeyboardEvent} e @param {Shortcut|null} s */
var EventMatches = ( e, s ) => !!s &&
	e.code === s.code &&
	e.ctrlKey === s.ctrl &&
	e.altKey === s.alt &&
	e.shiftKey === s.shift &&
	e.metaKey === s.meta;
