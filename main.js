/**
 * obsidian-tray v0.3.5
 * (c) 2023 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/obsidian-tray/) under the MIT license
 */

"use strict";

const LOG_PREFIX = "obsidian-tray",
  LOG_LOADING = "loading",
  LOG_CLEANUP = "cleaning up",
  LOG_SHOWING_WINDOWS = "showing windows",
  LOG_HIDING_WINDOWS = "hiding windows",
  LOG_WINDOW_CLOSE = "intercepting window close",
  LOG_TRAY_ICON = "creating tray icon",
  LOG_REGISTER_HOTKEY = "registering hotkey",
  LOG_UNREGISTER_HOTKEY = "unregistering hotkey",
  LOG_REGISTER_URI_HANDLER = "registering URI handler",
  LEGACY_PLUGIN_ID = "tray",
  ACTION_QUICK_NOTE = "Quick Note",
  ACTION_SHOW = "Show Vault",
  ACTION_HIDE = "Hide Vault",
  ACTION_RELAUNCH = "Relaunch Obsidian",
  ACTION_CLOSE = "Close Vault",
  ACTION_APPLY_TEMPLATE = "Apply quick note template?",
  DEFAULT_DATE_FORMAT = "YYYY-MM-DD",
  ACCELERATOR_FORMAT = `
    This hotkey is registered globally and will be detected even if Obsidian does
    not have keyboard focus. Format:
    <a href="https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts#accelerators" target="_blank" rel="noopener">
    Electron accelerator</a>
  `,
  MOMENT_FORMAT = `
    Format:
    <a href="https://momentjs.com/docs/#/displaying/format/" target="_blank" rel="noopener">
    Moment.js format string</a>
  `,
  // 16x16 base64 obsidian icon: generated from obsidian.asar/icon.png
  OBSIDIAN_BASE64_ICON = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAHZSURBVDhPlZKxTxRBFMa/XZcF7nIG7mjxjoRCwomJxgsFdhaASqzQxFDzB1AQKgstLGxIiBQGJBpiCCGx8h+wgYaGgAWNd0dyHofeEYVwt/PmOTMZV9aDIL/s5pvZvPfN9yaL/+HR3eXcypta0m4juFbP5GHuXc9IbunDFc9db/G81/ZzhDMN7g8td47mll4R5BfHwZN4LOaA+fHa259PbUmIYzWkt3e2NZNo3/V9v1vvU6kkstk+tLW3ItUVr/m+c3N8MlkwxYqmBFcbwUQQCNOcyVzDwEAWjuPi5DhAMV/tKOYPX5hCyz8Gz1zX5SmWjBvZfmTSaRBJkGAIoxJHv+pVW2yIGNxOJ8bUVNcFEWLxuG1ia6JercTbttwQTeDwPS0kCMXiXtgk/jQrFUw7ptYSMWApF40yo/ytjHq98fdk3ayVE+cn2CxMb6ruz9qAJKFUKoWza1VJSi/n0+ffgYHdWW2gHuxXymg0gjCB0sjpmiaDnkL3RzDyzLqBUKns2ztQqUR0fk2TwSrGSf1eczqF5vsPZRCQSSAFLk6gqctgQRkc6TWRQLV2YMYQki9OoNkqzFQ9r+WOGuW5CrJbOzyAlPKr6MSGLbkcDwbf35oY/jRkt6cAfgNwowruAMz9AgAAAABJRU5ErkJggg==`,
  log = (message) => console.log(`${LOG_PREFIX}: ${message}`);

let tray, plugin, startupHideCancelled = false;
const obsidian = require("obsidian"),
  { app, Tray, Menu } = require("electron").remote,
  { nativeImage, BrowserWindow } = require("electron").remote,
  { getCurrentWindow, globalShortcut } = require("electron").remote;

const vaultWindows = new Set(),
  maximizedWindows = new Set(),
  getWindows = () => [...vaultWindows],
  observeWindows = () => {
    const onWindowCreation = (win) => {
      vaultWindows.add(win);
      win.setSkipTaskbar(plugin.settings.hideTaskbarIcon);
      win.on("close", () => {
        if (win !== getCurrentWindow()) vaultWindows.delete(win);
      });
      // preserve maximised windows after minimisation
      if (win.isMaximized()) maximizedWindows.add(win);
      win.on("maximize", () => maximizedWindows.add(win));
      win.on("unmaximize", () => maximizedWindows.delete(win));
    };
    onWindowCreation(getCurrentWindow());
    getCurrentWindow().webContents.on("did-create-window", onWindowCreation);
    if (process.platform === "darwin") {
      // on macos, the "hide taskbar icon" option is implemented
      // via app.dock.hide(): thus, the app as a whole will be
      // hidden from the dock, including windows from other vaults.
      // when a vault is closed via the "close vault" button,
      // the cleanup process will call app.dock.show() to restore
      // access to any other open vaults w/out the tray enabled
      // => thus, this listener is required to re-hide the dock
      // if switching to another vault with the option enabled
      getCurrentWindow().on("focus", () => {
        if (plugin.settings.hideTaskbarIcon) hideTaskbarIcons();
      });
    }
  },
  showWindows = () => {
    log(LOG_SHOWING_WINDOWS);
    getWindows().forEach((win) => {
      if (maximizedWindows.has(win)) win.maximize();
      else win.show();
      win.focus();
    });
  },
  hideWindows = () => {
    log(LOG_HIDING_WINDOWS);
    getWindows().forEach((win) => [
      win.isFocused() && win.blur(),
      plugin.settings.runInBackground ? win.hide() : win.minimize(),
    ]);
  },
  toggleWindows = (checkForFocus = true) => {
    const openWindows = getWindows().some((win) => {
      return (!checkForFocus || win.isFocused()) && win.isVisible();
    });
    if (openWindows) hideWindows();
    else showWindows();
  };

const showWindow = (params = {}) => {
    if (params.ignoreStartupHide !== "false") startupHideCancelled = true;
    showWindows();
  },
  hideLeftSidebar = () => plugin.app.workspace.leftSplit.collapse(),
  onSecondInstance = () => showWindows(),
  onWindowClose = (event) => event.preventDefault(),
  onWindowUnload = (event) => {
    log(LOG_WINDOW_CLOSE);
    getCurrentWindow().hide();
    event.stopImmediatePropagation();
    // setting return value manually is more reliable than
    // via `return false` according to electron
    event.returnValue = false;
  },
  interceptWindowClose = () => {
    // intercept in renderer
    window.addEventListener("beforeunload", onWindowUnload, true);
    // intercept in main: is asynchronously executed when registered
    // from renderer, so won't prevent close by itself, but counteracts
    // the 3-second delayed window force close in obsidian.asar/main.js
    getCurrentWindow().on("close", onWindowClose);
  },
  allowWindowClose = () => {
    getCurrentWindow().removeListener("close", onWindowClose);
    window.removeEventListener("beforeunload", onWindowUnload, true);
  };

const hideTaskbarIcons = () => {
    getWindows().forEach((win) => win.setSkipTaskbar(true));
    if (process.platform === "darwin") app.dock.hide();
  },
  showTaskbarIcons = () => {
    getWindows().forEach((win) => win.setSkipTaskbar(false));
    if (process.platform === "darwin") app.dock.show();
  },
  setLaunchOnStartup = () => {
    const { launchOnStartup, runInBackground, hideOnLaunch } = plugin.settings;
    app.setLoginItemSettings({
      openAtLogin: launchOnStartup,
      openAsHidden: runInBackground && hideOnLaunch,
    });
  };

const cleanup = () => {
    log(LOG_CLEANUP);
    unregisterHotkeys();
    showTaskbarIcons();
    allowWindowClose();
    app.removeListener("second-instance", onSecondInstance);
    destroyTray();
  },
  relaunchApp = () => {
    app.relaunch();
    app.exit(0);
  },
  closeVault = () => {
    log(LOG_CLEANUP);
    cleanup();
    const vaultWindows = getWindows(),
      obsidianWindows = BrowserWindow.getAllWindows();
    if (obsidianWindows.length === vaultWindows.length) {
      // quit app directly if only remaining windows are in the
      // current vault - necessary for successful quit on macos
      app.quit();
    } else vaultWindows.forEach((win) => win.destroy());
  };

class TemplateConfirmModal extends obsidian.Modal {
  constructor(app, onConfirm, onCancel) {
    super(app);
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
    this.confirmed = false;
  }
  onOpen() {
    this.setTitle(ACTION_APPLY_TEMPLATE);
    this.contentEl.createEl("p", {
      text: "Copy the configured template into this quick note?",
    });
    new obsidian.Setting(this.contentEl)
      .addButton((button) => button.setButtonText("No").onClick(() => this.close()))
      .addButton((button) =>
        button.setButtonText("Yes").setCta().onClick(() => {
          this.confirmed = true;
          this.onConfirm();
          this.close();
        })
      );
  }
  onClose() {
    if (!this.confirmed) this.onCancel();
    this.contentEl.empty();
  }
}

const addQuickNote = async () => {
    const { quickNoteLocation, quickNoteDateFormat, quickNoteTemplate } = plugin.settings,
      pattern = quickNoteDateFormat || DEFAULT_DATE_FORMAT,
      date = obsidian.moment().format(pattern),
      name = obsidian
        .normalizePath(`${quickNoteLocation ?? ""}/${date}`)
        .replace(/\*|"|\\|<|>|:|\||\?/g, "-"),
      // manually create and open file instead of depending
      // on createAndOpenMarkdownFile to force file creation
      // relative to the root instead of the active file
      // (in case user has default location for new notes
      // set to "same folder as current file")
      leaf = plugin.app.workspace.getLeaf(),
      root = plugin.app.fileManager.getNewFileParent(""),
      openMode = { active: true, state: { mode: "source" } };
    let content = "";
    if (quickNoteTemplate) {
      const applyTemplate = await new Promise((resolve) => {
        new TemplateConfirmModal(plugin.app, () => resolve(true), () => resolve(false)).open();
      });
      if (applyTemplate) {
        const template = plugin.app.vault.getAbstractFileByPath(
          obsidian.normalizePath(quickNoteTemplate)
        );
        if (template instanceof obsidian.TFile) {
          content = await plugin.app.vault.read(template);
        } else {
          new obsidian.Notice(`Quick note template not found: ${quickNoteTemplate}`);
        }
      }
    }
    plugin.app.fileManager
      .createNewMarkdownFile(root, name, content)
      .then((file) => leaf.openFile(file, openMode));
    showWindows();
  },
  replaceVaultName = (str) => {
    return str.replace(/{{vault}}/g, plugin.app.vault.getName());
  },
  destroyTray = () => {
    tray?.destroy();
    tray = undefined;
  },
  createTrayIcon = () => {
    destroyTray();
    if (!plugin.settings.createTrayIcon) return;
    log(LOG_TRAY_ICON);
    const obsidianIcon = nativeImage.createFromDataURL(
        plugin.settings.trayIconImage ?? OBSIDIAN_BASE64_ICON
      ),
      contextMenu = Menu.buildFromTemplate([
        {
          type: "normal",
          label: ACTION_QUICK_NOTE,
          accelerator: plugin.settings.quickNoteHotkey,
          click: addQuickNote,
        },
        {
          type: "normal",
          label: ACTION_SHOW,
          accelerator: plugin.settings.toggleWindowFocusHotkey,
          click: showWindows,
        },
        {
          type: "normal",
          label: ACTION_HIDE,
          accelerator: plugin.settings.toggleWindowFocusHotkey,
          click: hideWindows,
        },
        { type: "separator" },
        { label: ACTION_RELAUNCH, click: relaunchApp },
        { label: ACTION_CLOSE, click: closeVault },
      ]);
    tray = new Tray(obsidianIcon);
    tray.setContextMenu(contextMenu);
    tray.setToolTip(replaceVaultName(plugin.settings.trayIconTooltip));
    tray.on("click", () => {
      if (process.platform === "darwin") {
        // macos does not register separate left/right click actions
        // for menu items, icon should open menu w/out causing toggle
        tray.popUpContextMenu();
      } else toggleWindows(false);
    });
  };

const registerHotkeys = () => {
    log(LOG_REGISTER_HOTKEY);
    const { toggleWindowFocusHotkey, quickNoteHotkey } = plugin.settings,
      hotkeys = [
        [toggleWindowFocusHotkey, toggleWindows],
        [quickNoteHotkey, addQuickNote],
      ];
    hotkeys.forEach(([accelerator, callback]) => {
      if (!accelerator) return;
      try {
        if (!globalShortcut.register(accelerator, callback)) {
          new obsidian.Notice(`Global hotkey unavailable: ${accelerator}`);
          console.warn(`${LOG_PREFIX}: global hotkey unavailable: ${accelerator}`);
        }
      } catch (error) {
        new obsidian.Notice(`Invalid global hotkey: ${accelerator}`);
        console.error(`${LOG_PREFIX}: failed to register ${accelerator}`, error);
      }
    });
  },
  unregisterHotkeys = () => {
    log(LOG_UNREGISTER_HOTKEY);
    try {
      globalShortcut.unregister(plugin.settings.toggleWindowFocusHotkey);
      globalShortcut.unregister(plugin.settings.quickNoteHotkey);
    } catch {}
  };

const registerUriHandlers = () => {
  log(LOG_REGISTER_URI_HANDLER);
  plugin.registerObsidianProtocolHandler("tray-extended/toggleWindows", toggleWindows);
  plugin.registerObsidianProtocolHandler("tray-extended/showWindow", showWindow);
  plugin.registerObsidianProtocolHandler("tray-extended/hideLeftSidebar", hideLeftSidebar);
};

const OPTIONS = [
  "Window management",
  {
    key: "launchOnStartup",
    desc: "Open Obsidian automatically whenever you log into your computer.",
    type: "toggle",
    default: false,
    onChange: setLaunchOnStartup,
  },
  {
    key: "hideOnLaunch",
    desc: `
      Minimises Obsidian automatically whenever the app is launched. If the
      "Run in background" option is enabled, windows will be hidden to the system
      tray/menubar instead of minimised to the taskbar/dock.
    `,
    type: "toggle",
    default: false,
  },
  {
    key: "runInBackground",
    desc: `
      Hides the app and continues to run it in the background instead of quitting
      it when pressing the window close button or toggle focus hotkey.
    `,
    type: "toggle",
    default: false,
    onChange() {
      setLaunchOnStartup();
      if (plugin.settings.runInBackground) interceptWindowClose();
      else [allowWindowClose(), showWindows()];
    },
  },
  {
    key: "hideTaskbarIcon",
    desc: `
      Hides the window's icon from from the dock/taskbar. Enabling the tray icon first
      is recommended if using this option. This may not work on Linux-based OSes.
    `,
    type: "toggle",
    default: false,
    onChange() {
      if (plugin.settings.hideTaskbarIcon) hideTaskbarIcons();
      else showTaskbarIcons();
    },
  },
  {
    key: "createTrayIcon",
    desc: `
      Adds an icon to your system tray/menubar to bring hidden Obsidian windows
      back into focus on click or force a full quit/relaunch of the app through
      the right-click menu.
    `,
    type: "toggle",
    default: true,
    onChange: createTrayIcon,
  },
  {
    key: "trayIconImage",
    desc: `
      Set the image used by the tray/menubar icon. Recommended size: 16x16
      <br>Preview: <img data-preview style="height: 16px; vertical-align: bottom;">
    `,
    type: "image",
    default: OBSIDIAN_BASE64_ICON,
    onChange: createTrayIcon,
  },
  {
    key: "trayIconTooltip",
    desc: `
      Set a title to identify the tray/menubar icon by. The
      <code>{{vault}}</code> placeholder will be replaced by the vault name.
      <br>Preview: <b class="u-pop" data-preview></b>
    `,
    type: "text",
    default: "{{vault}} | Obsidian",
    postprocessor: replaceVaultName,
    onChange: createTrayIcon,
  },
  {
    key: "toggleWindowFocusHotkey",
    desc: ACCELERATOR_FORMAT,
    type: "hotkey",
    default: "CmdOrCtrl+Shift+Tab",
    onBeforeChange: unregisterHotkeys,
    onChange: registerHotkeys,
  },
  "Quick notes",
  {
    key: "quickNoteLocation",
    desc: "New quick notes will be placed in this folder.",
    type: "text",
    placeholder: "Example: notes/quick",
  },
  {
    key: "quickNoteDateFormat",
    desc: `
      New quick notes will use a filename of this pattern. ${MOMENT_FORMAT}
      <br>Preview: <b class="u-pop" data-preview></b>
    `,
    type: "moment",
    default: DEFAULT_DATE_FORMAT,
  },
  {
    key: "quickNoteTemplate",
    desc: `
      Optional vault-relative Markdown template. Each quick note will ask whether to
      apply it. <a href="https://github.com/SilentVoid13/Templater" target="_blank" rel="noopener">
      Templater</a> can process its expressions after the note is created.
    `,
    type: "text",
    placeholder: "Example: templates/quick-note.md",
  },
  {
    key: "quickNoteHotkey",
    desc: ACCELERATOR_FORMAT,
    type: "hotkey",
    default: "CmdOrCtrl+Shift+Q",
    onBeforeChange: unregisterHotkeys,
    onChange: registerHotkeys,
  },
];

const keyToLabel = (key) =>
    key[0].toUpperCase() +
    key
      .slice(1)
      .split(/(?=[A-Z])/)
      .map((word) => word.toLowerCase())
      .join(" "),
  htmlToFragment = (html) =>
    document
      .createRange()
      .createContextualFragment((html ?? "").replace(/\s+/g, " "));

class SettingsTab extends obsidian.PluginSettingTab {
  display() {
    this.containerEl.empty();
    for (const opt of OPTIONS) {
      const setting = new obsidian.Setting(this.containerEl);
      if (typeof opt === "string") {
        setting.setName(opt);
        setting.setHeading();
      } else {
        if (opt.default) opt.placeholder ??= `Example: ${opt.default}`;
        setting.setName(keyToLabel(opt.key));
        setting.setDesc(htmlToFragment(opt.desc));
        const onChange = async (value) => {
          await opt.onBeforeChange?.();
          plugin.settings[opt.key] = value;
          await plugin.saveSettings();
          await opt.onChange?.();
        };

        const value = plugin.settings[opt.key] ?? opt.default ?? "";
        if (opt.type === "toggle") {
          setting.addToggle((toggle) => {
            toggle.setValue(value).onChange(onChange);
          });
        } else if (opt.type === "image") {
          const previewImg = setting.descEl.querySelector("img[data-preview");
          if (previewImg) previewImg.src = value;
          const fileUpload = setting.descEl.createEl("input");
          fileUpload.style.visibility = "hidden";
          fileUpload.type = "file";
          fileUpload.onchange = (event) => {
            const file = event.target.files[0],
              reader = new FileReader();
            reader.onloadend = () => {
              onChange(reader.result);
              if (previewImg) previewImg.src = reader.result;
            };
            reader.readAsDataURL(file);
          };
          setting.addButton((button) => {
            button.setIcon("image").onClick(() => fileUpload.click());
          });
        } else if (opt.type === "moment") {
          setting.addMomentFormat((moment) => {
            const previewEl = setting.descEl.querySelector("[data-preview]");
            if (previewEl) moment.setSampleEl(previewEl);
            moment
              .setPlaceholder(opt.placeholder)
              .setDefaultFormat(opt.default ?? "")
              .setValue(value)
              .onChange(onChange);
          });
        } else {
          const previewEl = setting.descEl.querySelector("[data-preview]"),
            updatePreview = (value) => {
              if (!previewEl) return;
              previewEl.innerText = opt?.postprocessor(value) ?? value;
            };
          updatePreview(value);
          setting.addText((text) => {
            text
              .setPlaceholder(opt.placeholder)
              .setValue(value)
              .onChange((value) => [onChange(value), updatePreview(value)]);
            if (opt.key === "quickNoteTemplate") {
              const listId = "tray-extended-markdown-files",
                list = setting.controlEl.createEl("datalist", { attr: { id: listId } });
              plugin.app.vault
                .getMarkdownFiles()
                .forEach((file) => list.createEl("option", { value: file.path }));
              text.inputEl.setAttr("list", listId);
            }
          });
        }
      }
    }
  }
}

class TrayPlugin extends obsidian.Plugin {
  async onload() {
    log(LOG_LOADING);
    await this.loadSettings();
    this.addSettingTab(new SettingsTab(this.app, this));
    const { settings } = this;

    plugin = this;
    if (this.app.plugins.enabledPlugins.has(LEGACY_PLUGIN_ID)) {
      new obsidian.Notice(
        "Tray-Extended: disable the legacy Tray plugin to restore global hotkeys."
      );
    }
    createTrayIcon();
    registerHotkeys();
    registerUriHandlers();
    setLaunchOnStartup();
    observeWindows();
    app.prependListener("second-instance", onSecondInstance);
    if (settings.runInBackground) interceptWindowClose();
    if (settings.hideTaskbarIcon) hideTaskbarIcons();
    if (settings.hideOnLaunch) {
      this.registerEvent(this.app.workspace.onLayoutReady(() => {
        if (!startupHideCancelled) hideWindows();
      }));
    }

    // add as command: can be called from command palette
    // and can have non-global hotkey assigned via in-app menu
    this.addCommand({
      id: "relaunch-app",
      name: ACTION_RELAUNCH,
      callback: relaunchApp,
    });
    this.addCommand({
      id: "close-vault",
      name: ACTION_CLOSE,
      callback: closeVault,
    });
  }
  onunload() {
    cleanup();
  }

  getCurrentWindow = getCurrentWindow
  getWindows = getWindows;
  showWindows = showWindows;
  hideWindows = hideWindows;
  toggleWindows = toggleWindows;

  async loadSettings() {
    const DEFAULT_SETTINGS = OPTIONS.map((opt) => ({ [opt.key]: opt.default }));
    this.settings = Object.assign(...DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
}
module.exports = TrayPlugin;
