# crossdeck for iPad

Native iPad port of crossdeck (the Electron app in the repository root).
SwiftUI + WKWebView, iPadOS 17+.

## Why a rewrite

Electron does not exist on iPadOS, so the iPad version is a native app
that reproduces the desktop behaviour with WebKit equivalents:

| Desktop (Electron)                              | iPad (this app)                                        |
| ----------------------------------------------- | ------------------------------------------------------ |
| `session.fromPartition("persist:<profile-id>")` | `WKWebsiteDataStore(forIdentifier: profile.id)` — one persistent, isolated store per profile (cookies / localStorage / IndexedDB) |
| `<webview>` columns, horizontal scroll, min 400px | `WKWebView` columns in a horizontal `ScrollView`, 400pt wide |
| `executeJavaScript` on `dom-ready`              | `WKUserScript` at document end (`Scripts.swift`)       |
| Profiles in `profiles.json`                     | Same JSON format in Application Support               |
| Tabs in `localStorage` (`xbrowser-tabs`)        | Same fields in `tabs.json`                             |
| WebAuthn disabled (Electron sandbox limit)      | **Enabled** — WKWebView supports passkeys              |

Ported 1:1: profile create / rename / delete (renaming preserves the
session, deleting wipes the data store), tab persistence and restore,
drag-to-reorder tab headers, auto-reload every 15s on home timelines,
promoted-post cleanup, sidebar hiding, zoom / reload / back / forward,
column fullscreen, and the Cmd+1-9 / Cmd+R / Cmd+G / Cmd+\ / Cmd+0/+/- /
Cmd+[ ] hardware-keyboard shortcuts.

Known intentional differences:

- New tabs are created from the **+** menu (choose a profile) instead of
  a profile dropdown + button.
- `window.open` loads in the same column instead of a popup window.
- A desktop Safari user agent is sent so X serves the desktop layout.

## Installing (AltStore Classic / SideStore)

The app is published as an AltStore source, so it can be installed and
updated from AltStore Classic or SideStore without handling .ipa files:

1. Copy this source URL:

   ```
   https://raw.githubusercontent.com/tsuzu/crossdeck/main/apps.json
   ```

2. AltStore Classic: **Browse** tab -> **Sources** (top right) -> **+**
   -> paste the URL -> **Add**.
   SideStore: **Sources** tab -> **+** -> paste the URL.
3. Install **crossdeck** from the source. Updates appear in the store
   app automatically when a new version is published.

How publishing works: every merge to `main` rebuilds the .ipa in
`.github/workflows/ios.yml`; the `publish` job then uploads it to the
GitHub Release `ios-v<VERSION>` and regenerates `apps.json` at the
repository root (version / size / date) if they changed.

Manual fallback: download `crossdeck.ipa` from the
[`ios-v*` releases](https://github.com/tsuzu/crossdeck/releases) and add
it via **My Apps -> +** in AltStore, or through AltKeeper.

## Building

The Xcode project is generated with [XcodeGen](https://github.com/yonaskolb/XcodeGen):

```bash
brew install xcodegen
cd ios
xcodegen generate
open Crossdeck.xcodeproj   # or build with xcodebuild
```

Signing is disabled in `project.yml` on purpose: the app is distributed
by sideloading (AltStore / AltKeeper), which re-signs it on install.

## CI

`.github/workflows/ios.yml` builds the app, boots an iPad simulator,
launches the app as a smoke test (screenshot is uploaded as an artifact),
and packages an unsigned `crossdeck.ipa` artifact ready for AltStore.
