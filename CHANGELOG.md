# Change Log
All notable changes to the "leetcode" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.19.4] Hot100 题目列表
### Added
- 题目列表在“全部题目”后新增 Hot100 分类，内置当前工作空间题单的 100 道题及其顺序。
- 沿用原题目的通过状态、难度、收藏和操作入口，支持隐藏已通过题目及通过率排序。
- Hot100 悬停提示显示已通过、未通过和当前显示题数；开始做题继续优先复用本地已有题解。

## [0.19.3] 优先打开已有题解
### Added
- “开始做题”先递归搜索题解根目录中的已有题号，找到后直接打开，不下载模板、不重复创建文件。
- 优先识别 @lc 题号，兼容数字开头文件名和旧 LeetCode 文件名；排除构建输出、缓存及其他平台题号。
- 多份题解优先使用当前编辑器文件，否则显示包含相对目录的选择列表；取消选择不创建新文件。

## [0.19.2] 中国站连接修复
### Fixed
- 中国站默认直连，避免代理出口触发 Cloudflare 网站验证，导致有效会话无法验证或反复要求授权。
- 登录 HTTP 请求与 CLI 题目、测试、提交使用一致的连接方式；CLI 同时处理大小写代理和 NO_PROXY 环境变量。
- 直连请求在独立 Node.js 进程中执行，兼容 VS Code 的 http.proxySupport: override，不受编辑器强制代理覆盖。
### Added
- leetcode.cnConnectionMode 支持 direct（默认）和 proxy，不修改 VS Code 全局代理或国际站连接。

## [0.19.1] 登录状态修复
### Fixed
- CLI 报告过期时使用力扣账号接口复核；网站验证、403、502 和网络故障保留登录，只有明确未登录才清除凭据。
- 授权回调验证成功后统一同步扩展和 CLI，避免旧交互式登录流程及额外资料请求造成误报。
- 启动时验证远端状态，不再把 CLI 本地账号缓存当作登录有效的证明；忽略重新授权前发起的旧请求错误。
- 并发登录和凭据写入按顺序处理，登录信息不进入命令参数或日志。

## [0.19.0] 独立扩展 LeetCode-CN
### Changed
- 扩展标识改为 haruhiro-lain.leetcode-cn，安装列表、活动栏与状态栏统一显示 LeetCode-CN。
- 网页授权回调改为独立标识，保留 leetcode.* 设置键和命令兼容性。
### Added
- 在本机迁移旧扩展登录及初始化状态，不覆盖独立版已有登录，完成后删除迁移文件。
- 安装脚本在新版安装成功后移除旧标识，避免重复入口；首次启动保留共享 CLI 缓存。

## [0.18.14] LeetCode-CN
### Fixed
- 区分 CLI 错误日志、正常题面文本和 Node 警告，不再把普通 ERROR 文本判为失败。
- 会话过期时显示中文提示和重新登录入口，清理过期登录状态；并发失败仅显示一次登录提示。
- 登录错误不再作为提交结果展示；CLI 在退出码为 0 时报告的真实错误仍会正确处理。

## [0.18.13] LeetCode-CN
### Changed
- Solution 使用力扣提供的默认类和方法格式，保留空方法体，不再添加 TODO 注释或异常占位。

## [0.18.12] LeetCode-CN
### Added
- 新生成的 Java 题解按源目录补齐 package、LeetCode题号外层类、空 main 和内部 Solution。
- 空题解方法使用 TODO 占位，链表和树的本地节点定义放在提交区域之外；设计题保留内部判题类名称。
- Java 标签目录中的连字符等转为下划线，与包名保持一致。
### Fixed
- 模板获取失败不留下空文件；生成时保护已有题解及并发创建的文件。

## [0.18.11] LeetCode-CN
### Fixed
- 支持嵌套在 Solution 内部的 Solution2 等解法，单独显示提交和测试入口。
- 提取某个解法时排除内部其他 Solution* 实现，避免一并提交。
- 题目描述移到第一个匹配的解法类入口前一行，只显示一次。

