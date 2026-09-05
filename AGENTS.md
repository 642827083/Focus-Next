# Focus Next 开发规范（AI 必读）

## 总则

- 本目录是 MarginNote 插件项目。`src/` 除了使用 MarginNote 注入对象外，不按浏览器或普通 Node.js 环境假设实现。
- 将每次改动视为一次可验证的尝试，优先小步修改、保持范围清晰并确保可回滚。
- 保留用户已有的改动；不擅自覆盖、回退或删除与当前任务无关的文件。

## 版本与打包

- 正式版本以 `package.json`、`package-lock.json` 和 `src/mnaddon.json` 为准，三处版本必须一致。
- 开发、修复、测试和生成测试包时不得自动增加版本号，继续使用当前版本。
- 默认构建命令只能生成 `Focus Next Test.mnaddon` 测试包，不生成正式包。
- 正式构建必须使用独立命令；同名正式包已存在时应停止，禁止覆盖。
- 用户明确确认测试“成功了”后，先询问正式版本号；收到版本号后才能更新版本、生成正式包和处理社区介绍文档。
- 正式版本升级并更新社区介绍时，优先将现有的 `Focus Next <旧版本> 社区介绍.md` 直接重命名为 `Focus Next <新版本> 社区介绍.md` 后在其上修改；不得为同一版本额外新建重复文档。只有不存在可更新的旧介绍文档时，才允许新建对应版本文档。
- 社区介绍文件名、文档内部当前版本、下载包名和正式包版本必须同步；展开区块标题必须填写实际名称，不得保留 `****` 占位符。
- 用户尚未确认成功前，不修改社区介绍 Markdown、不增加正式更新记录、不提交本地 Git。
- 每次正式包构建成功并完成对应版本文档更新后，必须自动将本次正式版本相关修改提交到当前本地 Git 分支，无需用户再次提出“提交”；开发、修复、测试和测试包构建阶段不自动提交。
- 自动提交时只包含本次正式版本相关修改，不自动推送远程。

## 讨论与实施

- 新功能、界面调整、问题修复、构建和打包，开始前先说明方案、影响范围和验证方式。
- 用户明确说“就按这个修改”或表达等价确认前，不修改源码、版本号、安装包或社区介绍 Markdown。
- 需求存在多种合理实现、实现风险、输入不完整，或查阅文档后仍无法确定行为时，先澄清触发入口、作用场景、数据来源和期望结果。

## 文档优先

- 修改前优先使用 `mn-docs-mcp` 的 `mndocs` 检索，并以官方文档为准，不凭记忆猜测 MarginNote API 或副作用。
- MCP 不可用时，阅读 <https://mn-docs.museday.top>；仍不明确时，停止扩展实现并索取官方文档片段、可运行示例、最小复现和期望行为。
- 开始修改 `src/` 前必须查阅：
  - <https://mn-docs.museday.top/reference/js-runtime/>
  - <https://mn-docs.museday.top/reference/global/global-variables/>

## MarginNote 运行时

- `src/` 运行在 JavaScriptCore，不存在浏览器的 `window`、`document`、`fetch`、`localStorage`、`setTimeout` 和 `setInterval`。
- 延迟任务只能使用 `NSTimer`；日志统一使用 `console.log`，不得使用 `JSB.log`。
- 网络请求不得使用 `fetch`；如未来需要联网，严格按文档使用系统网络 API 和回调处理 `NSData`、文本及 JSON。
- `main.js` 只负责 `JSB.require(...)` 导入和 `JSB.newAddon` 入口，不定义业务函数，不使用 `require` 或 `import`。
- 只有 `main.js` 可以调用 `JSB.require(...)`，其他脚本不得重复调用。
- `self` 只在插件实例方法中可用，不得在模块顶层假设存在。
- 业务实现放在职责单一的独立文件；共享全局中的标识符必须使用 `__FOCUS_NEXT_*__` 前缀或放入 IIFE 闭包。
- 对原生对象和方法先做存在性检查；未经真机验证的接口不得宣称为长期稳定 API。

## 持久化

- 小型开关、显示状态和窗口位置优先使用带插件前缀的 `NSUserDefaults` key。
- 不把业务数据写入 `localStorage`、`sessionStorage`、`indexedDB`、`CacheStorage` 或 Service Worker 缓存。
- 结构化数据如未来需要持久化，优先保存到 `Application.sharedInstance().documentPath + "/<AddonId>/"` 下的 JSON 文件；临时文件使用 `tempPath`。
- JSON 读写优先使用 `NSJSONSerialization` 与 `NSData.writeToFileAtomically(path, true)`，并处理空文件、非法 JSON、默认值和 schema 迁移。

## Focus Next 功能约定

- “下一张”只按当前卡片的 `parentNote.childNotes` 统计同级兄弟节点。
- 到同级最后一张时停止并显示提示，不跨层级、不跳到其他脑图。
- 焦点切换按 `changeFocusToNote(note)` 后 `focusNoteInMindMapById(noteId)` 的顺序执行。
- 右侧浮动按钮由插件开关控制；关闭时从学习界面移除。

## 注释与验证

- 源代码中的所有注释必须使用中文；英文字符串、接口路径、变量名和测试数据不属于注释，无需翻译。
- 修改后重新阅读改动代码，运行相关单元测试和 JavaScript 语法检查；构建命令本身不提供语法校验。
- 完成构建后检查测试包文件列表和关键资源，不能只依据构建命令退出码判断成功。
