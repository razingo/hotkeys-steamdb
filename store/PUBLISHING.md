# Publishing to the browser stores

Step-by-step instructions for the Chrome Web Store, Firefox Add-ons and (optionally) Microsoft Edge Add-ons, with every text ready to copy: first [publishing](#chrome-web-store), then [updating](#updating-the-extension) to a new version.

Store forms change from time to time. If a field here doesn't match what you see, the texts in [Texts to copy](#texts-to-copy) still apply.

## Before you start

1. Build the ZIP:

   ```powershell
   powershell -ExecutionPolicy Bypass -File build.ps1
   ```

   It's written to `dist/popup-hotkeys-for-steamdb-<version>.zip`. The same ZIP goes to every store.
2. Have the images from this folder ready:

   | File | Size | Used for |
   |------|------|----------|
   | `../icons/icon-128.png` | 128×128 | Chrome store icon |
   | `screenshot-1-shortcuts.png` | 1280×800 | Screenshot, all stores |
   | `screenshot-2-with-and-without.png` | 1280×800 | Screenshot, all stores |
   | `screenshot-3-steam-store.png` | 1280×800 | Screenshot, all stores |
   | `promo-tile-440x280.png` | 440×280 | Chrome small promo tile, Edge promo tile |

---

## Chrome Web Store

Covers Chrome, and also Brave, Opera and Vivaldi users, who install from the Chrome Web Store.

### 1. Create the developer account (once)

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) and sign in with your Google account.
2. Accept the developer agreement and pay the **one-time $5** registration fee.
3. Turn on **2-Step Verification** for the Google account if it isn't on. Publishing requires it.
4. In **Account**, set a **contact email** and verify it. You can't publish until it's verified. This email isn't shown on the listing.
5. In **Account**, you'll be asked about **trader status** (an EU requirement). If you're publishing as a hobby and not as a business, choose **non-trader**. Choose what actually applies to you; trader status publishes your contact details on the listing.

### 2. Upload the ZIP

1. Click **New item**.
2. Upload `dist/popup-hotkeys-for-steamdb-<version>.zip`.

The name, description, version and icon are read from the manifest.

### 3. Store listing tab

