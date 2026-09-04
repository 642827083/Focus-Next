function createFocusNextAddon() {
  return JSB.defineClass("FocusNextAddon : JSExtension", {
    sceneWillConnect: function () {
      self.focusNextEnabled = __FOCUS_NEXT_CORE_GLOBAL__.enabled();
      console.log("[Focus Next] 插件已初始化");
    },

    sceneDidDisconnect: function () {
      __FOCUS_NEXT_UI_GLOBAL__.remove(self);
      self.focusNextEnabled = false;
    },

    notebookWillOpen: function () {
      if (self.focusNextEnabled !== false) __FOCUS_NEXT_UI_GLOBAL__.show(self);
      else __FOCUS_NEXT_UI_GLOBAL__.hide(self);
    },

    queryAddonCommandStatus: function () {
      return {
        image: "icon.png",
        object: self,
        selector: "toggleFocusNext:",
        checked: self.focusNextEnabled !== false,
      };
    },

    toggleFocusNext: function () {
      const enabled = !(self.focusNextEnabled !== false);
      self.focusNextEnabled = __FOCUS_NEXT_CORE_GLOBAL__.setEnabled(enabled);
      if (self.focusNextEnabled) __FOCUS_NEXT_UI_GLOBAL__.show(self);
      else __FOCUS_NEXT_UI_GLOBAL__.hide(self);
      try {
        const studyController = Application.sharedInstance().studyController(self.window);
        if (studyController && typeof studyController.refreshAddonCommands === "function") studyController.refreshAddonCommands();
      } catch (error) {
        console.log(`[Focus Next] 刷新插件开关状态失败：${error && error.message || error}`);
      }
    },

    focusNext: function () {
      try {
        __FOCUS_NEXT_CORE_GLOBAL__.focusNext(self);
      } catch (error) {
        const message = error && error.message ? error.message : String(error);
        __FOCUS_NEXT_CORE_GLOBAL__.showMessage(self, message);
        console.log(`[Focus Next] 切换失败：${message}`);
      }
    },
  });
}
