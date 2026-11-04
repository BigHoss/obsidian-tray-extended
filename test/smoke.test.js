/**
 * Smoke test for the Tray-Extended plugin.
 * Run with: node test/smoke.test.js
 *
 * Stubs the Obsidian and Electron APIs used by main.js so the plugin can be
 * loaded and exercised outside of Obsidian. Covers the regressions reported
 * in issues #2 and #4:
 *   - main.js must parse (v1.0.11 and v1.0.12 shipped a syntax error)
 *   - the quick note template mode must render as a dropdown
 *   - a quick note with a template must focus the editor
 */

const assert = require("node:assert");
const Module = require("node:module");
const path = require("node:path");

// --- fake DOM --------------------------------------------------------------

class FakeEl {
  constructor(tag = "div") {
    this.tag = tag;
    this.children = [];
    this.attrs = {};
    this.style = {};
    this.value = "";
  }
  empty() {
    this.children = [];
  }
  createEl(tag) {
    const el = new FakeEl(tag);
    this.children.push(el);
    return el;
  }
  querySelector() {
    return null;
  }
  setAttr(key, value) {
    this.attrs[key] = value;
  }
}

global.document = {
  createRange: () => ({ createContextualFragment: (html) => ({ html }) }),
};

// --- fake Obsidian ---------------------------------------------------------

const settings = [];
const notices = [];
const hotkeys = new Map();

class FakeSetting {
  constructor(containerEl) {
    this.containerEl = containerEl;
    this.name = "";
    this.desc = null;
    this.heading = false;
    this.controlEl = new FakeEl();
    this.descEl = new FakeEl();
    this.toggles = [];
    this.dropdowns = [];
    this.texts = [];
    this.buttons = [];
    settings.push(this);
  }
  setName(name) {
    this.name = name;
    return this;
  }
  setDesc(desc) {
    this.desc = desc;
    return this;
  }
  setHeading() {
    this.heading = true;
    return this;
  }
  addToggle(cb) {
    const toggle = {
      value: false,
      setValue(value) {
        this.value = value;
        return this;
      },
      onChange(cb) {
        this.change = cb;
        return this;
      },
    };
    this.toggles.push(toggle);
    cb(toggle);
    return this;
  }
  addDropdown(cb) {
    const dropdown = {
      options: [],
      value: null,
      addOption(value, label) {
        this.options.push({ value, label });
        return this;
      },
      setValue(value) {
        this.value = value;
        return this;
      },
      onChange(cb) {
        this.change = cb;
        return this;
      },
    };
    this.dropdowns.push(dropdown);
    cb(dropdown);
    return this;
  }
  addText(cb) {
    const text = {
      value: "",
      inputEl: new FakeEl(),
      setPlaceholder() {
        return this;
      },
      setValue(value) {
        this.value = value;
        return this;
      },
      onChange(cb) {
        this.change = cb;
        return this;
      },
    };
    this.texts.push(text);
    cb(text);
    return this;
  }
  addButton(cb) {
    const button = {
      text: "",
      cta: false,
      setButtonText(text) {
        this.text = text;
        return this;
      },
      setIcon() {
        return this;
      },
      setCta() {
        this.cta = true;
        return this;
      },
      onClick(cb) {
        this.click = cb;
        return this;
      },
    };
    this.buttons.push(button);
    cb(button);
    return this;
  }
  addMomentFormat(cb) {
    const moment = {
      setPlaceholder() {
        return this;
      },
      setDefaultFormat() {
        return this;
      },
      setValue() {
        return this;
      },
      onChange() {
        return this;
      },
    };
    cb(moment);
    return this;
  }
}

const obsidianStub = {
  Plugin: class {
    constructor(app) {
      this.app = app;
    }
    addSettingTab(tab) {
      this.settingTab = tab;
    }
    addCommand() {}
    registerEvent() {}
    registerObsidianProtocolHandler() {}
  },
  PluginSettingTab: class {
    constructor(app, plugin) {
      this.app = app;
      this.plugin = plugin;
    }
  },
  Modal: class {
    constructor(app) {
      this.app = app;
      this.contentEl = new FakeEl();
    }
    setTitle() {}
    open() {
      this.onOpen();
    }
    close() {
      this.onClose();
    }
  },
  Setting: FakeSetting,
  Notice: class {
    constructor(message) {
      notices.push(message);
    }
  },
  TFile: class {},
  moment: () => ({ format: () => "2026-11-04" }),
  normalizePath: (value) => value,
};