## [0.18.10] LeetCode-CN
### Added
- Java 的每个 Solution、Solution1、Solution2_1 等实现均显示提交和测试入口。
- 文件菜单提交或测试时可选择实现；临时提取所选类并改名为 Solution，原文件保持不变。
- 提取时保留导入与引用的辅助类，排除外层测试类和其他解法，完成或失败后清理临时文件。

## [0.18.8] LeetCode-CN
### Changed
- 插件显示名称、命令分类和输出通道统一为 LeetCode-CN。
- 默认编程语言支持仓库工作区设置，另一台电脑拉取后可继续使用 Java。
- 扩展标识及设置键保持兼容，可直接覆盖安装旧定制版。

## [0.18.7] 中文定制版
### Fixed
- 题解目录、文件模板与代码快捷入口支持工作区设置，随仓库共享。
- 题解根目录支持相对路径和 `${workspaceFolder}`，在不同电脑上使用各自的仓库位置。

## [0.18.4]
### Added
- change graphql path

## [0.18.3]
### Added
- re-add cookie-based login method  [PR#969](https://github.com/LeetCode-OpenSource/vscode-leetcode/pull/969)

## [0.18.2]
### Fixed
- fix login issue on VS Code Insiders  [PR#968](https://github.com/LeetCode-OpenSource/vscode-leetcode/pull/968)

## [0.18.1]
### Changed
- change login way and add tracking logic option [PR#944](https://github.com/LeetCode-OpenSource/vscode-leetcode/pull/944)

## [0.18.0]
### Added
- Add `star` command in shortcuts [PR#601](https://github.com/LeetCode-OpenSource/vscode-leetcode/pull/601)
- Add an option to disable endpoint translation [#389](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/389)

### Changed
- LeetCode actions are moved into sub-menu: `LeetCode` in the editor context menu. [PR#712](https://github.com/LeetCode-OpenSource/vscode-leetcode/pull/712)

### Fixed
[Bugs fixed](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues?q=is%3Aissue+milestone%3A0.18.0+is%3Aclosed+label%3Abug)

## [0.17.0]
### Added
- Add TypeScript support [#560](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/560)

### Changed
- Update the UI resources [PR#561](https://github.com/LeetCode-OpenSource/vscode-leetcode/pull/561)

## [0.16.2]
### Added
- New Category: `Concurrency` [CLI#42](https://github.com/leetcode-tools/leetcode-cli/pull/42)
- New configuration to better configure how to show the description [#310](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/310)

### Removed
- Removed the deprecated setting `leetcode.enableShortcuts` [PR#520](https://github.com/LeetCode-OpenSource/vscode-leetcode/pull/520)
- Removed the deprecated setting `leetcode.outputFolder` [PR#521](https://github.com/LeetCode-OpenSource/vscode-leetcode/pull/521)

## [0.16.1]
### Added
- Can show the problem in current workspace even if it's not a LeetCode workspace [#373](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/373)

### Fixed
[Bugs fixed](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues?q=is%3Aissue+milestone%3A0.16.1+is%3Aclosed+label%3Abug)

## [0.16.0]
### Added
- Support GitHub login and LinkedIn login [PR#496](https://github.com/LeetCode-OpenSource/vscode-leetcode/pull/496)

## [0.15.8]
### Added
- Add a new command `Sign In by Cookie` to workaround the issue that [users cannot login to LeetCode](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/478). Please check the [workaround steps](https://github.com/LeetCode-OpenSource/vscode-leetcode/tree/master#%EF%B8%8F-attention-%EF%B8%8F--workaround-to-login-to-leetcode-endpoint) for more details!

### Changed
- Update the explorer icons to be align with the VS Code design [#460](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/460)

## [0.15.7]
### Fixed
[Bugs fixed](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues?q=is%3Aissue+milestone%3A0.15.7+is%3Aclosed+label%3Abug)

## [0.15.6]
### Added
- Add a link to the solution page [#424](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/424)

### Fixed
[Bugs fixed](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues?q=is%3Aissue+milestone%3A0.15.6+is%3Aclosed+label%3Abug)

## [0.15.5]
### Added
- Add a link to the discussion page [#420](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/420)

### Fixed
[Bugs fixed](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues?q=is%3Aissue+milestone%3A0.15.5+is%3Aclosed+label%3Abug)

## [0.15.4]
### Added
- Add a new setting `leetcode.filePath`. Now users can use this setting to dynamicly specify the relative folder name and file name. [#PR380](https://github.com/LeetCode-OpenSource/vscode-leetcode/pull/380)

### Fixed
- Missing language `Rust` in the supported language list. [#PR412](https://github.com/LeetCode-OpenSource/vscode-leetcode/pull/412)
- Cannot show output when the answer is wrong. [#414](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/414)

## [0.15.3]
### Added
- Support `Pick One` [#263](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/263)
- Support toggling the favorite problems [#378](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/378)

### Changed
- Update the activity bar icon [#395](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/263)

### Fixed
[Bugs fixed](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues?q=is%3Aissue+milestone%3A0.15.3+is%3Aclosed+label%3Abug)

## [0.15.2]
### Added
- Prompt to open the workspace for LeetCode [#130](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/130)
- Support deleting sessions [#198](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/130)

### Fixed
[Bugs fixed](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues?q=is%3Aissue+milestone%3A0.15.2+is%3Aclosed+label%3Abug)

## [0.15.1]
### Fixed
[Bugs fixed](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues?q=is%3Aissue+milestone%3A0.15.1+is%3Aclosed+label%3Abug)

## [0.15.0]
### Added
- Auto refresh the explorer after submitting [#91](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/91)
- Add a editor shortcut `Description` to show the problem description [#286](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/286)
- Support customizing the shortcuts in editor [#335](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/335)

### Fixed
[Bugs fixed](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues?q=is%3Aissue+milestone%3A0.15.0+is%3Aclosed+label%3Abug)

## [0.14.3]
### Added
- Support interpolation for `leetcode.outputFolder` settings [#151](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/151)

### Fixed
[Bugs fixed](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues?q=is%3Aissue+is%3Aclosed+milestone%3A0.14.3+label%3Abug)

## [0.14.2]
### Added
- Add the `All` category in the LeetCode Explorer [#184](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/184)
- Add shortcuts for `Show top voted solution` [#269](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/269)

### Fixed
[Bugs fixed](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues?q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A0.14.2)

## [0.14.1]
### Added
- Add setting `leetcode.showCommentDescription` to specify whether including the problem description in comments or not [#287](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/287)

## [0.14.0]
### Added
- Add setting `leetcode.enableShortcuts` to specify whether to show the submit/test shortcuts in editor [#146](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/146)
- Add `Like` and `Dislike` counts in the problem description [#267](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/267)

### Changed
- Improve the `Preview`, `Result` and `Solution` views

### Fixed
[Bugs fixed](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues?q=is%3Aissue+label%3Abug+is%3Aclosed+milestone%3A0.14.0)

## [0.13.3]
### Fixed
- Fix the bug that the extension cannot be activated

## [0.13.2]
### Added
- Add a setting `leetcode.enableStatusBar` to specify whether the LeetCode status bar will be shown or not [#156](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/156)
- Add a setting `leetcode.nodePath` to specify the `Node.js` executable path [#227](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/227)

### Changed
- Update the activity bar icon, See: [#225](https://github.com/LeetCode-OpenSource/vscode-leetcode/pull/225)

### Fixed
[Bugs fixed](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues?q=is%3Aissue+milestone%3A0.13.2+is%3Aclosed+label%3Abug)

## [0.13.1]
### Fixed
[Bugs fixed](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues?q=is%3Aissue+milestone%3A0.13.1+is%3Aclosed+label%3Abug)

## [0.13.0]
### Added
- Preview the problem description [#131](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/131)
- Show top voted solution [#193](https://github.com/LeetCode-OpenSource/vscode-leetcode/pull/193)
- Add `collapse all` for the explorer [#197](https://github.com/LeetCode-OpenSource/vscode-leetcode/pull/197)

### Fixed
[Bugs fixed](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues?q=is%3Aissue+is%3Aclosed+milestone%3A0.13.0+label%3Abug)

## [0.12.0]
### Added
- Add new command `LeetCode: Switch Default Language` to support switching the default language [#115](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/115)
- Support `PHP` and `Rust` ([#83](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/83), [#103](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/103))

### Fixed
- Cannot retrieve time and memory result [#105](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/105)
- Power operator displays in a wrong way [#74](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/74)

## [0.11.0]
### Added
- Add new setting: `leetcode.outputFolder` to customize the sub-directory to save the files generated by 'Show Problem' [#119](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/119)
- Add tooltips for sub-category nodes in LeetCode Explorer [#143](https://github.com/LeetCode-OpenSource/vscode-leetcode/pull/143)

### Changed
- Now when triggering 'Show Problem', the extension will not generate a new file if it already exists [#59](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/59)

### Fixed
- Log in timeout when proxy is enabled [#117](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/117)

## [0.10.2]
### Fixed
- Test cases cannot have double quotes [#60](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/60)

## [0.10.1]
### Changed
- Refine the README page.

## [0.10.0]
### Added
- Add an extension setting to hide solved problems [#95](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/95)
- Support categorize problems by company, tag, difficulty and favorite [#67](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/67)

## [0.9.0]
### Changed
- Improve the experience of switching endpoint [#85](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/85)
- Use web view to show the result page [#76](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/76)


## [0.8.2]
### Added
- Add Code Lens for submitting the answer to LeetCode

### Fixed
- Fix the bug that the extension could not automatically sign in [#72](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/72)

## [0.8.1]
### Changed
- Upgrade LeetCode CLI to v2.6.1

## [0.8.0]
### Added
- Support LeetCode CN [#50](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/50)
- Support Windows Subsystem for Linux [#47](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/47)

## [0.7.0]
### Added
- Add spinner when submitting code [#43](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/43)

## [0.6.1]
### Added
- Add Sign in action into LeetCode Explorer title area [#25](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/25)

## [0.6.0]
### Changed
- Move LeetCode explorer into activity bar [#39](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/39)

### Added
- Support trigger test & submit in the editor [#37](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/37)

### Fixed
- Fix the bug that cannot show problem [#41](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/41)

## [0.5.1]
### Fixed
- Fix the bug when user's path contains white spaces [#34](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/34)

## [0.5.0]
### Added
- Support submit and test solution files from the file explorer in VS Code ([#24](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/24), [#26](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/26))

## [0.4.0]
### Added
- Support locked problem [#20](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/20)

### Changed
- Simplify the command 'LeetCode: Test Current File' to 'LeetCode: Test' [#18](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/18)
- Will automatically save current file when 'LeetCode: Test' command is triggered [#17](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/17)

## [0.3.0]
### Added
- Test current solution file [#15](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/15)

## [0.2.1]
### Fixed
- Fix the wrong icon bug in LeetCode Explorer [#9](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/9)
- Fix the switch session bug when login session is expired [#12](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/12)

## [0.2.0]
### Added
- Support setting the default language to solve problems [#5](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/5)

### Fixed
- When user cancels login, no further actions will happen [#10](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/10)

## [0.1.2]
### Fixed
- Fix the duplicated nodes in LeetCode Explorer bug [#6](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/6)

## [0.1.1]
### Fixed
- Fix a bug in LeetCode Explorer [#3](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/3)
- Remove the show problem command from command palette [#4](https://github.com/LeetCode-OpenSource/vscode-leetcode/issues/4)

## [0.1.0]
### Added
- Sign in/out to LeetCode
- Switch and create session
- Show problems in explorer
- Search problems by keywords
- Submit solutions to LeetCode
