import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

function tree() {
  const notes = ["root", "a", "a1", "a2", "b", "b1"].map(noteId => ({ noteId }));
  const [root, a, a1, a2, b, b1] = notes;
  for (const [parent, children] of [[root, [a, b]], [a, [a1, a2]], [b, [b1]]]) {
    parent.childNotes = children;
    children.forEach(note => { note.parentNote = parent; });
  }
  return { root, a, a1, a2, b, b1, notes };
}

function runtime(defaults = {}, width = 1024, height = 768) {
  class View {
    constructor(frame) { this.frame = frame; this.layer = {}; this.subviews = []; this.hidden = false; }
    get bounds() { return { x: 0, y: 0, width: this.frame.width, height: this.frame.height }; }
    addSubview(view) { view.removeFromSuperview(); this.subviews.push(view); view.superview = this; }
    removeFromSuperview() {
      if (this.superview) this.superview.subviews = this.superview.subviews.filter(view => view !== this);
      this.superview = undefined;
    }
    addGestureRecognizer(recognizer) { (this.gestures ||= []).push(recognizer); recognizer.view = this; }
    addTargetActionForControlEvents(target, selector, event) { this.target = target; this.selector = selector; this.event = event; }
  }
  class Button extends View {
    constructor(frame) { super(frame); this.titleLabel = {}; }
    setTitleForState(title) { this.title = title; }
    setTitleColorForState() {}
  }
  let now = 0;
  const timers = [], messages = [], calls = [];
  const nodes = tree();
  const controller = {
    view: new View({ x: 0, y: 0, width, height }),
    notebookController: { focusNote: nodes.a1, changeFocusToNote(note) { calls.push(`change:${note.noteId}`); this.focusNote = note; } },
    focusNoteInMindMapById(id) { calls.push(`locate:${id}`); },
    refreshAddonCommands() { calls.push("refresh-toolbar"); },
  };
  const color = { colorWithAlphaComponent() { return this; } };
  const context = {
    console, Date: { now() { return now; } },
    Application: { sharedInstance() { return { studyController() { return controller; }, showHUD(message) { messages.push(message); } }; } },
    NSUserDefaults: { standardUserDefaults() { return {
      objectForKey(key) { return defaults[key]; }, setObjectForKey(value, key) { defaults[key] = value; },
    }; } },
    UIView: View, UILabel: View, UIButton: Button, UISwitch: View, UIScrollView: View,
    UIFont: { systemFontOfSize(size) { return size; }, boldSystemFontOfSize(size) { return size; } },
    UIColor: { whiteColor() { return color; }, darkGrayColor() { return color; }, grayColor() { return color; }, lightGrayColor() { return color; }, colorWithRedGreenBlueAlpha() { return color; } },
    UIPanGestureRecognizer: class { constructor(target, selector) { this.target = target; this.selector = selector; } },
    NSTimer: { scheduledTimerWithTimeInterval(interval, repeats, callback) {
      const timer = { at: now + interval * 1000, callback, cancelled: false, invalidate() { this.cancelled = true; } };
      timers.push(timer);
      return timer;
    } },
    JSB: { defineClass(name, methods) { return methods; }, require(name) {
      vm.runInContext(readFileSync(new URL(`../src/${name}.js`, import.meta.url), "utf8"), context);
    } },
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL("../src/main.js", import.meta.url), "utf8"), context);
  const addon = context.JSB.newAddon();
  addon.window = {};
  context.self = addon;
  addon.sceneWillConnect();
  function advance(milliseconds) {
    const end = now + milliseconds;
    for (let count = 0; count < 100; count++) {
      const next = timers.filter(timer => !timer.cancelled && !timer.fired && timer.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!next) { now = end; return; }
      now = next.at;
      next.fired = true;
      next.callback();
    }
    throw Error("测试中定时器未能停止");
  }
  return { context, addon, controller, defaults, nodes, timers, messages, calls, advance };
}

test("更名保留插件身份、版本和旧设置，生成新的固定测试包名", () => {
  const manifest = JSON.parse(readFileSync(new URL("../src/mnaddon.json", import.meta.url)));
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
  assert.equal(manifest.title, "Focus Switch");
  assert.equal(manifest.addonid, "cn.marginnote.focus-next");
  assert.equal(manifest.version, pkg.version);
  assert.equal(pkg.mnaddonFileName, "Focus Switch Test");
  const run = runtime({ "cn.marginnote.focus-next.enabled": false });
  run.addon.notebookWillOpen();
  assert.equal(run.addon.focusNextEnabled, false);
  assert.equal(run.addon.__focusNextButton, undefined);
  assert.equal(run.addon.queryAddonCommandStatus().selector, "focusToolbarClick:");
});

