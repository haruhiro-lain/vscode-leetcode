# Change Log
All notable changes to the "leetcode" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.22.9] 自动发布安装包
### Added
- 定制分支推送新版本后，Windows 与 Linux 校验通过即自动发布 GitHub Release，提供 VSIX 安装包、SHA256 校验文件与安装说明。
- 支持重复推送跳过已发布版本、失败草稿重试及版本与提交一致性校验。
- 增加 Releases 下载入口，另一台电脑无需拉取插件源码即可安装或更新。

## [0.22.8] 精简随机题单选项说明
### Changed
- 去掉随机抽题范围说明中的括号补充内容和“力扣原有分类”标签，题单范围及抽题逻辑保持原样。

## [0.22.7] 按题单范围随机抽题
### Added
- 随机一题先选择范围，覆盖全部来源、力扣全部／难度／标签／公司／收藏及所有自定义题单；内置分类即使在侧边栏隐藏仍可选择。
- 全部来源合并力扣和自定义题目；自定义题单递归收录子模块，按题号或本地文件去重，避免重复记录提高抽中概率。
- 本地题可离线抽取，有 Java 时打开已有代码，没有则展示本地题面；保留隐藏已通过、会员和力扣模板语言检查，取消或空范围不回退到其他题单。

## [0.22.6] 选题与模板语言兼容
### Fixed
- 随机一题先检查力扣模板支持的语言，跳过与当前语言不兼容的 SQL / Pandas 题；非会员跳过锁定题目，并处理空列表。
- 手动开始做题时，默认语言不兼容则仅提供该题可用且插件支持的语言，取消不会创建代码，也不改动默认语言；已有题解仍优先打开。
- 随机选题优先复用当前题目缓存；网络或登录错误保留原错误处理，不误判为语言不支持。

## [0.22.5] 本地题目描述入口对齐
### Fixed
- 本地 Java 的题目描述入口锚定首个 Solution 声明，紧邻显示在其上方，并随声明行的四空格缩进对齐。
- 修正锚定前一空白行导致入口靠左、与 Solution 之间隔着空行的问题。

## [0.22.4] 精简本地题面预览
### Changed
- 去掉本地题面预览顶部的“本地题目”及“开始做题 / 打开源文件 / 刷新”工具栏，直接展示题目正文。
- 清理对应脚本与顶部锚点留白，保留题目列表的开始做题、正文通过勾选及底部 OD 提交入口。

## [0.22.3] 本地 OD 题面与提交入口
### Added
- 本地题面有与文件名一致的 HydroOJ 题号时，在正文底部显示“提交代码”按钮，使用系统浏览器打开对应题目的提交页面。
- 入口随当前题面切换和修改更新，保留题号前导零，并忽略已切换题目的旧按钮消息。

### Fixed
- 连续切换本地题目复用右侧题面面板时，不再强制聚焦第二编辑器组，保留 Java 编辑器焦点。

### Tests
- 覆盖不含题面注释的 OD Java，确认题目描述入口仍位于 Solution 前，并请求在右侧打开本地 Markdown。

## [0.22.2] 本地题代码中的题目描述
### Added
- 自定义本地题单关联的 Java 文件及 Markdown 源文件显示题目描述快捷入口，使用插件题面视图展示本地内容。
- Java 入口位于首个 Solution 前一行；同一代码关联多个题面时可按路径选择，并保留当前代码作为开始做题的目标。
- 保存题单或关联文件后自动更新编辑器入口，力扣题目的在线描述与提交测试保持原有行为。

## [0.22.1] 本地题开始做题
### Added
- 本地 Markdown 题目有对应 Java 文件时，在题目预览及列表旁显示开始做题，直接打开已有代码。
- 自动关联题单索引同一行的 Java 链接、题面内 Java 链接或同目录同名 Java 文件，并支持通过 java 字段显式配置。
- 跨卷题面保留所选记录的 Java 关联，多候选时按相对路径选择；文件缺失时隐藏或提示检查。

## [0.22.0] 默认分类与自定义题单统一排序
### Added
- 题单 JSON 支持 builtin 引用原有全部题目、难度、标签、公司和收藏分类。
- 侧边栏完整列表按 plans 数组顺序显示，默认分类和自定义题单可交错排列，保存后立即更新。
- 新配置模板包含五个默认分类；缺少配置时恢复原分类，同一默认分类跨文件只显示一次。

## [0.21.3] 侧边栏标题精简
### Changed
- 视图标题与容器标题统一为 LeetCode-CN，去掉按钮同行标题中的“题目列表”。

## [0.21.2] 工具栏图标更新
### Changed
- 随机一题改用音乐播放器常见的交叉箭头随机播放图标，分别适配浅色和深色主题。
- 编辑自定义题单更名为自定义题单，使用带加号的文件图标，保持原有按钮顺序。

## [0.21.1] 题目列表工具栏排列
### Changed
- 顶部按钮按搜索题目、随机一题、刷新题目、编辑自定义题单、全部折叠排列。
- 切换站点及登录入口移至“视图和更多操作”菜单，保留登录状态控制。

## [0.21.0] 模块进度与本地题通过标记
### Added
- 自定义题单及各层模块显示通过进度，中文序号转换为阿拉伯数字；隐藏通过题时保留完整分母。
- 本地题在 Markdown 题面标题下保存唯一通过勾选框，支持从题目预览直接勾选、取消及保存；Java 文件不重复保存。
- 本地题通过状态同步树图标、筛选和模块进度；跨模块共享同一题面时状态同步。力扣题继续使用账号 AC 状态。

## [0.20.2] Hot100 统一为自定义题单
### Changed
- 移除固定 Hot100 分类，由工作区自定义题单 JSON 读取本地 Hot100 文档，可统一排序、改名或移除。
- Markdown 索引支持 sourceMode: leetcode，仅导入带力扣标记的 Java 题解链接，避免把页尾导航当作题目。
- 保留 17 个模块、100 道题的顺序和全部题目操作，不再维护插件内置题号副本。

## [0.20.1] 登录按钮显示修复
### Fixed
- 题目列表工具栏和命令面板的登录、退出入口随登录状态切换，不再在有效登录后显示登录按钮。
- 启动恢复、网页授权、会话复核和退出登录统一更新菜单状态；网络异常保留已登录显示。

## [0.20.0] 自定义题单与本地题目
### Added
- 使用工作区 JSON 配置自定义分层题单，支持力扣题号、Markdown 索引和本地题目目录；配置可随仓库共享。
- 本地 Markdown 题目在插件面板渲染，支持图片、表格、代码高亮、相对链接、源文件编辑和内容刷新；无需力扣登录。
- 提供“编辑自定义题单”和“预览本地题目”命令，保存配置及相关文件后自动刷新列表。

## [0.19.5] Hot100 模块分层
### Changed
- Hot100 按原站题单的 17 个模块分层展示，共 100 道题，保留默认模块及题目顺序。
- 模块内支持通过率排序、隐藏已通过题目和状态刷新；模块及总分类分别显示题目统计。
- 题目沿用已有预览、开始做题、测试和提交入口。

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
