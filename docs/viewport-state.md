# 焦点切换与视图恢复实验记录

核对日期：2026-10-12。实验使用 1.0.6 测试包；用户确认当前效果，正式版本为 1.0.7。

## 当前实现

用户接受焦点切换后定位卡片的显示效果。已移除状态读取和恢复模块；当前同步调用 `changeFocusToNote` 后 `focusNoteInMindMapById`。不依赖 MN Utils，不调用 `UIStatusURL`，不使用剪贴板，不读取原生脑图比例。无法读取当前焦点时，沿用插件已记住的卡片；打开其他学习集时清除记忆。

用户反馈切换前比例大于 100% 时可能回到 100% 并短暂缩放，低于 100% 时未观察到这一现象；本版本未加入动画控制或比例恢复。对照 Daguanyuan Bridge 1.1.8 正式包与当日测试包，它们的前后切换只调用 `changeFocusToNote`，与 Focus Next 1.0.6 一致。1.0.7 多出的定位调用会高亮卡片，但尚未通过同场景对照确认缩放由哪一步触发。用户讨论后确认继续按当前实现打包。

作者的状态读取封装会调用宿主的复制状态命令。用户截图确认该命令还会显示“当前 UI 状态已复制到剪贴板”及长 URL，插件自己的失败提示关闭后仍然出现。因此移除整条实验流程，而非继续屏蔽插件 HUD。

`node --test test/navigation.test.mjs` 从实际 main.js 加载模块并调用按钮处理函数，验证取消选中后的连续切换、切换后定位、首尾提示，以及没有触发状态读取或剪贴板访问。移除前两项测试均失败，移除后通过。原生布局与动画仍须在 iPad 验证。

## 历史实验依据

- 用户提供的 iPad MarginNote 4.5.0/60 崩溃日志明确记录 `zoomScale` 的 unrecognized selector。不能把 `notebookController.mindmapView` 当作 UIScrollView。此次实现不读取该对象的比例、偏移或节点几何。
- [最新界面状态文档](https://mnext.museday.top/api-reference/界面与模板/获取界面状态) 的实录包含 `topicid`、`focusnoteid` 和 `mapLocation`；位置中的 CGPoint 类型包装按原值传回。该页面的面板请求机制不直接用于经典插件的 JavaScriptCore。
- 先查阅 [运行时](https://mn-docs.museday.top/reference/js-runtime/)、[全局入口](https://mn-docs.museday.top/reference/global/global-variables/)，再查阅 [MN Utils 文档](https://mnaddon.craft.me/mnapi) 与 mndocs 的 `libmn/mnutil`。
- 为核实返回类型与副作用，读取了作者在[发布帖](https://bbs.marginnote.com.cn/t/topic/49699)提供的 0.2.5 安装包，仅用于参考，不执行、不复制到本项目。`getCurrentUIStatusURL()` 实际执行 `UIStatusURL`、等待 0.1 秒、解析剪贴板，返回状态对象；与 mndocs 标注的 URL 返回类型有差异。适配两种类型。
- 同包中的 `setMindmapZoonScale()` 示例通过 `setUIStatusByConfig({topicid, mapLocation: {scale}})` 更新局部配置。此次传入完整 `mapLocation`，但不传旧焦点、选中列表和阅读区配置。
- 使用 [UIPasteboard.items](https://developer.apple.com/documentation/uikit/uipasteboard/items) 保存并恢复原剪贴板的全部表示。仅当剪贴板仍为本次复制的状态 URL 时恢复，其他新复制内容不覆盖。

## 已移除的实验流程

1. 从原有同级兄弟列表计算上一张／下一张，边界立即停止。
2. 串行读取界面状态，核对当前窗口、学习集、焦点和位置字段。
3. 按项目规范先调用 `changeFocusToNote`，再调用可用的 `focusNoteInMindMapById`。
4. 使用 NSTimer 等待 0.35 秒，核对任务仍有效、焦点仍是目标，再恢复一次 `{topicid, mapLocation}`。
5. 处理期间忽略重复点击；关闭插件、打开学习集或断开场景后取消任务。缺失接口降级切换并提示依赖要求；状态读取或恢复失败降级切换，只记录日志，不显示弹窗。异步切换错误通过按钮处理函数捕获。

切换前后核对焦点时，能读取当前焦点就优先使用它，不能读取时使用插件记住的卡片。原实现只调用 `currentFocus()` 校验，与导航允许使用记忆的行为不一致，导致取消选中后任务直接取消。已用实际 Core 和 Viewport 模块复现，并加入上一张／下一张在取消选中后连续切换的回归测试；仍需真机确认宿主行为。

## 历史实验的验证边界

历史实验测试验证读写配置、执行顺序、剪贴板保留、快速点击、取消和错误降级。它不证明 MarginNote 的原生布局、动画和偏移语义。原样恢复地图位置是否使不同大小的新焦点卡准确落在上一张卡片的屏幕位置未获真机验证；0.35 秒等待也可能出现短暂的默认缩放动画。`setUIStatusByConfig()` 返回 undefined 表示已发出请求，不证明宿主已应用。这些已移除模块的测试由当前导航入口回归测试替代。

真机反馈：当前 iPad 未读到有效界面状态，采用降级后的切换效果。用户接受当前效果，要求去掉“保持视图失败”弹窗；此类失败仅记录日志，保留第一／最后一张等必要提示。

当前真机测试：进入卡片焦点后取消选中，连续点击上一张／下一张，确认不用再次点选卡片，不再显示复制状态和恢复失败弹窗；再检查第一／最后一张的边界提示。
