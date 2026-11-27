'use strict';

const Api = globalThis.browser ?? globalThis.chrome;

// Opens the store page in a new tab, by default without switching to it.
// Only Steam store URLs are accepted. content.js sends { type: 'open-store', url, background } from OpenStore().
Api.runtime.onMessage.addListener( ( message, sender, sendResponse ) =>
{
	if( !message || message.type !== 'open-store' || !sender.tab )
	{
		return false;
	}

	let url;

	try
	{
		url = new URL( message.url );
	}
	catch
	{
		sendResponse( { success: false } );
		return false;
	}

	if( url.protocol !== 'https:' || url.hostname !== 'store.steampowered.com' )
	{
		sendResponse( { success: false } );
		return false;
	}

	const base = { url: url.href, active: message.background === false };

	Api.tabs.create( { ...base, index: sender.tab.index + 1, openerTabId: sender.tab.id } )
		.catch( () => Api.tabs.create( base ) )
		.then( () => sendResponse( { success: true } ), () => sendResponse( { success: false } ) );

	return true;
} );
