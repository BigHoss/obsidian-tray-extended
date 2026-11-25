const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");

// Load the shipped plugin against a small desktop workspace without starting Obsidian.
function vault(mode, display = "normal") {
  const calls = [], storage = new Map();
  class TFile { constructor(path, extension) { this.path = path; this.extension = extension; this.name = path.split("/").pop(); } }
  const file = new TFile("Morning.md", "md"), canvas = new TFile("Plan.canvas", "canvas"), rootSplit = {};
  const leaf = { getRoot: () => rootSplit, view: { file }, openFile: async () => calls.push("open") };
  const workspace = { rootSplit, getLeavesOfType: () => [leaf], setActiveLeaf() {},
    getMostRecentLeaf: () => null, getLeaf: () => ({ openFile: async () => calls.push("open") }),
    leftSplit: { collapse: () => calls.push("left-"), expand: () => calls.push("left+") },
    rightSplit: { collapse: () => calls.push("right-") } };
  const win = { isMinimized: () => false, isFullScreen: () => false, show: () => calls.push("show"),
    focus() {}, maximize: () => calls.push("maximize"), setFullScreen: () => calls.push("fullscreen") };
  const context = { module: {}, localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v) },
    require: name => name === "electron" ? { remote: { getCurrentWindow: () => win } } : {
      Modal: class {}, PluginSettingTab: class {}, Plugin: class {}, TFile, normalizePath: p => p,
      AbstractInputSuggest: class { constructor(app, textInputEl) { this.app = app; this.textInputEl = textInputEl; this.limit = 100; } onSelect(cb) { this.select = cb; return this; } },
      Notice: class { constructor() { calls.push("notice"); } } } };
  vm.runInNewContext(fs.readFileSync(require.resolve("../main.js"), "utf8"), context);
  const plugin = new context.module.exports();
  plugin.settings = { unlockMode: mode, unlockNote: "Morning.md", unlockInterval: 3, unlockDisplay: display };
  const files = new Map([["Morning.md", file], ["Plan.canvas", canvas]]);
  plugin.app = { workspace, vault: { adapter: { getBasePath: () => "vault" },
    getFiles: () => [...files.values()],
    getAbstractFileByPath: (path) => files.get(path) ?? null } };
  return { plugin, calls, file, canvas, files };
}

test("a canvas note opens, and a path without extension or with wrong case resolves", async () => {
  const { plugin, calls, canvas } = vault("every");
  const opened = [];
  plugin.app.workspace.getLeaf = () => ({ openFile: async file => { opened.push(file.path); calls.push("open"); } });
  plugin.settings.unlockNote = "Plan.canvas";
  await plugin.handleUnlock();
  assert.deepEqual(opened, ["Plan.canvas"], "the canvas file is opened");
  plugin.settings.unlockNote = "morning";
  await plugin.handleUnlock();
  plugin.settings.unlockNote = "Plan";
  await plugin.handleUnlock();
  plugin.settings.unlockNote = "Missing.canvas";
  await plugin.handleUnlock();
  assert.equal(calls.filter((c) => c === "notice").length, 1, "only the missing path warns");
});

test("first unlock follows local calendar boundaries, including a week across New Year", async () => {
  for (const [mode, expected] of [["day", 4], ["week", 2], ["month", 2], ["off", 0], ["every", 5]]) {
    const { plugin, calls } = vault(mode);
    for (const date of ["2026-12-31", "2026-12-31", "2027-01-01", "2027-01-03", "2027-01-04"]) {
      await plugin.handleUnlock(new Date(`${date}T08:00:00`));
    }
    assert.equal(calls.length, expected, mode);
  }
});

test("long breaks require an observed lock and include the exact configured threshold", async () => {
  const { plugin, calls } = vault("break");
  plugin.settings.minimumLockedMinutes = 15;
  const now = new Date(), threshold = 15 * 60000;
  await plugin.handleUnlock(now);
  await plugin.handleUnlock(now, now - threshold + 1);
  assert.deepEqual(calls, []);
  await plugin.handleUnlock(now, now - threshold);
  assert.deepEqual(calls, ["show"]);
});

test("Nth unlock retries a missing note and starts the next cycle only after success", async () => {
  const { plugin, calls, files } = vault("nth", "sidebar");
  await plugin.handleUnlock(); await plugin.handleUnlock();
  const kept = files.get("Morning.md");
  files.delete("Morning.md");
  await plugin.handleUnlock();
  files.set("Morning.md", kept);
  await plugin.handleUnlock(); await plugin.handleUnlock();
  assert.deepEqual(calls, ["notice", "show", "left+", "right-", "fullscreen"]);
});

test("a forced unlock ignores the daily slot and the interval counter", async () => {
  const { plugin, calls } = vault("day");
  await plugin.handleUnlock(new Date("2026-12-31T08:00:00"));
  assert.deepEqual(calls, ["show"], "the first unlock of the day opens the note");
  await plugin.handleUnlock(new Date("2026-12-31T09:00:00"));
  assert.deepEqual(calls, ["show"], "a second unlock of the same day is skipped");
  await plugin.handleUnlock(new Date("2026-12-31T09:00:00"), undefined, true);
  assert.deepEqual(calls, ["show", "show"], "a forced unlock opens the note anyway");
});

test("the unlock note can open in a pinned tab", async () => {
  const { plugin, calls } = vault("every");
  plugin.settings.unlockTab = "pinned";
  plugin.app.workspace.getLeavesOfType = () => [];
  plugin.app.workspace.getLeaf = () => ({
    openFile: async () => calls.push("open"),
    setPinned: (pinned) => calls.push(`pin${pinned}`),
  });
  await plugin.handleUnlock();
  assert.deepEqual(calls, ["open", "pintrue", "show"]);
});

test("opens a not-yet-open note and applies the selected window treatment", async () => {
  for (const [display, effects] of [["window", ["maximize"]], ["maximize-nosidebar", ["left-", "right-", "maximize"]], ["maximize-sidebar", ["left+", "right-", "maximize"]], ["fullscreen", ["left-", "right-", "fullscreen"]], ["normal", []]]) {
    const { plugin, calls } = vault("every", display);
    Object.assign(plugin.app.workspace, { getLeavesOfType: () => [], getMostRecentLeaf: () => null,
      getLeaf: () => ({ openFile: async file => { assert.equal(file.extension, "md"); calls.push("open"); } }) });
    await plugin.handleUnlock();
    assert.deepEqual(calls, ["open", "show", ...effects]);
  }
});