test("单击只弹出窄面板，不改变导航开关；四项设置与说明准确", () => {
  const run = runtime();
  run.addon.focusToolbarClick(); run.advance(299);
  assert.equal(run.addon.__focusNextSettings, undefined);
  run.advance(1);
  const menu = run.addon.__focusNextSettings;
  assert.equal(menu.panel.frame.width, 340);
  assert.equal(menu.panel.superview, run.controller.view);
  assert.equal(run.addon.focusNextEnabled, true);
  assert.deepEqual(Array.from(menu.rows, row => row.title.text), ["启用焦点切换", "跨层级切换", "显示卡片序号", "显示上一张"]);
  assert.match(menu.rows[2].description.text, /当前序号与同级卡片总数/);
  assert.deepEqual(Array.from(menu.rows, row => row.control.on), [true, false, false, true]);
  run.addon.closeFocusSettings();
  assert.equal(menu.panel.superview, undefined);
});

test("小窗口菜单收窄且可滚动，文字与开关不重叠", () => {
  const run = runtime({}, 300, 320);
  run.addon.focusToolbarClick(); run.advance(300);
  const menu = run.addon.__focusNextSettings;
  assert.equal(menu.panel.frame.width, 276);
  assert.ok(menu.panel.frame.y + menu.panel.frame.height <= 320);
  assert.ok(menu.scroll.contentSize.height > menu.scroll.frame.height);
  for (const row of menu.rows) {
    assert.ok(row.description.frame.x + row.description.frame.width < row.control.frame.x);
    assert.ok(row.control.frame.x + row.control.frame.width <= menu.panel.frame.width);
    assert.equal(row.description.numberOfLines, 2);
  }
  run.controller.view.frame = { x: 0, y: 0, width: 1024, height: 768 };
  run.advance(200);
  assert.equal(menu.panel.frame.width, 340);
});

test("双击切换开启和关闭一次，不弹菜单，取消后的旧回调无效", () => {
  const run = runtime();
  run.addon.notebookWillOpen(); run.addon.focusToolbarClick();
  const stale = run.addon.__focusNextClickTimer;
  run.advance(100); run.addon.focusToolbarClick();
  assert.equal(run.addon.focusNextEnabled, false);
  assert.equal(run.defaults["cn.marginnote.focus-next.enabled"], false);
  assert.equal(run.addon.__focusNextButton.superview, undefined);
  assert.equal(run.addon.__focusPreviousButton.superview, undefined);
  stale.callback(); run.advance(500);
  assert.equal(run.addon.__focusNextSettings, undefined);
  run.addon.focusToolbarClick(); run.advance(100); run.addon.focusToolbarClick();
  assert.equal(run.addon.focusNextEnabled, true);
  assert.equal(run.addon.__focusNextButton.superview, run.controller.view);
  assert.equal(run.addon.queryAddonCommandStatus().checked, true);
  assert.equal(run.calls.filter(call => call === "refresh-toolbar").length, 2);
});

test("设置上一张与序号立即生效并持久化，关闭总开关移除全部导航", () => {
  const defaults = { "cn.marginnote.focus-next.previous-button-position": JSON.stringify({ xRatio: 0.2, yRatio: 0.3 }) };
  const run = runtime(defaults);
  run.addon.notebookWillOpen(); run.addon.setOrdinalEnabled({ on: true });
  assert.equal(run.addon.__focusNextButton.title, "下 1/2");
  assert.equal(run.addon.__focusNextButton.frame.width, 76);
  const previousPosition = defaults["cn.marginnote.focus-next.previous-button-position"];
  run.addon.setPreviousEnabled({ on: false });
  assert.equal(run.addon.__focusPreviousButton.superview, undefined);
  assert.equal(run.addon.__focusNextButton.superview, run.controller.view);
  run.addon.focusNext();
  assert.equal(run.addon.__focusNextButton.title, "下 2/2");
  run.addon.setPreviousEnabled({ on: true });
  assert.equal(defaults["cn.marginnote.focus-next.previous-button-position"], previousPosition);
  assert.equal(run.addon.__focusPreviousButton.title, "上 2/2");
  run.addon.setFocusEnabled({ on: false });
  const callsBefore = run.calls.length;
  run.addon.focusNext();
  assert.equal(run.calls.length, callsBefore);
  assert.equal(run.addon.__focusNextButton.superview, undefined);
  const restarted = runtime(defaults);
  assert.equal(restarted.addon.focusNextEnabled, false);
  restarted.addon.setFocusEnabled({ on: true });
  assert.equal(restarted.addon.__focusNextButton.title, "下 1/2");
  restarted.addon.setOrdinalEnabled({ on: false });
  assert.equal(restarted.addon.__focusNextButton.title, "下一张");
  assert.equal(restarted.addon.__focusNextButton.frame.width, 76);
});

