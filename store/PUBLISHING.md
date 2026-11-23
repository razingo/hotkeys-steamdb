# Publishing to the browser stores

Step-by-step instructions for the Chrome Web Store, Firefox Add-ons and (optionally) Microsoft Edge Add-ons, with every text ready to copy.

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
2. Upload `dist/popup-hotkeys-for-steamdb-1.4.0.zip`.

The name, description, version and icon are read from the manifest.

### 3. Store listing tab

| Field | Value |
|-------|-------|
| Description | [Full description](#full-description) |
| Category | **Productivity → Tools** (or **Make Chrome Yours → Functionality & UI**) |
| Language | **English** |
| Store icon | `icons/icon-128.png` |
| Screenshots | `screenshot-1-shortcuts.png`, `screenshot-2-with-and-without.png` |
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
3. Upload `dist/popup-hotkeys-for-steamdb-1.4.0.zip`.
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

Click **Submit Version**.

### 4. Add screenshots

Screenshots aren't part of the submission form.

1. Open the add-on in [My Add-ons](https://addons.mozilla.org/developers/addons).
2. Go to **Edit Product Page** → **Media**.
3. Add `screenshot-1-shortcuts.png` and `screenshot-2-with-and-without.png`.
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
   - Screenshots: both 1280×800 screenshots.
6. **Submission options → Notes for certification:** [Notes to reviewer](#notes-to-reviewer).
7. Click **Publish**. Review takes up to 7 business days.

---

## After approval

1. Update the README's **Install** section with links to the store listings, so people don't load it from source.
2. For updates:
   1. Raise `version` in `manifest.json`.
   2. Run `build.ps1`.
   3. Upload the new ZIP:
      - **Chrome:** **Package** → **Upload new package**.
      - **Firefox:** **Upload New Version**.
      - **Edge:** **Update**.

---

## Texts to copy

### Summary

Used for Firefox's summary (max 250 characters) and Edge's short description.

```text
Keyboard shortcuts for the game popup on steamdb.info: S opens the Steam store page in a background tab, W wishlists, F follows, I ignores. Unofficial, not affiliated with Steam or SteamDB.
```

### Full description

Used for all three stores. It's plain text, so it displays the same everywhere.

```text
Hover over a game on steamdb.info, press a key, done. No more moving the mouse into the popup and overshooting it so it disappears.

Shortcuts
• S: open the game's Steam store page (in a background tab by default)
• W: add to or remove from your wishlist
• F: follow or unfollow
• I: ignore or unignore

Features
• Change any shortcut, including combinations such as Ctrl + Shift + Q, or turn it off.
• Keys go by their physical position, so they work with any keyboard layout.
• Shortcuts never fire while you're typing in a search box or other text field.
• A short cooldown on Wishlist, Follow and Ignore stops you from accidentally sending Steam too many requests.
• Choose whether the store page opens in the background or switches to it.
• Settings sync between your browsers if browser sync is on.

Requirements
• Works only on steamdb.info.
• Wishlist, Follow and Ignore need the official SteamDB extension and your Steam account linked to SteamDB. Without them, SteamDB's popup only shows the Store button, and only the S shortcut works.

Privacy
The extension collects no data and makes no network requests of its own. It only runs on steamdb.info, and only stores your shortcut settings.

Open source (MIT): https://github.com/razingo/hotkeys-steamdb
Report a bug or suggest an idea: https://github.com/razingo/hotkeys-steamdb/issues

This is an independent, unofficial extension. It is not affiliated with, endorsed by or sponsored by Steam, Valve Corporation or SteamDB. Steam is a trademark of Valve Corporation.
```

### Single purpose

Chrome, Privacy tab.

```text
Adds keyboard shortcuts to the Store, Wishlist, Follow and Ignore buttons in the game popup on steamdb.info, so users can use those buttons without clicking them.
```

### storage justification

Chrome, Privacy tab.

```text
Saves the user's shortcut settings (which key triggers which button, and whether the store page opens in a background tab). Nothing else is stored.
```

### Host permission justification

Chrome, Privacy tab. The content script on steamdb.info counts as a host permission.

```text
The content script runs only on https://steamdb.info/* to listen for the shortcut keys and press the matching button in SteamDB's game popup. It doesn't read or send any page data. No other sites are accessed.
```

### Notes to reviewer

Firefox and Edge.

```text
How to test:
1. Open https://steamdb.info/ (for example https://steamdb.info/charts/).
2. Hover over a game so its popup appears.
3. Press S: the game's Steam store page opens in a new background tab.

W (Wishlist), F (Follow) and I (Ignore) only work when the official SteamDB extension is installed and a Steam account is linked to SteamDB; without them, SteamDB's popup only shows the Store button.

Shortcuts can be changed by clicking the toolbar icon.

The code is not minified or bundled: the ZIP contains the source as written. Source: https://github.com/razingo/hotkeys-steamdb
No data is collected; the only permission is storage, for the user's shortcut settings.
```
