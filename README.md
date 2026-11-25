<img alt="" src="tray.png" align="right"  height="128px">

**Tray-Extended** is a fork of [dragonwocky's original Tray plugin](https://github.com/dragonwocky/obsidian-tray).
It can be used to launch the [Obsidian](https://obsidian.md/) app
on system startup and run it in the background, adding global hotkeys and a tray menu to
toggle window visibility and create quick notes from anywhere in your operating system.

## Configuration

### Window management

| Option                     | Description                                                                                                                                                                                                                       | Default                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------| ------------------------------ |
| Launch on startup          | Open Obsidian automatically whenever you log into your computer.                                                                                                                                                                  | Disabled                       |
| Hide on launch             | Minimises Obsidian automatically whenever the app is launched. If the "Run in background" option is enabled, windows will be hidden to the system tray/menubar instead of minimised to the taskbar/dock.                          | Disabled                       |
| Run in background          | Hide the app and continue to run it in the background instead of quitting it when pressing the window close button or toggle focus hotkey. Launching Obsidian again, including through an `obsidian://` URI, restores and focuses hidden windows. | Disabled                       |
| Hide taskbar icon          | Hides the window's icon from from the dock/taskbar. This may not work on Linux-based OSes.                                                                                                                                        | Disabled                       |
| Create tray icon           | Add an icon to your system tray/menubar to bring hidden Obsidian windows back into focus on click or force a full quit/relaunch of the app through the right-click menu.                                                          | Enabled                        |
| Tray icon image            | Set the image used by the tray/menubar icon. Recommended size: 16x16                                                                                                                                                              | ![](obsidian.png)              |
| Tray icon tooltip          | Set a title to identify the tray/menubar icon by. The `{{vault}}` placeholder will be replaced by the vault name.                                                                                                                 | `{{vault}} \| Obsidian`        |
| Toggle window focus hotkey | This hotkey is registered globally and will be detected even if Obsidian does not have keyboard focus. Format: [Electron accelerator](https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts#accelerators)            | <kbd>CmdOrCtrl+Shift+Tab</kbd> |

The `Relaunch Obsidian` and `Close Vault` actions can be triggered from the tray/menubar context menu,
or with the in-app command palette (search for "Tray: Relaunch Obsidian" or "Tray: Close Vault").
Hotkeys can be assigned to the commands via Obsidian's built-in hotkey manager.

If a global hotkey is unavailable, Tray-Extended shows a notice when it starts. A shortcut can only
be registered by one application at a time. After migrating from the legacy `Tray` plugin, disable it
before enabling `Tray-Extended` so it cannot retain the same global hotkeys.

### URI shortcut

Tray-Extended registers these URI handlers:

| URI | Behavior |
| --- | --- |
| `obsidian://tray-extended/toggleWindows` | Toggles vault-window visibility. |
| `obsidian://tray-extended/showWindow` | Ensures the vault window is visible and focused. It also cancels the one-time startup hide so the window remains visible during launch. |
| `obsidian://tray-extended/showWindow?ignoreStartupHide=false` | Ensures the vault window is visible but permits a pending startup hide to run. |
| `obsidian://tray-extended/hideLeftSidebar` | Collapses the left workspace sidebar. Safe to call repeatedly. |
| `obsidian://tray-extended/moveWindowToPrimaryDisplay` | Shows each vault window on the primary display. Normal windows retain their size when it fits, or are reduced to the primary work area; maximized windows remain maximized. |

On Linux Wayland desktop environments, bind a system shortcut with
`xdg-open obsidian://tray-extended/showWindow`.

### Unlock

To show your morning note, choose **First unlock of the day** under **Unlock mode**, then select its vault-relative path under **Unlock note**. The field suggests every Markdown and canvas file in the vault. The feature is off by default. It responds to screen unlocks on Windows and macOS while the vault is open (including hidden in the tray). A fresh sign-in, opening Obsidian, or waking the computer without unlocking does not count.

Choose the first unlock of each local **day**, **week** (Monday–Sunday), or **month**; **every unlock**; or **every Nth unlock**. For example, an interval of 3 opens the note on unlocks 3, 6, 9, and so on. Progress survives restarts and is local to this vault on this device. If the note was moved or deleted, select its new path; the plugin never creates a replacement. The path may omit the extension and does not have to match the case, so a copied path usually works as-is.

Choose **Unlock after a long break** to open the note only after the screen has been continuously locked for **Minimum locked minutes** (default: **60**). Short locks do not add up. The vault must stay open from lock to unlock so the plugin can measure the break.

To test without locking your computer, run **Tray-Extended: Toggle unlock debug mode** in the command palette. With **Create tray icon** enabled, choose **Simulate screen unlock** in the tray menu. A simulation always opens the note, even when a daily rule already fired today; it still uses the configured rule otherwise, and long-break mode simulates exactly the configured minimum locked time. Run the command again to remove the item; debug mode also turns off when the plugin reloads.

| Unlock tab | Where the note opens |
| --- | --- |
| New tab (default) | Opens the note in a regular tab. |
| Pinned tab | Opens the note in a tab pinned to the tab bar, so it stays there until you close it. |

| Unlock display | What happens when the note opens |
| --- | --- |
| Keep the current layout (default) | Bring Obsidian forward without changing window size or sidebars. |
| Maximize the window | Maximize the window, keeping window controls and the sidebars as they are. |
| Maximize without sidebars | Maximize the window and collapse both sidebars. |
| Maximize with the left sidebar | Maximize the window, open the left sidebar, and collapse the right sidebar. |
| Fullscreen without sidebars | Enter native fullscreen and collapse both sidebars. |
| Fullscreen with the left sidebar | Enter native fullscreen, open the left sidebar, and collapse the right sidebar. |

### Quick notes

| Option                 | Description                                                                                                                                                                                                            | Default                      |
| ---------------------- | -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------| ---------------------------- |
| Quick note location    | New quick notes will be placed in this folder.                                                                                                                                                                         |                              |
| Quick note date format | New quick notes will use a filename of this pattern. Format: [Moment.js format string](https://momentjs.com/docs/#/displaying/format/)                                                                                 | `YYYY-MM-DD`                 |
| Quick note template    | Optional vault-relative Markdown file. The field suggests notes in the vault; combined with the template mode it controls how the template is applied.                                                                |                              |
| Quick note template mode | Controls how the configured template is applied: `Ask each time` (default), `Always apply`, or `Never apply`.                                                                                                                  | `Ask each time`              |
| Quick note hotkey      | This hotkey is registered globally and will be detected even if Obsidian does not have keyboard focus. Format: [Electron accelerator](https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts#accelerators) | <kbd>CmdOrCtrl+Shift+Q</kbd> |

The template is copied as-is. To use dynamic template expressions, install
[Templater](https://github.com/SilentVoid13/Templater) and enable its trigger for new
file creation.

### Beta testing with BRAT

BRAT installs GitHub release assets rather than branch contents. The **Beta Release**
workflow is manual: start it from the **Actions** tab and it publishes a prerelease
containing `main.js` and `manifest.json` without waiting for approval. A manual run can
supply a custom prerelease version such as `1.0.11-beta.0`; otherwise it derives one from
`manifest.json` and the Actions run number. Add the repository to BRAT and select that
prerelease. The normal release workflow only publishes from `main`.

## Installation

### Obsidian Marketplace

1. In Obsidian, navigate to **Settings** → **Community plugins**.
2. Press the **Browse** button beside the **Community plugins** option.
3. Search for `Tray-Extended` in the **Filter** text input.
4. Select `Tray-Extended` and press **Install**.
5. Once the plugin has finished installing, press **Enable**.
6. Press the **Options** button.
7. Configure the plugin as you wish.
8. You're done! 🎉

### Manual

1. Download this repository.
2. Copy it into your vault's `.obsidian/plugins/tray-extended` directory.
3. In Obsidian, navigate to **Settings** → **Community plugins**.
4. Press **Turn on community plugins** if you haven't already.
5. Find `Tray-Extended` in the list of **Installed plugins** and toggle it on.
6. Press the **⚙️** button beside the toggle you just used.
7. Configure the plugin as you wish.
8. You're done! 🎉

## Development

Run the checks locally with:

```sh
node --check main.js   # syntax check
node --test            # all tests in test/
```

Pipelines in `.github/workflows`:

| Workflow    | Trigger                          | What it does                                                          |
| ----------- | -------------------------------- | --------------------------------------------------------------------- |
| CI          | every push, every pull request   | syntax check and the test suite                                        |
| Release     | merge to `main`                  | opens the version bump pull request, publishes the release once it is merged |
| Beta Release| manual (`workflow_dispatch`)     | publishes a prerelease for manual testing                              |

## Disclaimer

This plugin is provided as-is and is designed for personal use. It has not
been tested on every platform and may not work as expected with all future updates.
If you notice something is not working as intended, please open a bug report or
pull request so it can be fixed.

The Obsidian logo is distributed with this plugin as the default image for the system
tray/menubar icon, intended to be used within Obsidian. This logo remains the property
of the Obsidian project and is not under the same license as the plugin's source code.