test("跨层级遍历前序所有节点并严格逆序返回，树首尾停止", () => {
  const run = runtime();
  const core = run.context.__FOCUS_NEXT_CORE_GLOBAL__;
  run.addon.setCrossLevelEnabled({ on: true });
  run.controller.notebookController.focusNote = run.nodes.root;
  run.addon.__focusNextLastFocus = run.nodes.root;
  for (const target of run.nodes.notes.slice(1)) assert.equal(core.focusNext(run.addon).next, target);
  const callsBefore = run.calls.length;
  assert.throws(() => core.focusNext(run.addon), /整棵脑图的最后一张/);
  assert.equal(run.calls.length, callsBefore);
  for (const target of run.nodes.notes.slice(0, -1).reverse()) assert.equal(core.focusPrevious(run.addon).next, target);
  assert.throws(() => core.focusPrevious(run.addon), /整棵脑图的第一张/);
  const changes = run.calls.filter(call => /^(change|locate):/.test(call));
  for (let index = 0; index < changes.length; index += 2) assert.equal(changes[index].slice(7), changes[index + 1].slice(7));
  run.addon.setCrossLevelEnabled({ on: false });
  run.controller.notebookController.focusNote = run.nodes.a2;
  run.addon.__focusNextLastFocus = run.nodes.a2;
  assert.throws(() => core.focusNext(run.addon), /最后一张同级卡片/);
});

test("卡片序号按同级计数，跨层级时不累计作答量", () => {
  const run = runtime();
  const core = run.context.__FOCUS_NEXT_CORE_GLOBAL__;
  assert.equal(JSON.stringify(core.siblingProgress(run.nodes.a2)), '{"index":2,"total":2}');
  assert.equal(JSON.stringify(core.siblingProgress(run.nodes.b1)), '{"index":1,"total":1}');
  assert.equal(core.siblingProgress(run.nodes.root), undefined);
  run.addon.setOrdinalEnabled({ on: true }); run.addon.setCrossLevelEnabled({ on: true });
  run.controller.notebookController.focusNote = run.nodes.a1;
  run.addon.__focusNextLastFocus = run.nodes.a1;
  run.addon.focusPrevious();
  assert.equal(run.addon.__focusNextButton.title, "下 1/2");
  run.addon.focusPrevious();
  assert.equal(run.addon.__focusNextButton.title, "下一张");
});

for (const method of ["sceneWillResignActive", "notebookWillOpen", "notebookWillClose", "sceneDidDisconnect"]) {
  test(`${method}取消未执行的单击，旧回调不会重新打开菜单`, () => {
    const run = runtime();
    run.addon.focusToolbarClick();
    const stale = run.addon.__focusNextClickTimer;
    run.addon[method](); stale.callback(); run.advance(400);
    assert.ok(!run.addon.__focusNextSettings || !run.addon.__focusNextSettings.panel.superview);
  });
}

function openMenu(run) { run.addon.focusToolbarClick(); run.advance(300); return run.addon.__focusNextSettings; }

function drag(run, moves, terminal = 3) {
  const resets = [];
  const recognizer = {
    state: 1, translation: { x: 0, y: 0 },
    translationInView(view) { assert.equal(view, run.controller.view); return this.translation; },
    setTranslationInView(value, view) { assert.equal(view, run.controller.view); resets.push({ x: value.x, y: value.y }); this.translation = value; },
  };
  run.addon.handleFocusSettingsPan(recognizer);
  for (const [x, y] of moves) {
    recognizer.state = 2; recognizer.translation = { x, y };
    run.addon.handleFocusSettingsPan(recognizer);
  }
  if (terminal !== null) { recognizer.state = terminal; run.addon.handleFocusSettingsPan(recognizer); }
  return { recognizer, resets };
}

test("菜单只有标题栏可拖动，关闭按钮、开关和滚动区保持独立", () => {
  const run = runtime();
  const menu = openMenu(run);
  assert.equal(menu.header.gestures.length, 1);
  assert.equal(menu.header.gestures[0].selector, "handleFocusSettingsPan:");
  assert.equal(menu.header.gestures[0].target, run.addon);
  assert.equal(menu.header.frame.height, 56);
  assert.ok(menu.header.frame.x + menu.header.frame.width < menu.close.frame.x);
  for (const view of [menu.panel, menu.close, menu.scroll, ...menu.rows.map(row => row.control)]) assert.equal(view.gestures, undefined);
  assert.equal(menu.close.selector, "closeFocusSettings:");
});

