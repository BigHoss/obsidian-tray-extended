const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");

// Load the shipped plugin against a small desktop workspace without starting Obsidian.
function vault(mode, display = "normal") {
  const calls = [], storage = new Map();
  class TFile { extension = "md"; }
  const file = new TFile(), rootSplit = {};
  const leaf = { getRoot: () => rootSplit, view: { file }, openFile: async () => calls.push("open") };
  const workspace = { rootSplit, getLeavesOfType: () => [leaf], setActiveLeaf() {},
    leftSplit: { collapse: () => calls.push("left-"), expand: () => calls.push("left+") },
    rightSplit: { collapse: () => calls.push("right-") } };
  const win = { isMinimized: () => false, isFullScreen: () => false, show: () => calls.push("show"),
    focus() {}, maximize: () => calls.push("maximize"), setFullScreen: () => calls.push("fullscreen") };
  const context = { module: {}, localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v) },
    require: name => name === "electron" ? { remote: { getCurrentWindow: () => win } } : {
      Modal: class {}, PluginSettingTab: class {}, Plugin: class {}, TFile, normalizePath: p => p,
      Notice: class { constructor() { calls.push("notice"); } } } };
  vm.runInNewContext(fs.readFileSync(require.resolve("../main.js"), "utf8"), context);
  const plugin = new context.module.exports();
  plugin.settings = { unlockMode: mode, unlockNote: "Morning.md", unlockInterval: 3, unlockDisplay: display };
  plugin.app = { workspace, vault: { adapter: { getBasePath: () => "vault" }, getAbstractFileByPath: () => file } };
  return { plugin, calls };
}

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
  const { plugin, calls } = vault("nth", "sidebar");
  await plugin.handleUnlock(); await plugin.handleUnlock();
  const find = plugin.app.vault.getAbstractFileByPath;
  plugin.app.vault.getAbstractFileByPath = () => null;
  await plugin.handleUnlock();
  plugin.app.vault.getAbstractFileByPath = find;
  await plugin.handleUnlock(); await plugin.handleUnlock();
  assert.deepEqual(calls, ["notice", "show", "left+", "right-", "fullscreen"]);
});

test("opens a not-yet-open note and applies the selected window treatment", async () => {
  for (const [display, effects] of [["window", ["maximize"]], ["fullscreen", ["left-", "right-", "fullscreen"]], ["normal", []]]) {
    const { plugin, calls } = vault("every", display);
    Object.assign(plugin.app.workspace, { getLeavesOfType: () => [], getMostRecentLeaf: () => null,
      getLeaf: () => ({ openFile: async file => { assert.equal(file.extension, "md"); calls.push("open"); } }) });
    await plugin.handleUnlock();
    assert.deepEqual(calls, ["open", "show", ...effects]);
  }
});
