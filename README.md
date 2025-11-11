# Crossdeck

A dedicated browser for X (formerly Twitter) with grid-based multi-profile support.

## Features

- **Multiple Profiles**: Create and manage multiple profiles, each with separate login sessions
- **Grid Layout**: View all tabs simultaneously in an auto-adjusting grid
- **Profile-Based Tabs**: Each tab can use a different profile/account
- **Clean Interface**: Dark-themed, distraction-free browsing experience

## Limitations

- **WebAuthn/Passkeys**: Not supported due to Electron sandboxing limitations. Use traditional password authentication instead.

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

### Build macOS App

To create a distributable macOS application:

```bash
# Create a DMG and ZIP file (recommended)
npm run dist

# Or just create an unpacked app in release folder
npm run pack
```

The built app will be in the `release/` folder:
- **X Browser-1.0.0-universal.dmg** - Disk image for easy installation
- **X Browser-1.0.0-universal-mac.zip** - Zipped app bundle
- Works on both Intel and Apple Silicon Macs (universal build)

## How to Use

1. **Create Profiles**: Click the settings icon (⚙️) to manage profiles. Create profiles for each X/Twitter account you want to use.

2. **Create Tabs**: Select a profile from the dropdown, then click the "+" button to create a new tab with that profile.

3. **View All Tabs**: All tabs display simultaneously in a responsive grid layout that adapts to your window size.

4. **Switch Active Tab**: Click any tab to highlight it with a blue border.

5. **Close Tabs**: Click the × button on any tab to close it.

## Architecture

- Built with Electron and TypeScript
- Uses Electron's session partitions for profile isolation
- Webview tags for rendering X/Twitter in isolated contexts
- CSS Grid for responsive multi-view layout
