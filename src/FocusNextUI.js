var __FOCUS_NEXT_UI_GLOBAL__ = (function () {
  const BUTTON_WIDTH = 76;
  const BUTTON_HEIGHT = 36;
  const RIGHT_MARGIN = 10;

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
    button.frame = {
      x: Math.max(0, bounds.width - BUTTON_WIDTH - RIGHT_MARGIN),
      y: Math.max(0, (bounds.height - BUTTON_HEIGHT) / 2),
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
    };
    return true;
  }

  function show(addon) {
    const view = studyView(addon);
    if (!view) return false;
    let button = addon.__focusNextButton;
    if (!button) {
      button = new UIButton({ x: 0, y: 0, width: BUTTON_WIDTH, height: BUTTON_HEIGHT });
      styleButton(button);
      button.addTargetActionForControlEvents(addon, "focusNext:", 1 << 0);
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

  return { show, hide, remove, placeButton };
})();
