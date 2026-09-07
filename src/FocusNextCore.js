var __FOCUS_NEXT_CORE_GLOBAL__ = (function () {
  const ENABLED_KEY = "cn.marginnote.focus-next.enabled";

  function member(object, key) {
    if (!object) return undefined;
    let value;
    try { value = object[key]; } catch (ignored) { value = undefined; }
    if (value === undefined && typeof object.objectForKey === "function") {
      try { value = object.objectForKey(key); } catch (ignored) {}
    }
    if (value === undefined && typeof object.valueForKey === "function") {
      try { value = object.valueForKey(key); } catch (ignored) {}
    }
    if (typeof value === "function") {
      try { value = value.call(object); } catch (ignored) { return undefined; }
    }
    return value;
  }

  function pathMember(object, path) {
    if (!object || !path) return undefined;
    let value;
    try {
      if (typeof object.valueForKeyPath === "function") value = object.valueForKeyPath(path);
    } catch (ignored) {}
    if (value !== undefined && value !== null) return value;
    const parts = String(path).split(".");
    value = object;
    for (const part of parts) {
      value = member(value, part);
      if (value === undefined || value === null) return undefined;
    }
    return value;
  }

  function items(list) {
    if (!list) return [];
    let count;
    try { count = typeof list.count === "function" ? list.count() : list.count !== undefined ? list.count : list.length; } catch (ignored) { return []; }
    count = Number(count);
    if (!Number.isFinite(count) || count < 1) return [];
    const result = [];
    for (let index = 0; index < count; index += 1) {
      try { result.push(typeof list.objectAtIndex === "function" ? list.objectAtIndex(index) : list[index]); } catch (ignored) {}
    }
    return result.filter(function (value) { return value !== undefined && value !== null; });
  }

  function studyController(addon) {
    const application = Application.sharedInstance();
    if (!application || typeof application.studyController !== "function") return undefined;
    const focusWindow = member(application, "focusWindow");
    const candidates = [addon && addon.window, focusWindow, undefined];
    for (const window of candidates) {
      try {
        const controller = window === undefined ? application.studyController() : application.studyController(window);
        if (controller) return controller;
      } catch (ignored) {}
    }
    return undefined;
  }

  function noteId(note) {
    return String(member(note, "noteId") || member(note, "noteid") || member(note, "id") || "");
  }

  function asNote(value) {
    if (!value) return undefined;
    const candidates = [member(value, "note"), member(value, "node"), member(value, "mindMapNode"), member(value, "mindmapNode"), member(value, "view"), value];
    for (const candidate of candidates) {
      if (!candidate) continue;
      if (noteId(candidate) || member(candidate, "noteTitle") !== undefined) return candidate;
      const nested = member(candidate, "note");
      if (nested && (noteId(nested) || member(nested, "noteTitle") !== undefined)) return nested;
    }
    return undefined;
  }

  function focusCandidates(addon) {
    const controller = studyController(addon);
    const notebook = member(controller, "notebookController");
    const mindmap = member(notebook, "mindmapView");
    const owners = [notebook, controller, mindmap];
    const keys = ["focusNote", "visibleFocusNote", "focusedNote", "currentFocusNote", "currentNote", "activeNote", "focusNode", "focusedNode", "focusMindMapNode", "currentMindMapNode", "focusView", "focusedView", "selectedView"];
    const result = [];
    for (const owner of owners) {
      for (const key of keys) {
        const note = asNote(member(owner, key));
        if (!note || !noteId(note)) continue;
        if (!result.some(function (item) { return noteId(item.note) === noteId(note); })) result.push({ note, source: key });
      }
    }
    const paths = [
      "notebookController.focusNote",
      "notebookController.visibleFocusNote",
      "notebookController.focusedNote",
      "notebookController.currentFocusNote",
      "notebookController.mindmapView.focusNote",
      "notebookController.mindmapView.focusNode",
      "notebookController.mindmapView.focusView",
    ];
    for (const path of paths) {
      const note = asNote(pathMember(controller, path));
      if (note && noteId(note) && !result.some(function (item) { return noteId(item.note) === noteId(note); })) result.push({ note, source: path });
    }
    return result;
  }

  function currentFocus(addon) {
    const candidates = focusCandidates(addon);
    return candidates.length ? candidates[0].note : undefined;
  }

  function rememberFocus(addon) {
    const candidates = focusCandidates(addon);
    let note = candidates.length ? candidates[0].note : undefined;
    const previousId = noteId(addon && addon.__focusNextLastFocus);
    if (previousId && candidates.length && noteId(note) === previousId) {
      for (let index = 1; index < candidates.length; index += 1) {
        if (noteId(candidates[index].note) !== previousId) {
          note = candidates[index].note;
          break;
        }
      }
    }
    if (note && addon) addon.__focusNextLastFocus = note;
    return note;
  }

  function navigationNote(addon) {
    const live = rememberFocus(addon);
    const remembered = addon && addon.__focusNextLastFocus;
    if (live || remembered) return live || remembered;
    throw new Error("请先双击进入一张脑图卡片焦点");
  }

  function adjacent(note) {
    const parent = member(note, "parentNote");
    const siblings = items(member(parent, "childNotes"));
    if (!parent || !siblings.length) throw new Error("当前卡片没有同级兄弟卡片");
    const id = noteId(note);
    let index = -1;
    for (let cursor = 0; cursor < siblings.length; cursor += 1) {
      if (siblings[cursor] === note || (id && noteId(siblings[cursor]) === id)) { index = cursor; break; }
    }
    if (index < 0) throw new Error("当前焦点不在脑图同级卡片列表中");
    if (index + 1 >= siblings.length) throw new Error("已经是最后一张同级卡片");
    return siblings[index + 1];
  }

  function focusNext(addon) {
    const current = navigationNote(addon);
    const controller = studyController(addon);
    const notebook = member(controller, "notebookController");
    if (!notebook || typeof notebook.changeFocusToNote !== "function") throw new Error("当前 MarginNote 版本不支持切换脑图焦点");
    const target = adjacent(current);
    notebook.changeFocusToNote(target);
    if (addon) addon.__focusNextLastFocus = target;
    return { current, next: target, nextId: noteId(target) };
  }

  function showMessage(addon, message) {
    try {
      const application = Application.sharedInstance();
      if (application && typeof application.showHUD === "function") application.showHUD(String(message), addon && addon.window, 2);
    } catch (error) { console.log(`[Focus Next] 显示提示失败：${error && error.message || error}`); }
  }

  function enabled() {
    try {
      const value = NSUserDefaults.standardUserDefaults().objectForKey(ENABLED_KEY);
      if (value === undefined || value === null) return true;
      if (typeof value.booleanValue === "function") return Boolean(value.booleanValue());
      return !(value === false || value === 0 || String(value).toLowerCase() === "false");
    } catch (error) { return true; }
  }

  function setEnabled(value) {
    const result = Boolean(value);
    try { NSUserDefaults.standardUserDefaults().setObjectForKey(result, ENABLED_KEY); } catch (ignored) {}
    return result;
  }

  return { currentFocus, rememberFocus, focusNext, showMessage, enabled, setEnabled };
})();
