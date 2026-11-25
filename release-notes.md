## Open a note when the screen unlocks

Tray-Extended can now open a note of your choice when you unlock your screen, on Windows and macOS.

- **Unlock mode** decides when the note opens: the first unlock of the day, week (Monday to Sunday) or month, every unlock, every *n*th unlock, or only after a break of at least **Minimum locked minutes**. Progress is kept per vault and device, so a daily rule fires once per day even across restarts.
- **Unlock note** selects the file to open. It is a native Obsidian dropdown that suggests every Markdown and canvas file in the vault.
- **Unlock tab** decides where it opens: a regular tab, or a tab pinned to the tab bar that stays until you close it.
- **Unlock screen** decides which screen the window moves to: stay where it is, the primary screen, or the screen the pointer is on.
- **Unlock display** decides how the window looks afterwards: keep the current layout, maximize the window, maximize it without sidebars or with the left sidebar, or go fullscreen without sidebars or with the left sidebar.

Canvas notes are supported, and the note path may omit the file extension or differ in case, so a copied path usually works as-is. If the note was moved or deleted, the plugin says so instead of creating a replacement.

## Test it without locking your computer

Run **Tray-Extended: Toggle unlock debug mode** in the command palette, then pick **Simulate screen unlock** in the tray menu. A simulation always opens the note, even when the daily rule already fired today.

## Other changes

- The quick note template and unlock note fields use Obsidian's native dropdown instead of a browser autocomplete list.
- New URI handlers `obsidian://tray-extended/moveWindowToPrimaryDisplay` and `obsidian://tray-extended/moveWindowToCursorDisplay` bring the window onto the primary display or the display the pointer is on, keeping its size and maximized state.
- A global hotkey that cannot be registered is now reported instead of failing silently, and a leftover legacy **Tray** plugin is detected as the likely cause.
