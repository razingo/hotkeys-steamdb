'use strict';

// Runs in the Steam store page's own JavaScript context ("world": "MAIN" in the manifest), not the extension's.
// content.js decides what to do and sends an event; this script does it the way the page itself would.
// Pages could send these events themselves, but they can already do all of this on their own, so it gives them nothing new.

// Wrapped so nothing is added to the page's own global variables
( () =>
{

const Wait = ( ms ) => new Promise( ( resolve ) => setTimeout( resolve, ms ) );
const IsVisible = ( el ) => el.checkVisibility?.() ?? true;

/** Waits up to half a second for a visible menu option matching the label, and clicks it */
const PickMenuOption = async( selector, label ) =>
{
	for( let attempt = 0; attempt < 20; attempt++ )
	{
		const option = [ ...document.querySelectorAll( selector ) ].find( ( el ) => IsVisible( el ) && label.test( el.textContent ) );

		if( option )
		{
			option.click();
			return true;
		}

		await Wait( 25 );
	}

	return false;
};

// Steam's "Add to your wishlist" button on game pages is a link to javascript:AddToWishlist(...).
// Browsers don't run javascript: links clicked from an extension's content script, but they do from here.
document.addEventListener( 'hotkeys-steamdb:click', ( e ) =>
{
	if( e.target instanceof HTMLElement )
	{
		e.target.click();
	}
} );

// A game in Steam's older store sections (data-ds-appid): store list rows and the recommendation boxes.
// Uses the same functions as Steam's own options menu (GDynamicStore), so it adds or removes depending on
// whether the game is already on the wishlist or ignored, and updates the "ON WISHLIST" badges afterwards.
// If Steam ever drops those functions, list rows fall back to their options menu.
const ToggleDynamicItem = ( item, kind ) =>
{
	if( !( item instanceof HTMLElement ) )
	{
		return;
	}

	const appid = Number( item.dataset.dsAppid );
	const store = window.GDynamicStore;
	const $ = window.$J;

	if( !appid || !store?.ModifyWishlist || !store.ModifyIgnoredApp || !$ )
	{
		if( item.querySelector( '.ds_options' ) )
		{
			item.querySelector( '.ds_options' ).click();
			PickMenuOption( '.ds_options_tooltip .option', kind === 'wishlist' ? /wishlist/i : /ignore/i );
		}

		return;
	}

	// Redraw the "ON WISHLIST" / "IGNORED" badges on every copy of this game on the page. Steam skips games it has
	// already decorated unless forced, and its forced redraw doesn't clear the ignored look, so that's cleared first.
	const Redecorate = () =>
	{
		const $copies = $( `[data-ds-appid="${appid}"]` );
		$copies.removeClass?.( 'ds_ignored' );
		store.DecorateDynamicItems?.( $copies, true );
	};

	// Steam updates its in-page lists before it sends the change, so the badges are redrawn straight away, like with
	// Steam's own menu. Once Steam's server answers they're redrawn again: if the change failed, Steam has undone it.
	if( kind === 'wishlist' )
	{
		store.ModifyWishlist( $( item ), appid, !!store.BIsAppOnWishlist?.( appid ), Redecorate, Redecorate );
	}
	else
	{
		store.ModifyIgnoredApp( $( item ), appid, !!store.BIsAppIgnored?.( appid ), Redecorate, Redecorate );
	}

	Redecorate();
};

document.addEventListener( 'hotkeys-steamdb:toggle-wishlist', ( e ) => ToggleDynamicItem( e.target, 'wishlist' ) );
document.addEventListener( 'hotkeys-steamdb:toggle-ignore', ( e ) => ToggleDynamicItem( e.target, 'ignore' ) );

// Steam's newer capsules (Discounts & Events, the Personal Calendar, ...). While the mouse is over one, Steam shows a
// small "..." button next to it that opens a menu with "Add to wishlist" / "Remove from wishlist",
// "Ignore Game" / "Remove from ignore list" and "Preferences". This clicks that button, then the option.
const MenuButtonOf = ( capsule ) =>
{
	// The button sits a few levels up from the capsule's link, next to it
	let container = capsule;

	for( let depth = 0; depth < 4 && container; depth++, container = container.parentElement )
	{
		const buttons = [ ...container.querySelectorAll( 'button' ) ].filter( IsVisible );

		if( buttons.length )
		{
			return buttons.length === 1 ? buttons[ 0 ] : null;
		}
	}

	return null;
};

const PickFromCapsuleMenu = ( capsule, label ) =>
{
	const button = capsule instanceof HTMLElement ? MenuButtonOf( capsule ) : null;

	if( button )
	{
		button.click();
		PickMenuOption( '.contextMenuItem, [role="menuitem"]', label );
	}
};

document.addEventListener( 'hotkeys-steamdb:capsule-wishlist', ( e ) => PickFromCapsuleMenu( e.target, /wishlist/i ) );
document.addEventListener( 'hotkeys-steamdb:capsule-ignore', ( e ) => PickFromCapsuleMenu( e.target, /ignore/i ) );

} )();