// --- fake Electron ---------------------------------------------------------

const fakeWindow = {
  setSkipTaskbar() {},
  on() {},
  isMaximized: () => false,
  isMinimized: () => false,
  getBounds: () => ({ x: 0, y: 0, width: 800, height: 600 }),
  setBounds() {},
  show() {},
  focus() {},
  minimize() {},
  hide() {},
  isFocused: () => false,
  isVisible: () => false,
  removeListener() {},
  webContents: { on() {} },
};

const electronStub = {
  remote: {
    app: {
      setLoginItemSettings() {},
      relaunch() {},
      exit() {},
      quit() {},
      removeListener() {},
      prependListener() {},
      on() {},
      dock: { hide() {}, show() {} },
    },
    Tray: class {
      setContextMenu() {}
      setToolTip() {}
      on() {}
      destroy() {}
    },
    Menu: { buildFromTemplate: () => ({ popup() {} }) },
    nativeImage: { createFromDataURL: () => ({}) },
    BrowserWindow: { getAllWindows: () => [] },
    getCurrentWindow: () => fakeWindow,
    globalShortcut: {
      register: (accelerator, callback) => {
        hotkeys.set(accelerator, callback);
        return true;
      },
      unregister() {},
    },
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "obsidian") return obsidianStub;
  if (request === "electron") return electronStub;
  return originalLoad.call(this, request, parent, isMain);
};

// --- fake vault ------------------------------------------------------------

const created = [];
const editor = {
  focused: false,
  cursor: null,
  lines: ["# heading", ""],
  focus() {
    this.focused = true;
  },
  lastLine() {
    return this.lines.length - 1;
  },
  getLine(line) {
    return this.lines[line];
  },
  setCursor(position) {
    this.cursor = position;
  },
};

const leaf = {
  view: { editor },
  openFile: async () => {},
};

const app = {
  plugins: { enabledPlugins: new Set() },
  vault: {
    getName: () => "test-vault",
    getMarkdownFiles: () => [],
    getAbstractFileByPath: (path) =>
      path === "templates/quick.md" ? new obsidianStub.TFile() : null,
    read: async () => "# heading\n",
  },
  fileManager: {
    getNewFileParent: () => null,
    createNewMarkdownFile: async (root, name, content) => {
      created.push({ name, content });
      return { path: name };
    },
  },
  workspace: {
    getLeaf: () => leaf,
    leftSplit: { collapse() {} },
  },
  setLoginItemSettings() {},
};

// --- tests -----------------------------------------------------------------

const TrayPlugin = require(path.join(__dirname, "..", "main.js"));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function main() {
  const plugin = new TrayPlugin(app);
  plugin.loadData = async () => ({});
  plugin.saveData = async () => {};
  await plugin.onload();

  // the template mode must render as a dropdown, not as a text field
  plugin.settingTab.containerEl = new FakeEl();
  plugin.settingTab.display();
  const templateMode = settings.find((s) => s.name === "Quick note template mode");
  assert.ok(templateMode, "template mode setting is rendered");
  assert.equal(templateMode.dropdowns.length, 1, "template mode renders a dropdown");
  assert.deepEqual(
    templateMode.dropdowns[0].options.map((o) => o.value),
    ["ask", "always", "never"]
  );
  assert.equal(templateMode.dropdowns[0].value, "ask", "default mode is ask");

  // a quick note with a template must focus the editor
  plugin.settings.quickNoteTemplate = "templates/quick.md";
  plugin.settings.quickNoteTemplateMode = "always";
  created.length = 0;
  await hotkeys.get("CmdOrCtrl+Shift+Q")();
  await flush();
  assert.equal(created[0].content, "# heading\n", "template is applied");
  assert.ok(editor.focused, "editor is focused");
  assert.deepEqual(editor.cursor, { line: 1, ch: 0 }, "cursor is at the end");

  // "never" must skip the template but still focus the editor
  editor.focused = false;
  editor.cursor = null;
  plugin.settings.quickNoteTemplateMode = "never";
  created.length = 0;
  await hotkeys.get("CmdOrCtrl+Shift+Q")();
  await flush();
  assert.equal(created[0].content, "", "template is skipped");
  assert.ok(editor.focused, "editor is focused");

  console.log("smoke test passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
