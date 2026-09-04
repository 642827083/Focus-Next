var __FOCUS_NEXT_CORE_GLOBAL__ = (function () {
  const ENABLED_KEY = "cn.marginnote.focus-next.enabled";

  function nativeMember(object, key) {
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

  function nativeItems(list) {
    if (!list) return [];
    let rawCount;
    try {
      rawCount = typeof list.count === "function" ? list.count() : list.count !== undefined ? list.count : list.length;
    } catch (ignored) { return []; }
    const count = Number(rawCount);
    if (!Number.isFinite(count) || count < 1) return [];
    const items = [];
    for (let index = 0; index < count; index += 1) {
      try {
        items.push(typeof list.objectAtIndex === "function" ? list.objectAtIndex(index) : list[index]);
      } catch (ignored) {}
    }
    return items.filter(function (item) { return item !== undefined && item !== null; });
  }

  function noteIdentifier(note) {
    return String(nativeMember(note, "noteId") || nativeMember(note, "noteid") || nativeMember(note, "id") || "");
  }

  function noteFromSelectedView(selectedView) {
    const candidates = [
      nativeMember(selectedView, "note"),
      nativeMember(selectedView, "node"),
      nativeMember(selectedView, "mindMapNode"),
      nativeMember(selectedView, "mindmapNode"),
      selectedView,
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      if (noteIdentifier(candidate) || nativeMember(candidate, "noteTitle") !== undefined) return candidate;
      const nested = nativeMember(candidate, "note");
      if (nested && (noteIdentifier(nested) || nativeMember(nested, "noteTitle") !== undefined)) return nested;
    }
    return undefined;
  }

  function currentNote(addon) {
    const application = Application.sharedInstance();
    const studyController = application.studyController(addon && addon.window);
    const notebookController = nativeMember(studyController, "notebookController");
    const direct = nativeMember(notebookController, "focusNote") ||
      nativeMember(notebookController, "visibleFocusNote") ||
      nativeMember(notebookController, "currentNote") ||
      nativeMember(notebookController, "focusedNote") ||
      nativeMember(studyController, "focusNote") ||
      nativeMember(studyController, "visibleFocusNote") ||
      nativeMember(studyController, "currentNote") ||
      nativeMember(studyController, "focusedNote");
    if (direct) return direct;
    const mindmapView = nativeMember(notebookController, "mindmapView");
    const selected = nativeItems(nativeMember(mindmapView, "selViewLst"))
      .concat(nativeItems(nativeMember(notebookController, "selViewLst")));
    const fallbackViews = [
      nativeMember(mindmapView, "focusView"),
      nativeMember(mindmapView, "focusedView"),
      nativeMember(mindmapView, "selectedView"),
      nativeMember(mindmapView, "currentView"),
      nativeMember(mindmapView, "activeView"),
      nativeMember(mindmapView, "focusNode"),
      nativeMember(mindmapView, "focusedNode"),
      nativeMember(mindmapView, "selectedNode"),
      nativeMember(mindmapView, "currentNode"),
      nativeMember(mindmapView, "activeNode"),
      nativeMember(mindmapView, "focusMindMapNode"),
      nativeMember(mindmapView, "currentMindMapNode"),
    ].filter(function (value) { return value !== undefined && value !== null; });
    for (const fallbackView of fallbackViews) {
      const fallbackNote = noteFromSelectedView(fallbackView);
      if (fallbackNote) return fallbackNote;
    }
    if (!selected.length) throw new Error("请先在脑图中选中或聚焦一张卡片");
    const note = noteFromSelectedView(selected[0]);
    if (!note) throw new Error("未能读取当前脑图卡片");
    return note;
  }

  function rememberCurrent(addon) {
    try {
      const note = currentNote(addon);
      if (addon) addon.__focusNextLastKnownNote = note;
      return note;
    } catch (ignored) {
      return undefined;
    }
  }

  function nextSibling(note) {
    const parent = nativeMember(note, "parentNote");
    if (!parent) throw new Error("当前卡片没有父节点，无法进入下一张");
    const siblings = nativeItems(nativeMember(parent, "childNotes"));
    if (!siblings.length) throw new Error("当前卡片没有同级兄弟卡片");
    const currentId = noteIdentifier(note);
    let currentIndex = -1;
    for (let index = 0; index < siblings.length; index += 1) {
      if (siblings[index] === note || (currentId && noteIdentifier(siblings[index]) === currentId)) {
        currentIndex = index;
        break;
      }
    }
    if (currentIndex < 0) throw new Error("当前卡片不在父节点的同级列表中");
    if (currentIndex + 1 >= siblings.length) throw new Error("已经是最后一张同级卡片");
    return siblings[currentIndex + 1];
  }

  function showMessage(addon, message) {
    try {
      const application = Application.sharedInstance();
      if (application && typeof application.showHUD === "function") {
        application.showHUD(String(message), addon && addon.window, 2);
      }
    } catch (error) {
      console.log(`[Focus Next] 显示提示失败：${error && error.message || error}`);
    }
  }

  function focusNext(addon) {
    const application = Application.sharedInstance();
    const studyController = application.studyController(addon && addon.window);
    const notebookController = nativeMember(studyController, "notebookController");
    if (!notebookController || typeof notebookController.changeFocusToNote !== "function") {
      throw new Error("当前 MarginNote 版本不支持切换脑图焦点");
    }
    if (!studyController || typeof studyController.focusNoteInMindMapById !== "function") {
      throw new Error("当前 MarginNote 版本不支持脑图卡片定位");
    }
    let observed;
    try {
      observed = currentNote(addon);
    } catch (error) {
      if (!addon) throw error;
      observed = addon.__focusNextLastKnownNote || addon.__focusNextLastTarget;
      if (!observed) throw error;
    }

    // 某些版本先更新脑图显示，稍后才更新 selViewLst/focusNote；此时沿用插件自己的导航游标。
    let current = observed;
    const observedId = noteIdentifier(observed);
    const lastSourceId = String(addon && addon.__focusNextLastSourceId || "");
    const lastTarget = addon && addon.__focusNextLastTarget;
    if (lastTarget && observedId && lastSourceId && observedId === lastSourceId) current = lastTarget;

    const next = nextSibling(current);
    const nextId = noteIdentifier(next);
    if (!nextId) throw new Error("下一张卡片缺少笔记 ID");

    function focusMindMap() {
      studyController.focusNoteInMindMapById(nextId);
    }

    notebookController.changeFocusToNote(next);
    focusMindMap();
    if (addon) {
      addon.__focusNextLastSourceId = noteIdentifier(current);
      addon.__focusNextLastTarget = next;
    }

    const runId = Number(addon && addon.__focusNextRunId || 0) + 1;
    if (addon) addon.__focusNextRunId = runId;

    // 原生焦点切换可能要到动画结束后才更新，短暂重试可避免按钮点击后仍需手点卡片。
    if (typeof NSTimer !== "undefined" && NSTimer.scheduledTimerWithTimeInterval) {
      const retryIntervals = [0.12, 0.3, 0.6];
      function retryFocus(index) {
        if (addon && addon.__focusNextRunId !== runId) return;
        try { focusMindMap(); } catch (error) {
          console.log(`[Focus Next] 延迟进入下一张失败：${error && error.message || error}`);
          return;
        }
        if (index >= retryIntervals.length) return;
        NSTimer.scheduledTimerWithTimeInterval(retryIntervals[index], false, function () {
          retryFocus(index + 1);
        });
      }
      NSTimer.scheduledTimerWithTimeInterval(retryIntervals[0], false, function () {
        retryFocus(1);
      });
    }
    return { current, next, nextId };
  }

  function enabled() {
    try {
      const stored = NSUserDefaults.standardUserDefaults().objectForKey(ENABLED_KEY);
      if (stored === undefined || stored === null) return true;
      if (typeof stored.booleanValue === "function") return Boolean(stored.booleanValue());
      if (stored === false || stored === 0 || String(stored) === "0" || String(stored).toLowerCase() === "false") return false;
      return true;
    } catch (error) {
      console.log(`[Focus Next] 读取按钮开关失败：${error && error.message || error}`);
      return true;
    }
  }

  function setEnabled(value) {
    const next = Boolean(value);
    try { NSUserDefaults.standardUserDefaults().setObjectForKey(next, ENABLED_KEY); } catch (error) {
      console.log(`[Focus Next] 保存按钮开关失败：${error && error.message || error}`);
    }
    return next;
  }

  return { nativeMember, nativeItems, noteIdentifier, currentNote, rememberCurrent, nextSibling, focusNext, showMessage, enabled, setEnabled };
})();
