import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/FocusNextCore.js", import.meta.url), "utf8");

function runtime(studyController, defaults = {}, timers = []) {
  const context = {
    Application: { sharedInstance() { return { studyController() { return studyController; } }; } },
    NSUserDefaults: { standardUserDefaults() { return {
      objectForKey(key) { return defaults[key]; },
      setObjectForKey(value, key) { defaults[key] = value; },
    }; } },
    Number, String, Array, Object, console,
    NSTimer: { scheduledTimerWithTimeInterval(interval, repeats, callback) { timers.push({ interval, repeats, callback }); } },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.__FOCUS_NEXT_CORE_GLOBAL__;
}

function notes() {
  const one = { noteId: "1", noteTitle: "一" };
  const two = { noteId: "2", noteTitle: "二" };
  const three = { noteId: "3", noteTitle: "三" };
  const parent = { noteId: "p", noteTitle: "父", childNotes: [one, two, three] };
  one.parentNote = parent;
  two.parentNote = parent;
  three.parentNote = parent;
  return { one, two, three, parent };
}

test("读取 MarginNote 当前脑图焦点", () => {
  const { one } = notes();
  const core = runtime({ notebookController: { focusNote: one } });
  assert.equal(core.currentFocus({ window: {} }), one);
});

test("通过 KVC 路径读取脑图焦点", () => {
  const { one } = notes();
  const studyController = {
    valueForKeyPath(path) { return path === "notebookController.focusNote" ? one : undefined; },
    notebookController: {},
  };
  const core = runtime(studyController);
  assert.equal(core.currentFocus({ window: {} }), one);
});

test("visibleFocusNote 更新时不会继续使用滞后的 focusNote", () => {
  const { one, two } = notes();
  const notebookController = { focusNote: one, visibleFocusNote: one };
  const core = runtime({ notebookController });
  const addon = { window: {} };
  core.rememberFocus(addon);
  notebookController.visibleFocusNote = two;
  assert.equal(core.rememberFocus(addon), two);
});

test("点击下一张只切换到当前卡片的下一个同级节点", () => {
  const { one, two, three } = notes();
  const order = [];
  const studyController = {
    notebookController: {
      focusNote: one,
      changeFocusToNote(note) { order.push(`change:${note.noteId}`); this.focusNote = note; },
    },
    focusNoteInMindMapById(id) { order.push(`mindmap:${id}`); },
  };
  const core = runtime(studyController);
  const addon = { window: {} };
  assert.equal(core.focusNext(addon).next, two);
  assert.deepEqual(order, ["change:2", "mindmap:2"]);
  studyController.notebookController.focusNote = two;
  assert.equal(core.focusNext(addon).next, three);
});

test("按钮点击前焦点暂时不可读时使用最近一次真实焦点", () => {
  const { one, two } = notes();
  const studyController = {
    notebookController: {
      focusNote: one,
      changeFocusToNote(note) { this.focusNote = note; },
    },
    focusNoteInMindMapById() {},
  };
  const core = runtime(studyController);
  const addon = { window: {} };
  core.rememberFocus(addon);
  studyController.notebookController.focusNote = undefined;
  assert.equal(core.focusNext(addon).next, two);
});

test("同级最后一张停止，不跨层级", () => {
  const { three } = notes();
  const core = runtime({ notebookController: { focusNote: three, changeFocusToNote() {} }, focusNoteInMindMapById() {} });
  assert.throws(() => core.focusNext({ window: {} }), /最后一张同级卡片/);
});

test("没有任何焦点时给出进入焦点提示", () => {
  const core = runtime({ notebookController: {} });
  assert.throws(() => core.focusNext({ window: {} }), /双击进入一张脑图卡片焦点/);
});

test("切换焦点缺少宿主接口时给出明确错误", () => {
  const { one } = notes();
  const core = runtime({ notebookController: { focusNote: one } });
  assert.throws(() => core.focusNext({ window: {} }), /不支持切换脑图焦点/);
});

test("开关默认开启并可持久化关闭", () => {
  const defaults = {};
  const core = runtime({ notebookController: {} }, defaults);
  assert.equal(core.enabled(), true);
  assert.equal(core.setEnabled(false), false);
  assert.equal(core.enabled(), false);
});

test("入口只导入模块并注册插件工厂", () => {
  const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(main, /JSB\.require\("FocusNextCore"\)/);
  assert.match(main, /JSB\.newAddon\s*=\s*function/);
  assert.doesNotMatch(main, /(^|[;\n])\s*(import|require)\s*\(/);
});

test("界面只有标准下一张按钮，没有旧解析和上一张入口", () => {
  const ui = readFileSync(new URL("../src/FocusNextUI.js", import.meta.url), "utf8");
  const addon = readFileSync(new URL("../src/FocusNextAddon.js", import.meta.url), "utf8");
  assert.match(ui, /"下一张"/);
  assert.match(ui, /1 << 6/);
  assert.doesNotMatch(ui, /解析|上一张|captureFocus|PressNote/);
  assert.doesNotMatch(addon, /parseFocusNext|focusPrevious|captureFocus/);
});

test("下一张按钮支持拖动并保存位置", () => {
  const ui = readFileSync(new URL("../src/FocusNextUI.js", import.meta.url), "utf8");
  const addon = readFileSync(new URL("../src/FocusNextAddon.js", import.meta.url), "utf8");
  assert.match(ui, /UIPanGestureRecognizer/);
  assert.match(ui, /next-button-position/);
  assert.match(ui, /setObjectForKey\(JSON\.stringify\(position\), POSITION_KEY\)/);
  assert.match(ui, /xRatio/);
  assert.match(ui, /JSON\.stringify\(position\)/);
  assert.match(ui, /schedulePlace/);
  assert.match(ui, /handlePan/);
  assert.match(addon, /handleFocusNextButtonPan: function/);
  assert.match(addon, /__focusNextSuppressTap/);
});

test("按钮持续使用 NSTimer 记录宿主焦点", () => {
  const ui = readFileSync(new URL("../src/FocusNextUI.js", import.meta.url), "utf8");
  assert.match(ui, /NSTimer\.scheduledTimerWithTimeInterval/);
  assert.match(ui, /rememberFocus/);
});

test("测试包图标仍使用用户 PNG 资源", () => {
  const addon = readFileSync(new URL("../src/FocusNextAddon.js", import.meta.url), "utf8");
  const icon = readFileSync(new URL("../src/icon.png", import.meta.url));
  assert.match(addon, /image: "icon\.png"/);
  assert.ok(icon.length > 100);
});