| Field | Value |
|-------|-------|
| Description | [Full description](#full-description) |
| Category | **Productivity → Tools** (or **Make Chrome Yours → Functionality & UI**) |
| Language | **English** |
| Store icon | `icons/icon-128.png` |
| Screenshots | `screenshot-1-shortcuts.png`, `screenshot-2-with-and-without.png`, `screenshot-3-steam-store.png`, in this order |
| Small promo tile | `promo-tile-440x280.png` |
| Marquee promo tile | Leave empty |
| Global promo video | Leave empty |
| Official URL | Leave as **None** |
| Homepage URL | `https://github.com/razingo/hotkeys-steamdb` |
| Support URL | `https://github.com/razingo/hotkeys-steamdb/issues` |
| Mature content | **No** |

Click **Save draft**.

### 4. Privacy tab

| Field | Value |
|-------|-------|
| Single purpose description | [Single purpose](#single-purpose) |
| `storage` justification | [storage](#storage-justification) |
| Host permission justification | [Host permission](#host-permission-justification) |
| Are you using remote code? | **No, I am not using remote code** |
| Data usage: what user data do you collect? | Tick **nothing** |
| Data usage: certifications | Tick all three |
| Privacy policy URL | `https://github.com/razingo/hotkeys-steamdb#privacy` |

Click **Save draft**.

### 5. Distribution tab

| Field | Value |
|-------|-------|
| Payments | **Free of charge** |
| Visibility | **Public** |
| Distribution | **All regions** |

Click **Save draft**.

### 6. Submit

1. Click **Submit for review**.
2. Choose whether to publish automatically once it's approved, or publish yourself afterwards.

Review usually takes a few days. You'll get an email with the result.

---

## Firefox Add-ons (AMO)

### 1. Create the developer account (once)

1. Go to the [Add-on Developer Hub](https://addons.mozilla.org/developers/) and sign in, or create a free Mozilla account.
2. Accept the developer agreement when asked. Set a display name for your developer profile, e.g. **razingo**; it's shown on the listing.

### 2. Upload the ZIP

1. Click **Submit a New Add-on**.
2. Choose **On this site** (listed on addons.mozilla.org).
3. Upload `dist/popup-hotkeys-for-steamdb-<version>.zip`.
4. Platforms: tick **Firefox** only. Leave **Firefox for Android** unticked: it hasn't been tested there.
5. Wait for the automatic validation, then click **Continue**. Warnings can be read but don't block the upload; errors do.
6. **Do you need to submit source code?** Answer **No**. The ZIP is the source code, with no minifier, bundler or build step that changes the code.

### 3. Describe the add-on

| Field | Value |
|-------|-------|
| Name | `Popup Hotkeys for SteamDB` |
| Add-on URL | `popup-hotkeys-for-steamdb` |
| Summary | [Summary](#summary) |
| Description | [Full description](#full-description) |
| This add-on is experimental | Leave unticked |
| Requires payment / non-free services | Leave unticked |
| Categories | **Games & Entertainment** (and optionally **Shopping**) |
| Support email | Leave empty |
| Support website | `https://github.com/razingo/hotkeys-steamdb/issues` |
| License | **MIT License** |
| This add-on has a privacy policy | Leave unticked: it collects no data |
| Notes to reviewer | [Notes to reviewer](#notes-to-reviewer) |
| Release notes (if asked) | The 1.5.0 text under [Release notes](#release-notes) |

Click **Submit Version**.

### 4. Add screenshots

Screenshots aren't part of the submission form.

1. Open the add-on in [My Add-ons](https://addons.mozilla.org/developers/addons).
2. Go to **Edit Product Page** → **Media**.
3. Add `screenshot-1-shortcuts.png`, `screenshot-2-with-and-without.png` and `screenshot-3-steam-store.png`, in this order.
4. Optionally, set **Homepage** to `https://github.com/razingo/hotkeys-steamdb`.

The icon comes from the manifest.

Automatic validation usually signs and lists the add-on within minutes to hours. A human review may still happen later.

---

## Microsoft Edge Add-ons (optional)

Edge users can already install from the Chrome Web Store, so this is optional.

1. Register at [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/) with a Microsoft account. It's free.
2. Click **Create new extension** and upload the same ZIP.
3. **Availability:** **Public**, all markets.
4. **Properties:**
   - Category: **Productivity**.
   - Privacy policy required: **No**.
   - Website: `https://github.com/razingo/hotkeys-steamdb`.
   - Support contact: `https://github.com/razingo/hotkeys-steamdb/issues`.
   - Mature content: **No**.
5. **Store listings → English:**
   - Description: [Full description](#full-description). It must be at least 250 characters; this one is.
   - Short description: [Summary](#summary).
   - Logo: Edge asks for a 300×300 PNG. Ask for one to be made; only 128 px exists now.
   - Small promo tile: `promo-tile-440x280.png`.
   - Screenshots: all three 1280×800 screenshots.
6. **Submission options → Notes for certification:** [Notes to reviewer](#notes-to-reviewer).
7. Click **Publish**. Review takes up to 7 business days.

---

## After approval

1. Update the README's **Install** section with links to the store listings, so people don't load it from source.
2. Optionally, add the store badges or links to the GitHub repository's **About** box (**Website** field).

---

## Updating the extension

Each store keeps its own copy, so every update is uploaded to each store separately. Users get it automatically once it's published: Chrome and Edge check every few hours, Firefox about once a day.

### 1. Prepare the update (once per update, for all stores)

1. **Make the changes and note them** in [CHANGELOG.md](../CHANGELOG.md), under a new heading with the new version number. Write for users: what's new, what changed, what's fixed.
2. **Raise `version` in `manifest.json`.** The stores refuse a version that isn't higher than the published one.
   - Bug fix: `1.5.0` → `1.5.1`
   - New feature: `1.5.1` → `1.6.0`
3. **Run the tests:**

   ```powershell
   npm test
   ```

   After pushing, check that the **Tests** badge on GitHub is green. GitHub also runs the tests this PC can't, in Firefox and with the real extension.
4. **Build the ZIP:**

   ```powershell
   powershell -ExecutionPolicy Bypass -File build.ps1
   ```

5. **Try the ZIP** in Chrome (unzip it into a **new, empty folder**, then **Load unpacked**) and in Firefox (**Load Temporary Add-on**, choose the ZIP). Then **refresh every open steamdb.info and Steam store tab**: Steam tabs keep the previous version of `steam-page-click.js` until they're reloaded. Quick check, signed in to Steam:
   - steamdb.info: hover a game, press Q, W, E, R.
   - A Steam game page: W, E, R, T, and again to undo.
   - The Steam front page: W and R on a Discounts & Events capsule, a recommendation box and a store-list row, and again to undo.
   - A sale page such as Specials: Q and W on a tile.
   - The settings page: change a shortcut, try the switches.
6. **Update the store texts and images** if what the extension does has changed: the [texts to copy](#texts-to-copy) below and the screenshots in this folder.
7. **Commit and push.**
8. **Publish a GitHub release** with the ZIP attached, so people installing from source can download it and every uploaded version is kept:

   ```powershell
   gh release create v1.5.1 dist/popup-hotkeys-for-steamdb-1.5.1.zip --title "1.5.1" --notes "See CHANGELOG.md for what's new."
   ```

   Use the new version number in all three places. This also creates the `v1.5.1` tag.

> [!IMPORTANT]
> Adding a permission or a new site to `manifest.json` makes Chrome and Firefox ask existing users to approve it, and Chrome **turns the extension off** until they do. Only add them when the update really needs them, and update the Privacy texts (justifications) in each store at the same time.

### 2. Chrome Web Store

1. Open the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) and click the extension.
2. Go to **Package** → **Upload new package**, and choose the new ZIP.
3. If what the extension does has changed, update the **Store listing** (description, screenshots) and the **Privacy** tab (justifications), then **Save draft**.
4. Click **Submit for review**. Choose whether to publish automatically once it's approved.

Updates are usually reviewed faster than the first submission: often within a day.

### 3. Firefox Add-ons

1. Open [My Add-ons](https://addons.mozilla.org/developers/addons) and click the add-on.
2. Click **Upload New Version** and choose the new ZIP. Wait for the validation, then **Continue**.
3. **Do you need to submit source code?** **No**.
4. **Release notes:** paste the new version's section from [CHANGELOG.md](../CHANGELOG.md), shortened if needed. Firefox users see them on the add-on page.
5. **Notes to reviewer:** paste [Notes to reviewer](#notes-to-reviewer) if anything about testing changed, otherwise leave it.
6. Click **Submit Version**.
7. If the description or screenshots changed, update them in **Edit Product Page**.

The new version is usually signed and available within minutes to hours.

### 4. Edge Add-ons (if listed)

1. Open [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/) and click the extension.
2. Click **Update**, go to **Packages**, and replace the package with the new ZIP.
3. Update **Store listings** if the description or screenshots changed.
4. Click **Publish**. Review takes up to 7 business days.

### 5. After the update is live

1. Check that each listing shows the new version.
2. Install it from each store once, refresh your Steam tabs, and try a shortcut or two.

---

## Texts to copy

### Summary

Used for Firefox's summary (max 250 characters) and Edge's short description.

```text
Keyboard shortcuts for the game popup on steamdb.info and for the Steam store: Q opens the store page in a background tab, W wishlists, E follows, R ignores. Unofficial, not affiliated with Steam or SteamDB.
```

### Full description

Used for all three stores. It's plain text, so it displays the same everywhere.

```text
Hover over a game on steamdb.info, press a key, done. No more moving the mouse into the popup and overshooting it so it disappears.

Shortcuts
• Q: open the game's Steam store page (in a background tab by default)
• W: add to or remove from your wishlist
• E: follow or unfollow
• R: ignore or unignore
• T: on Steam store game pages, ignore as "Played on Another Platform"

Features
• Change any shortcut, including combinations such as Ctrl + Shift + Q, or turn it off.
• Keys go by their physical position, so they work with any keyboard layout.
• Shortcuts never fire while you're typing in a search box or other text field.
• Warns you when a shortcut is also a common browser shortcut, such as Ctrl + F.
• A short cooldown on Wishlist, Follow and Ignore stops you from accidentally sending Steam too many requests.
• Choose whether the store page opens in the background or switches to it.
• Settings sync between your browsers if browser sync is on, or stay in one browser if you turn sync off.

Requirements
• Works on steamdb.info and on the Steam store: on game pages, W, E, R and T press Steam's own buttons, and on the front page, in store lists, recommendations and sale pages such as Specials you can hover over a game and press Q to open it, or W or R to add to or remove from your wishlist, or ignore or unignore (sale pages have no Ignore). The "ON WISHLIST" and "IGNORED" badges update straight away. Turn the Steam store shortcuts off in the settings if you prefer.
• On steamdb.info, Wishlist, Follow and Ignore need the official SteamDB extension and your Steam account linked to SteamDB. Without them, SteamDB's popup only shows the Store button, and only the Q shortcut works.
• On the Steam store, you need to be signed in to Steam for its Wishlist, Follow and Ignore buttons to show.

Privacy
The extension collects no data and sends no requests of its own: on Steam it only presses Steam's own buttons and menus, so Steam receives exactly what it would if you clicked. It only runs on steamdb.info and the Steam store, and only stores your shortcut settings.

Open source (MIT): https://github.com/razingo/hotkeys-steamdb
Report a bug or suggest an idea: https://github.com/razingo/hotkeys-steamdb/issues

This is an independent, unofficial extension. It is not affiliated with, endorsed by or sponsored by Steam, Valve Corporation or SteamDB. Steam is a trademark of Valve Corporation.
```

### Single purpose

Chrome, Privacy tab.

```text
Adds keyboard shortcuts to the Store, Wishlist, Follow and Ignore buttons in the game popup on steamdb.info and on the Steam store, so users can use those buttons without clicking them.
```

### storage justification

Chrome, Privacy tab.

```text
Saves the user's shortcut settings: which key triggers which button, whether the store page opens in a background tab, whether the shortcuts also work on Steam store pages, and whether these settings sync between the user's browsers. Nothing else is stored.
```

### Host permission justification

Chrome, Privacy tab. The content script's sites count as host permissions.

```text
The content script runs only on https://steamdb.info/* and https://store.steampowered.com/* (the Steam store) to listen for the shortcut keys and press the matching Store, Wishlist, Follow or Ignore button on the page, or in the options menu of a game in a store list. It doesn't read or send any page data. No other sites are accessed.
```

### Release notes

Firefox's **Release notes** field (also offered for the first version) and the GitHub release. Write them from [CHANGELOG.md](../CHANGELOG.md).

For 1.5.0, the first store version:

```text
First version on the store.
• Keyboard shortcuts for SteamDB's game popup: Q store page, W wishlist, E follow, R ignore.
• Also on the Steam store: game pages (W, E, R, and T for "Played on Another Platform"), the front page, store lists, recommendations and sale pages. Hover over a game and press a key; press again to undo.
• Wishlist and ignore badges update straight away.
• Change any shortcut, or turn the Steam store shortcuts and settings sync on or off, in the settings.
```

For later versions, for example:

```text
1.6.0
• New: ...
• Fixed: ...
```

### Notes to reviewer

Firefox and Edge.

```text
How to test:
1. Open https://steamdb.info/ (for example https://steamdb.info/charts/).
2. Hover over a game so its popup appears.
3. Press Q: the game's Steam store page opens in a new background tab.

W (Wishlist), E (Follow) and R (Ignore) only work when the official SteamDB extension is installed and a Steam account is linked to SteamDB; without them, SteamDB's popup only shows the Store button.

On a Steam store game page (e.g. https://store.steampowered.com/app/730/), W, E and R press Steam's own Wishlist, Follow and Ignore buttons, and T picks "Played on Another Platform". In store lists (e.g. the tabs on https://store.steampowered.com/), hovering over a game and pressing Q, W or R opens its page, or picks "Add to your wishlist" or "Ignore" from its options menu. The same works on the capsules under Discounts & Events and Your Personal Calendar (through their ⋯ menu) and on the recommendation boxes at the bottom of the front page. Pressing W or R again removes the game from the wishlist or unignores it. On sale pages such as https://store.steampowered.com/specials, hovering over a game tile and pressing W presses the tile's own wishlist button. Steam only shows these when signed in.

Shortcuts can be changed by clicking the toolbar icon.

The code is not minified or bundled: the ZIP contains the source as written. Source: https://github.com/razingo/hotkeys-steamdb
No data is collected; the only permission is storage, for the user's shortcut settings.
```
