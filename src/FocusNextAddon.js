function createFocusNextAddon() {
  return JSB.defineClass("FocusNextAddon : JSExtension", {
    sceneWillConnect: function () {
      self.focusNextEnabled = __FOCUS_NEXT_CORE_GLOBAL__.enabled();
      self.__focusNextRememberToken = 0;
      self.__focusNextPlaceToken = 0;
      self.__focusNextClickToken = 0;
      console.log("[Focus Switch] 插件已初始化");
    },

    sceneDidDisconnect: function () {
      self.__focusNextRememberToken += 1;
      self.__focusNextPlaceToken += 1;
      __FOCUS_NEXT_COMMANDS_GLOBAL__.cancelClick(self);
      __FOCUS_NEXT_SETTINGS_GLOBAL__.remove(self);
      __FOCUS_NEXT_UI_GLOBAL__.remove(self);
      self.focusNextEnabled = false;
    },

    notebookWillOpen: function () {
      __FOCUS_NEXT_COMMANDS_GLOBAL__.cancelClick(self);
      __FOCUS_NEXT_SETTINGS_GLOBAL__.hide(self);
      self.__focusNextLastFocus = null;
      if (self.focusNextEnabled !== false) __FOCUS_NEXT_UI_GLOBAL__.show(self);
      else __FOCUS_NEXT_UI_GLOBAL__.hide(self);
    },

    queryAddonCommandStatus: function () {
      return { image: "icon.png", object: self, selector: "focusToolbarClick:", checked: self.focusNextEnabled !== false };
    },

    focusToolbarClick: function () {
      try { __FOCUS_NEXT_COMMANDS_GLOBAL__.toolbarClick(self); }
      catch (error) {
        __FOCUS_NEXT_CORE_GLOBAL__.showMessage(self, "暂时无法显示焦点切换菜单");
        console.log(`[Focus Switch] 菜单操作失败：${error && error.message || error}`);
      }
    },

    closeFocusSettings: function () { __FOCUS_NEXT_SETTINGS_GLOBAL__.hide(self); },

    handleFocusSettingsPan: function (recognizer) { __FOCUS_NEXT_SETTINGS_GLOBAL__.handlePan(self, recognizer); },

    setFocusEnabled: function (sender) { __FOCUS_NEXT_COMMANDS_GLOBAL__.apply(self, "enabled", Boolean(sender.on)); },
    setCrossLevelEnabled: function (sender) { __FOCUS_NEXT_COMMANDS_GLOBAL__.apply(self, "crossLevel", Boolean(sender.on)); },
    setOrdinalEnabled: function (sender) { __FOCUS_NEXT_COMMANDS_GLOBAL__.apply(self, "ordinal", Boolean(sender.on)); },
    setPreviousEnabled: function (sender) { __FOCUS_NEXT_COMMANDS_GLOBAL__.apply(self, "previous", Boolean(sender.on)); },

    sceneWillResignActive: function () {
      __FOCUS_NEXT_COMMANDS_GLOBAL__.cancelClick(self);
      __FOCUS_NEXT_SETTINGS_GLOBAL__.hide(self);
    },

    notebookWillClose: function () {
      __FOCUS_NEXT_COMMANDS_GLOBAL__.cancelClick(self);
      __FOCUS_NEXT_SETTINGS_GLOBAL__.hide(self);
      __FOCUS_NEXT_UI_GLOBAL__.hide(self);
      self.__focusNextLastFocus = null;
    },

    controllerWillLayoutSubviews: function () {
      __FOCUS_NEXT_SETTINGS_GLOBAL__.layout(self);
      if (!self.__focusNextDragging) __FOCUS_NEXT_UI_GLOBAL__.place(self);
    },

    toggleFocusNext: function () {
      __FOCUS_NEXT_COMMANDS_GLOBAL__.apply(self, "enabled", !(self.focusNextEnabled !== false));
    },

    focusNext: function () {
      if (self.__focusNextSuppressTap) {
        self.__focusNextSuppressTap = false;
        return;
      }
      if (self.focusNextEnabled === false) return;
      try {
        const result = __FOCUS_NEXT_CORE_GLOBAL__.focusNext(self);
        __FOCUS_NEXT_UI_GLOBAL__.refreshProgress(self, result.next);
      }
      catch (error) {
        const message = error && error.message ? error.message : String(error);
        __FOCUS_NEXT_CORE_GLOBAL__.showMessage(self, message);
        console.log(`[Focus Switch] 切换失败：${message}`);
      }
    },

    focusPrevious: function () {
      if (self.__focusNextSuppressTap) {
        self.__focusNextSuppressTap = false;
        return;
      }
      if (self.focusNextEnabled === false) return;
      try {
        const result = __FOCUS_NEXT_CORE_GLOBAL__.focusPrevious(self);
        __FOCUS_NEXT_UI_GLOBAL__.refreshProgress(self, result.next);
      }
      catch (error) {
        const message = error && error.message ? error.message : String(error);
        __FOCUS_NEXT_CORE_GLOBAL__.showMessage(self, message);
        console.log(`[Focus Switch] 切换失败：${message}`);
      }
    },

    handleFocusNextButtonPan: function (recognizer) {
      __FOCUS_NEXT_UI_GLOBAL__.handleNextPan(self, recognizer);
    },

    handleFocusPreviousButtonPan: function (recognizer) {
      __FOCUS_NEXT_UI_GLOBAL__.handlePreviousPan(self, recognizer);
    },
  });
}
