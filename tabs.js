'use strict';

// Tab switching for the settings page, plus the version number on the About tab

( () =>
{
	const tabs = [ ...document.querySelectorAll( '[role="tab"]' ) ];

	const Select = ( tab, focus = false ) =>
	{
		for( const other of tabs )
		{
			const selected = other === tab;
			other.setAttribute( 'aria-selected', String( selected ) );
			other.tabIndex = selected ? 0 : -1;
			document.getElementById( other.getAttribute( 'aria-controls' ) ).hidden = !selected;
		}

		if( focus )
		{
			tab.focus();
		}
	};

	for( const tab of tabs )
	{
		tab.addEventListener( 'click', () => Select( tab ) );

		// Arrow keys move between tabs, as screen reader users expect from a tab list
		tab.addEventListener( 'keydown', ( e ) =>
		{
			const index = tabs.indexOf( tab );
			let next = null;

			if( e.key === 'ArrowRight' )
			{
				next = tabs[ ( index + 1 ) % tabs.length ];
			}
			else if( e.key === 'ArrowLeft' )
			{
				next = tabs[ ( index - 1 + tabs.length ) % tabs.length ];
			}
			else if( e.key === 'Home' )
			{
				next = tabs[ 0 ];
			}
			else if( e.key === 'End' )
			{
				next = tabs[ tabs.length - 1 ];
			}

			if( next )
			{
				e.preventDefault();
				Select( next, true );
			}
		} );
	}

	const version = ExtApi?.runtime?.getManifest?.().version;

	if( version )
	{
		document.getElementById( 'version' ).textContent = version;
	}
} )();
