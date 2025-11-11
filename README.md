# Crossdeck

A dedicated browser for X (formerly Twitter) with horizontal multi-tab layout and multi-profile support.

## Features

- **Multiple Profiles**: Create, rename, and manage multiple profiles, each with separate login sessions
- **Horizontal Scrolling Layout**: View all tabs simultaneously in a horizontal scrolling layout with minimum 400px width per tab
- **Profile-Based Tabs**: Each tab can use a different profile/account
- **Keyboard Shortcuts**: Switch between tabs instantly with Cmd/Ctrl+1-9 (works even when webview is focused)
- **Drag & Drop Reordering**: Reorder tabs by dragging tab headers
- **Session Persistence**: Tabs and their URLs are automatically saved and restored on restart
- **Clean Interface**: Dark-themed, distraction-free browsing experience with X/Twitter header automatically hidden
- **Profile Management**: Create, rename, and delete profiles through the settings modal

## Limitations

- **WebAuthn/Passkeys**: Not supported due to Electron sandboxing limitations. Use traditional password authentication instead.
- **Profile Rename**: When renaming a profile, login session is not transferred (you'll need to log in again with the new profile name)

## Installation

```bash
npm install
```

## Usage

### Development Mode
```bash
npm run dev
```

### Build and Run
```bash
npm start
```

### Build Distributable App

To create distributable applications for macOS, Linux, and Windows:

```bash
# Create distribution packages (DMG, AppImage, NSIS installer)
npm run dist

# Or just create an unpacked app in release folder for testing
npm run pack
```

The built apps will be in the `release/` folder:
- **macOS**: crossdeck-0.0.1-universal.dmg and crossdeck-0.0.1-universal-mac.zip (works on both Intel and Apple Silicon)
- **Linux**: crossdeck-0.0.1.AppImage
- **Windows**: crossdeck Setup 0.0.1.exe

## How to Use

### Managing Profiles

1. **Create Profiles**: Click the settings icon (⚙️) to open the profile management modal. Enter a profile name and click "Add Profile" to create profiles for each X/Twitter account you want to use.

2. **Rename Profiles**: In the profile management modal, click "Rename" next to any profile. An inline input will appear - enter the new name and press Enter or click ✓ to confirm.

3. **Delete Profiles**: Click "Delete" next to any profile to remove it. If tabs are using that profile, you'll be prompted to confirm closing them.

### Working with Tabs

1. **Create Tabs**: Select a profile from the dropdown in the toolbar, then click the "+" button to create a new tab with that profile.

2. **View All Tabs**: All tabs display simultaneously in a horizontal scrolling layout. Each tab shows a profile badge and page title in its header.

3. **Switch Active Tab**:
   - Click the tab header
   - Click anywhere inside the webview
   - Use keyboard shortcuts: **Cmd+1-9** (macOS) or **Ctrl+1-9** (Windows/Linux) to switch to tabs by position (left to right)

4. **Reorder Tabs**: Drag any tab header and drop it in a new position to reorder tabs. Tab order is preserved across restarts.

5. **Close Tabs**: Click the × button on any tab header to close it.

### Keyboard Shortcuts

- **Cmd/Ctrl + 1-9**: Switch to the corresponding tab (1 = leftmost tab, 2 = second from left, etc.)
  - These shortcuts work even when a webview has focus
  - If the tab is off-screen, it will automatically scroll into view

## Architecture

- Built with Electron and TypeScript
- Uses Electron's session partitions for profile isolation
- Webview tags for rendering X/Twitter in isolated contexts
- Menu accelerators for global keyboard shortcuts
- CSS Grid with horizontal scrolling for multi-tab layout
- localStorage for persisting tabs and profiles
