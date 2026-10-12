import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

for (const direction of ["focusNext", "focusPrevious"]) {
  test(`${direction}不选中卡片可连续切换，且不触发复制界面状态弹窗`, async () => {
    const first = { noteId: "1" }, second = { noteId: "2" }, last = { noteId: "3" };
    const parent = { childNotes: [first, second, last] };
    for (const note of parent.childNotes) note.parentNote = parent;
    const window = {}, calls = [], messages = [], timers = [];
    const notebook = { changeFocusToNote(note) { calls.push(`change:${note.noteId}`); this.focusNote = note; } };
    const controller = { notebookController: notebook, focusNoteInMindMapById(id) { calls.push(`locate:${id}`); } };
    const context = {
      console,
      Application: { sharedInstance() { return { studyController() { return controller; }, showHUD(message) { messages.push(message); } }; } },
      MNUtil: {
        currentWindow: window, currentNotebookId: "topic",
        getCurrentUIStatusURL() { calls.push("read-state"); messages.push("当前UI状态已复制到剪贴板"); return Promise.resolve(undefined); },
        parseMNUIStatusURL() { return null; }, setUIStatusByConfig() { calls.push("apply-state"); },
      },
      UIPasteboard: { generalPasteboard() { calls.push("pasteboard"); return { items: [], string: "" }; } },
      NSTimer: { scheduledTimerWithTimeInterval() { timers.push("timer"); } },
      JSB: { defineClass(name, methods) { return methods; }, require(name) {
        vm.runInContext(readFileSync(new URL(`../src/${name}.js`, import.meta.url), "utf8"), context);
      } },
    };
    vm.createContext(context);
    vm.runInContext(readFileSync(new URL("../src/main.js", import.meta.url), "utf8"), context);
    const addon = context.JSB.newAddon();
    addon.window = window;
    addon.focusNextEnabled = true;
    addon.__focusNextLastFocus = direction === "focusNext" ? first : last;
    context.self = addon;
    const targets = [second, direction === "focusNext" ? last : first];
    for (const target of targets) {
      notebook.focusNote = undefined;
      addon[direction]();
      for (let i = 0; i < 12; i++) await Promise.resolve();
      assert.equal(addon.__focusNextLastFocus, target);
    }
    assert.deepEqual(calls, ["change:2", "locate:2", `change:${targets[1].noteId}`, `locate:${targets[1].noteId}`]);
    assert.deepEqual(messages, []);
    assert.deepEqual(timers, []);
    notebook.focusNote = undefined;
    addon[direction]();
    assert.match(messages[0], direction === "focusNext" ? /最后一张/ : /第一张/);
  });
}
