var __FOCUS_NEXT_UI_GLOBAL__ = (function () {
  const BUTTON_WIDTH = 76;
  const BUTTON_HEIGHT = 36;
  const RIGHT_MARGIN = 10;
  const POSITION_KEY = "cn.marginnote.focus-next.button-position";

  function studyView(addon) {
    const application = Application.sharedInstance();
    const studyController = application.studyController(addon && addon.window);
    return studyController && studyController.view;
  }

  function styleButton(button) {
    button.setTitleForState("下一张", 0);
    button.setTitleColorForState(UIColor.whiteColor(), 0);
    button.titleLabel.font = UIFont.boldSystemFontOfSize(14);
    button.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(0.12, 0.42, 0.78, 0.94);
    button.layer.cornerRadius = 8;
    button.layer.masksToBounds = true;
  }

  function placeButton(addon) {
    const button = addon && addon.__focusNextButton;
    const view = studyView(addon);
    if (!button || !view || !view.bounds) return false;
    const bounds = view.bounds;
    const fallback = {
      x: Math.max(0, bounds.width - BUTTON_WIDTH - RIGHT_MARGIN),
      y: Math.max(0, (bounds.height - BUTTON_HEIGHT) / 2),
    };
    const saved = addon.__focusNextButtonPosition || readSavedPosition();
    const x = Number(saved && saved.x);
    const y = Number(saved && saved.y);
    button.frame = {
      x: Number.isFinite(x) ? Math.max(0, Math.min(bounds.width - BUTTON_WIDTH, x)) : fallback.x,
      y: Number.isFinite(y) ? Math.max(0, Math.min(bounds.height - BUTTON_HEIGHT, y)) : fallback.y,
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
    };
    addon.__focusNextButtonPosition = { x: button.frame.x, y: button.frame.y };
    return true;
  }

  function readSavedPosition() {
    try {
      return NSUserDefaults.standardUserDefaults().objectForKey(POSITION_KEY);
    } catch (error) {
      console.log(`[Focus Next] 读取按钮位置失败：${error && error.message || error}`);
      return undefined;
    }
  }

  function savePosition(addon) {
    const button = addon && addon.__focusNextButton;
    if (!button || !button.frame) return;
    const position = { x: Number(button.frame.x) || 0, y: Number(button.frame.y) || 0 };
    addon.__focusNextButtonPosition = position;
    try {
      NSUserDefaults.standardUserDefaults().setObjectForKey(position, POSITION_KEY);
    } catch (error) {
      console.log(`[Focus Next] 保存按钮位置失败：${error && error.message || error}`);
    }
  }

  function handleButtonPan(addon, recognizer) {
    const button = addon && addon.__focusNextButton;
    const view = studyView(addon);
    if (!button || !view || !view.bounds) return;
    const state = Number(recognizer.state);
    if (state === 1) {
      addon.__focusNextDragging = true;
      addon.__focusNextSuppressTap = false;
      return;
    }
    if (state === 2) {
      const translation = recognizer.translationInView(view);
      const bounds = view.bounds;
      const frame = button.frame;
      button.frame = {
        x: Math.max(0, Math.min(bounds.width - BUTTON_WIDTH, frame.x + Number(translation.x || 0))),
        y: Math.max(0, Math.min(bounds.height - BUTTON_HEIGHT, frame.y + Number(translation.y || 0))),
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

  function show(addon) {
    const view = studyView(addon);
    if (!view) return false;
    let button = addon.__focusNextButton;
    if (!button) {
      button = new UIButton({ x: 0, y: 0, width: BUTTON_WIDTH, height: BUTTON_HEIGHT });
      styleButton(button);
      button.addTargetActionForControlEvents(addon, "focusNext:", 1 << 0);
      button.addGestureRecognizer(new UIPanGestureRecognizer(addon, "handleFocusNextButtonPan:"));
      addon.__focusNextButton = button;
    }
    if (button.superview !== view) {
      if (button.superview) button.removeFromSuperview();
      view.addSubview(button);
    }
    button.hidden = false;
    placeButton(addon);
    __FOCUS_NEXT_CORE_GLOBAL__.rememberCurrent(addon);
    startRememberTimer(addon);
    return true;
  }

  function startRememberTimer(addon) {
    if (!addon || addon.__focusNextRememberTimer || typeof NSTimer === "undefined" || !NSTimer.scheduledTimerWithTimeInterval) return;
    const token = Number(addon.__focusNextRememberToken || 0) + 1;
    addon.__focusNextRememberToken = token;
    addon.__focusNextRememberTimer = true;
    function rememberAndSchedule() {
      if (addon.__focusNextRememberToken !== token || !addon.__focusNextButton || addon.__focusNextButton.hidden) {
        addon.__focusNextRememberTimer = false;
        return;
      }
      __FOCUS_NEXT_CORE_GLOBAL__.rememberCurrent(addon);
      NSTimer.scheduledTimerWithTimeInterval(0.35, false, rememberAndSchedule);
    }
    NSTimer.scheduledTimerWithTimeInterval(0.35, false, rememberAndSchedule);
  }

  function hide(addon) {
    if (addon) {
      addon.__focusNextRememberToken = Number(addon.__focusNextRememberToken || 0) + 1;
      addon.__focusNextRememberTimer = false;
    }
    const button = addon && addon.__focusNextButton;
    if (!button) return;
    button.hidden = true;
    if (button.superview) button.removeFromSuperview();
  }

  function remove(addon) {
    hide(addon);
    if (addon) addon.__focusNextButton = null;
  }

  return { show, hide, remove, placeButton, handleButtonPan };
})();
