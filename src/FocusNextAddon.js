function createFocusNextAddon() {
  return JSB.defineClass("FocusNextAddon : JSExtension", {
    sceneWillConnect: function () {
      self.focusNextEnabled = __FOCUS_NEXT_CORE_GLOBAL__.enabled();
      self.__focusNextRememberToken = 0;
      self.__focusNextPlaceToken = 0;
      console.log("[Focus Next] 插件已初始化");
    },

    sceneDidDisconnect: function () {
      self.__focusNextRememberToken += 1;
      self.__focusNextPlaceToken += 1;
      __FOCUS_NEXT_UI_GLOBAL__.remove(self);
      self.focusNextEnabled = false;
    },

    notebookWillOpen: function () {
      self.__focusNextLastFocus = null;
      if (self.focusNextEnabled !== false) __FOCUS_NEXT_UI_GLOBAL__.show(self);
      else __FOCUS_NEXT_UI_GLOBAL__.hide(self);
    },

    queryAddonCommandStatus: function () {
      return { image: "icon.png", object: self, selector: "toggleFocusNext:", checked: self.focusNextEnabled !== false };
    },

    toggleFocusNext: function () {
      self.focusNextEnabled = __FOCUS_NEXT_CORE_GLOBAL__.setEnabled(!(self.focusNextEnabled !== false));
      if (self.focusNextEnabled) __FOCUS_NEXT_UI_GLOBAL__.show(self);
      else __FOCUS_NEXT_UI_GLOBAL__.hide(self);
      try {
        const application = Application.sharedInstance();
        const controller = application && typeof application.studyController === "function"
          ? application.studyController(self.window)
          : undefined;
        if (controller && typeof controller.refreshAddonCommands === "function") {
          controller.refreshAddonCommands();
        }
      } catch (error) {
        console.log(`[Focus Next] 刷新插件命令状态失败：${error && error.message || error}`);
      }
    },

    focusNext: function () {
      if (self.__focusNextSuppressTap) {
        self.__focusNextSuppressTap = false;
        return;
      }
      try { __FOCUS_NEXT_CORE_GLOBAL__.focusNext(self); }
      catch (error) {
        const message = error && error.message ? error.message : String(error);
        __FOCUS_NEXT_CORE_GLOBAL__.showMessage(self, message);
        console.log(`[Focus Next] 切换失败：${message}`);
      }
    },

    handleFocusNextButtonPan: function (recognizer) {
      __FOCUS_NEXT_UI_GLOBAL__.handlePan(self, recognizer);
    },
  });
}