test("拖动按增量移动，布局不会拉回原位，松手后恢复与重启均沿用位置", () => {
  const defaults = {};
  const run = runtime(defaults);
  const menu = openMenu(run);
  const origin = { ...menu.panel.frame };
  const { recognizer, resets } = drag(run, [[-150, 100], [-50, 50]], null);
  assert.equal(menu.panel.frame.x, origin.x - 200);
  assert.equal(menu.panel.frame.y, origin.y + 150);
  const moved = { ...menu.panel.frame };
  run.addon.controllerWillLayoutSubviews(); run.advance(200);
  assert.deepEqual({ ...menu.panel.frame }, moved);
  assert.equal(defaults["cn.marginnote.focus-next.settings-panel-position"], undefined);
  recognizer.state = 3; run.addon.handleFocusSettingsPan(recognizer);
  const saved = JSON.parse(defaults["cn.marginnote.focus-next.settings-panel-position"]);
  assert.ok(saved.xRatio > 0 && saved.xRatio < 1);
  assert.ok(saved.yRatio > 0 && saved.yRatio < 1);
  assert.deepEqual(resets, [{ x: 0, y: 0 }, { x: 0, y: 0 }]);
  run.addon.closeFocusSettings(); openMenu(run);
  assert.ok(Math.abs(menu.panel.frame.x - moved.x) < 0.001);
  assert.ok(Math.abs(menu.panel.frame.y - moved.y) < 0.001);
  const restarted = runtime(defaults);
  const restored = openMenu(restarted);
  assert.ok(Math.abs(restored.panel.frame.x - moved.x) < 0.001);
  assert.ok(Math.abs(restored.panel.frame.y - moved.y) < 0.001);
});

test("拖动限制在边界，窗口缩小后保持面板可见且恢复原有比例", () => {
  const defaults = {};
  const run = runtime(defaults);
  const menu = openMenu(run);
  drag(run, [[-10000, -10000]]);
  assert.equal(menu.panel.frame.x, 12); assert.equal(menu.panel.frame.y, 12);
  drag(run, [[10000, 10000]]);
  assert.equal(menu.panel.frame.x + menu.panel.frame.width, 1012);
  assert.equal(menu.panel.frame.y + menu.panel.frame.height, 756);
  const saved = defaults["cn.marginnote.focus-next.settings-panel-position"];
  run.controller.view.frame = { x: 0, y: 0, width: 300, height: 320 };
  run.advance(200);
  assert.equal(menu.panel.frame.width, 276);
  assert.equal(menu.panel.frame.x, 12);
  assert.ok(menu.panel.frame.y >= 12);
  assert.ok(menu.panel.frame.y + menu.panel.frame.height <= 308);
  assert.equal(defaults["cn.marginnote.focus-next.settings-panel-position"], saved);
  run.controller.view.frame = { x: 0, y: 0, width: 1024, height: 768 };
  run.advance(200);
  assert.equal(menu.panel.frame.x + menu.panel.frame.width, 1012);
  assert.equal(menu.panel.frame.y + menu.panel.frame.height, 756);
});

test("取消拖动与中途关菜单保存当前位置，隐藏后的手势不移动或写入", () => {
  const defaults = {};
  const run = runtime(defaults);
  const menu = openMenu(run);
  drag(run, [[-100, 20]], 4);
  assert.equal(menu.dragging, false);
  assert.ok(defaults["cn.marginnote.focus-next.settings-panel-position"]);
  const { recognizer } = drag(run, [[-50, 30]], null);
  const moved = { ...menu.panel.frame };
  run.addon.closeFocusSettings();
  assert.equal(menu.dragging, false);
  const saved = defaults["cn.marginnote.focus-next.settings-panel-position"];
  recognizer.translation = { x: 500, y: 500 }; recognizer.state = 2;
  run.addon.handleFocusSettingsPan(recognizer);
  assert.equal(defaults["cn.marginnote.focus-next.settings-panel-position"], saved);
  assert.deepEqual({ ...menu.panel.frame }, moved);
  openMenu(run);
  assert.ok(Math.abs(menu.panel.frame.x - moved.x) < 0.001);
  assert.ok(Math.abs(menu.panel.frame.y - moved.y) < 0.001);
});

for (const stored of ["broken-json", "null", '{"xRatio":null,"yRatio":0.5}', '{"xRatio":"NaN","yRatio":0.5}']) {
  test(`无效菜单位置使用默认位置：${stored}`, () => {
    const run = runtime({ "cn.marginnote.focus-next.settings-panel-position": stored });
    const menu = openMenu(run);
    assert.equal(menu.panel.frame.x, 672); assert.equal(menu.panel.frame.y, 100);
  });
}
