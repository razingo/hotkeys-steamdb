# Changelog

What changed in each version. The newest is at the top.

## 1.5.3

The first version for the browser stores. Needs Chrome 111 or newer (or Edge, Brave, Opera and other Chromium-based browsers of the same age), or Firefox 140 or newer.

### Fixed

- The note under "Also on the Steam store" in the settings named the default keys (W, E, R, T...), even after you'd changed your shortcuts. It now names the shortcuts instead.

## 1.5.2

Not published to the stores; available from GitHub.

### Fixed

- Turning sync back on no longer asks which settings to keep when both are the same keys, just labelled differently by another keyboard layout.
- After answering that question, keyboard focus goes back to the sync switch instead of being lost.

## 1.5.1

Not published to the stores; available from GitHub. Bug fixes on top of 1.5.0.

### Changed

- Turning sync back on now asks which settings to keep when the synced ones differ from this browser's. Before, it switched to the synced ones and changes made while sync was off were lost.

### Fixed

- When a game on the Steam store couldn't be wishlisted or ignored at all, the blue highlight could stay on it.
- On Steam pages that change their address without reloading, shortcuts could act as if you were still on the previous game's page.
- Install instructions: Chrome needs an unzipped folder, not the ZIP.

## 1.5.0

Not published to the stores; available from GitHub. It brings the shortcuts to Steam's own store.

### New

- **New default keys: Q, W, E, R, T** (Store, Wishlist, Follow, Ignore, Ignore: played elsewhere), side by side on the keyboard. Shortcuts you've already changed keep your choice.
- **Steam store game pages:** W, E and R press Steam's own Wishlist, Follow and Ignore buttons. Pressing again removes from the wishlist, unfollows or unignores.
- **"Played on Another Platform":** T picks the second option in Steam's Ignore menu on game pages, without opening the menu.
- **Steam front page and store lists:** hover over a game and press Q to open it, W to add it to or remove it from your wishlist, or R to ignore or unignore it. This works in:
  - the store-list tabs (such as Popular New Releases) and search results
  - Discounts & Events and Your Personal Calendar
  - recommendation rows and boxes ("Since you wish for …", "Under 40 zł", "The Community Recommends", "From Developers and Publishers You Know" and similar)
- **Sale pages** such as Specials: hover over a game tile and press Q to open it, or W to add it to or remove it from your wishlist. Steam doesn't offer Ignore there.
- **"ON WISHLIST" and "IGNORED" badges** update straight away after a shortcut, as with Steam's own menu.
- **Over any other link to a game** on the Steam store, Q opens its store page.
- **Browser-shortcut warning:** shortcuts the browser keeps for itself (such as Ctrl + T) are refused; common ones the extension would take over (such as Ctrl + F or Space) show a warning.
- **New settings:**
  - "Also on the Steam store" turns all the Steam store shortcuts on or off.
  - "Sync settings between your browsers" turns sync on or off, per browser.
- The options are now on/off switches.
- "Reset to defaults" asks for a second click, so a stray click can't wipe your shortcuts.

### Changed

- Steam's buttons are clicked from the page's own context, so Steam's Wishlist button, a `javascript:` link that browsers don't run when an extension clicks it, works.
- The extension now runs on all `store.steampowered.com` pages, not only on steamdb.info. Browsers ask for this access when you install it.

### For developers

- Automated tests with Playwright, in Chromium and Firefox, run by GitHub on every push together with Firefox's add-on validator.

## 1.4.0

Not published to the stores; available from GitHub.

- Renamed to **Popup Hotkeys for SteamDB**, with a new icon.
- The Store shortcut works without the SteamDB extension. Without it, SteamDB's popup only shows the Store button.
- Fixed: shortcuts didn't work in Firefox.
- Settings page: a GitHub link next to Buy Me a Coffee.
- Prepared for the browser stores: Firefox add-on ID, a "no data collected" declaration, store images and a build script.

## 1.3.0

First release on GitHub.

- Keyboard shortcuts for the Store, Wishlist, Follow and Ignore buttons in SteamDB's game popup.
- The store page opens in a background tab by default.
- A settings page to change or turn off shortcuts.
- A 1-second cooldown on Wishlist, Follow and Ignore, so Steam isn't sent too many requests.
