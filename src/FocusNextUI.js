var __FOCUS_NEXT_UI_GLOBAL__ = (function () {
  const BUTTON_WIDTH = 76;
  const BUTTON_HEIGHT = 36;
  const RIGHT_MARGIN = 10;
  const POSITION_KEY = "cn.marginnote.focus-next.next-button-position";

  function viewFor(addon) {
    const application = Application.sharedInstance();
    const focusWindow = application && application.focusWindow;
    const candidates = [addon && addon.window, focusWindow, undefined];
    for (const window of candidates) {
      try {
        const controller = window === undefined ? application.studyController() : application.studyController(window);
        if (controller && controller.view) return controller.view;
      } catch (ignored) {}
    }
    return undefined;
  }

  function place(addon) {
    const button = addon && addon.__focusNextButton;
    const view = viewFor(addon);
    if (!button || !view || !view.bounds) return false;
    let saved;
    try { saved = NSUserDefaults.standardUserDefaults().objectForKey(POSITION_KEY); } catch (ignored) {}
    const savedX = Number(saved && saved.x);
    const savedY = Number(saved && saved.y);
    const defaultX = view.bounds.width - BUTTON_WIDTH - RIGHT_MARGIN;
    const defaultY = (view.bounds.height - BUTTON_HEIGHT) / 2;
    button.frame = {
      x: Number.isFinite(savedX) ? Math.max(0, Math.min(view.bounds.width - BUTTON_WIDTH, savedX)) : Math.max(0, defaultX),
      y: Number.isFinite(savedY) ? Math.max(0, Math.min(view.bounds.height - BUTTON_HEIGHT, savedY)) : Math.max(0, defaultY),
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
    };
    return true;
  }

  function savePosition(addon) {
    const button = addon && addon.__focusNextButton;
    if (!button || !button.frame) return;
    const position = { x: Number(button.frame.x) || 0, y: Number(button.frame.y) || 0 };
    try { NSUserDefaults.standardUserDefaults().setObjectForKey(position, POSITION_KEY); } catch (error) {
      console.log(`[Focus Next] 保存按钮位置失败：${error && error.message || error}`);
    }
  }

  function handlePan(addon, recognizer) {
    const button = addon && addon.__focusNextButton;
    const view = viewFor(addon);
    if (!button || !view || !view.bounds) return;
    const state = Number(recognizer.state);
    if (state === 1) {
      addon.__focusNextDragging = true;
      return;
    }
    if (state === 2) {
      const translation = recognizer.translationInView(view);
      const frame = button.frame;
      button.frame = {
        x: Math.max(0, Math.min(view.bounds.width - BUTTON_WIDTH, frame.x + Number(translation.x || 0))),
        y: Math.max(0, Math.min(view.bounds.height - BUTTON_HEIGHT, frame.y + Number(translation.y || 0))),
        width: BUTTON_WIDTH,
        height: BUTTON_HEIGHT,
      };
      recognizer.setTranslationInView({ x: 0, y: 0 }, view);
      return;
    }
    if (state === 3 || state === 4) {
      if (addon.__focusNextDragging) {
        savePosition(addon);
        addon.__focusNextSuppressTap = true;
      }
      addon.__focusNextDragging = false;
    }
  }

  function rememberLoop(addon, token) {
    if (!addon || addon.__focusNextRememberToken !== token || !addon.__focusNextButton || addon.__focusNextButton.hidden) return;
    __FOCUS_NEXT_CORE_GLOBAL__.rememberFocus(addon);
    if (typeof NSTimer !== "undefined" && NSTimer.scheduledTimerWithTimeInterval) NSTimer.scheduledTimerWithTimeInterval(0.15, false, function () { rememberLoop(addon, token); });
  }

  function startRemembering(addon) {
    if (!addon || typeof NSTimer === "undefined" || !NSTimer.scheduledTimerWithTimeInterval) return;
    const token = Number(addon.__focusNextRememberToken || 0) + 1;
    addon.__focusNextRememberToken = token;
    __FOCUS_NEXT_CORE_GLOBAL__.rememberFocus(addon);
    NSTimer.scheduledTimerWithTimeInterval(0.15, false, function () { rememberLoop(addon, token); });
  }

  function show(addon) {
    const view = viewFor(addon);
    if (!view) return false;
    let button = addon.__focusNextButton;
    if (!button) {
      button = new UIButton({ x: 0, y: 0, width: BUTTON_WIDTH, height: BUTTON_HEIGHT });
      button.setTitleForState("下一张", 0);
      button.setTitleColorForState(UIColor.whiteColor(), 0);
      button.titleLabel.font = UIFont.boldSystemFontOfSize(14);
      button.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(0.12, 0.42, 0.78, 0.94);
      button.layer.cornerRadius = 8;
      button.layer.masksToBounds = true;
      button.addTargetActionForControlEvents(addon, "focusNext:", 1 << 6);
      button.addGestureRecognizer(new UIPanGestureRecognizer(addon, "handleFocusNextButtonPan:"));
      addon.__focusNextButton = button;
    }
    if (button.superview !== view) {
      if (button.superview) button.removeFromSuperview();
      view.addSubview(button);
    }
    button.hidden = false;
    place(addon);
    startRemembering(addon);
    return true;
  }

  function hide(addon) {
    if (addon) addon.__focusNextRememberToken = Number(addon.__focusNextRememberToken || 0) + 1;
    const button = addon && addon.__focusNextButton;
    if (!button) return;
    button.hidden = true;
    if (button.superview) button.removeFromSuperview();
  }

  function remove(addon) {
    hide(addon);
    if (addon) addon.__focusNextButton = null;
  }

  return { show, hide, remove, place, handlePan };
})();
