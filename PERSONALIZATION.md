# LeetCode-CN：安装与共享工作区设置

当前版本 **0.19.4**，独立扩展标识为 **`haruhiro-lain.leetcode-cn`**，插件源码分支为 `feat/personalization`。VSIX 文件名为 `LeetCode-CN-0.19.4.vsix`。

## 从旧扩展切换

从算法工作空间运行 `node scripts/vscode/install-leetcode.cjs`（需要 Node.js 22.13 或更高版本）。脚本先构建并验证独立版，在本机准备旧标识 `LeetCode.vscode-leetcode` 的状态迁移，安装独立版成功后再卸载旧标识，避免重复侧边栏与命令。可附加 `--profile "配置文件名"` 或 `--user-data-dir "用户数据目录"`。

安装后重新加载 VS Code。首次激活会将旧扩展的 Cookie、用户状态和初始化标记导入独立版存储，保留独立版已有登录，并删除本机临时迁移文件。读取旧存储时不修改 VS Code 的状态数据库，不复制无关扩展数据，也不清空共享的 `.lc` CLI 登录缓存。凭据只留在当前电脑，不写入仓库、不输出到日志。若旧会话已过期，迁移后仍需重新登录。

设置键和命令继续使用 `leetcode.*`，工作区配置及快捷键保持兼容；网页授权的 `path` 已改为 `haruhiro-lain.leetcode-cn`，回调由该独立扩展接收，支持 VS Code 和 Insiders。安装脚本之外直接安装 VSIX 时，应先移除旧扩展，避免相同命令的注册冲突；独立版启动时也会尝试迁移当前配置文件中的旧状态。

## 登录过期

中国站默认使用直连（`leetcode.cnConnectionMode: "direct"`），同时作用于登录校验和 CLI 请求；国际站及其他域名保留原代理。直连校验在独立 Node.js 进程中执行，避免被 VS Code 的 `http.proxySupport: "override"` 强制送入代理。若网络必须通过代理才能访问中国站，可改为 `"proxy"`，跟随 `http.proxy` 或环境代理。无需关闭 VS Code 全局代理。代理出口可能触发网站验证；出现 403 时不能据此认定账号过期。

输出中出现 `[ERROR] session expired, please login again [code=-1]` 时，表示旧 CLI 报告登录校验失败，不能单凭此信息认定会话过期。旧 CLI 会将 401/403（包括网站验证）都归为过期。插件会使用力扣账号接口复核：明确未登录才清除状态并提供“重新登录”；仍登录则同步本地 CLI 凭据，提示重试；网络错误、网站验证或异常响应保留登录信息，不反复要求授权，也不自动重发提交。

网页授权返回的新 Cookie 会先验证，再同步到扩展和 CLI；旧交互式登录流程中的资料、收藏接口不再决定授权是否成功。两份缓存不一致时会尝试恢复仍有效的会话。重新授权前发起的请求报错不会清除新登录。启动时会校验远端状态；若因网络或网站验证无法确认，会保留缓存状态并在输出面板说明，缓存显示登录不等于已验证远端会话。会话有效期由力扣服务端控制，插件不设置额外的本地过期时间。

`punycode` 弃用提示和 `padLevels` 循环依赖警告来自 CLI 的旧依赖，本身不代表题目获取失败。插件保留这些日志供排查，不会仅因这些警告报错；真正的 CLI 错误和非零退出仍会处理。

## Hot100 题目列表

登录后，题目列表在“全部题目”后显示 **Hot100**。展开即可查看与算法工作空间 `algo/docs/LeetCode_Hot100.md` 一致的 100 道题；题号及顺序内置于插件，另一台电脑安装后也可使用。通过状态、难度和收藏来自当前题目列表，刷新后同步；隐藏已通过题目和通过率排序设置同样生效。悬停分类可查看当前列表统计。预览、开始做题、测试和提交沿用已有功能，“开始做题”继续优先打开本地题解。

## Java 文件模板

点击“开始做题”时先在 `leetcode.workspaceFolder` 中递归搜索已有题解；本仓库为 `algo/code`，因此会覆盖 LeetCode、LeetCodeHot100 和 programmercarl 等分类。按 `@lc` 标记中的题号优先识别，兼容数字开头及旧 LeetCode 文件名。单个匹配直接打开，多份匹配优先使用当前编辑器里的匹配文件，否则按相对目录选择；取消不会创建文件。已有题解不依赖所选编程语言，也不会重新下载模板、触发标签选择或改写内容。没有匹配时继续按原路径、标签及 Java 模板规则创建。

点击“开始做题”首次创建 Java 文件时，保留官方题目标记、注释和方法签名，按保存位置的 `src/main/java` 源目录生成 package，再添加 `LeetCode题号` 外层类、空的 `public static void main(String[] args)` 与内部 `Solution`。Solution 内部使用力扣网页的默认方法格式，空方法体不添加 TODO 注释或异常占位；已有实现保持原样。设计题的 LRUCache、MyQueue 等类放在 Solution 内部，提交时仍使用原来的判题类名。

本地 ListNode、TreeNode 或题目注释提供的 Node 定义放在 `@lc code` 区域之外。标签中的连字符等会转换为下划线，使目录和 Java 包名一致；保存在 Java 源目录外时不强制添加包名。已有文件不会被“开始做题”覆盖，获取模板失败也不会留下空文件。

## 同一题的多个 Java 解法

保留文件中的 `@lc app=leetcode.cn id=题号 lang=java` 标记，即可在每个 `Solution`、`Solution1`、`Solution2`、`Solution2_1` 等类上方点击“提交代码”或“运行测试”。解法可以位于外层测试类、其他 `Solution*` 类内部，也可以在原有 `@lc code` 标记之外。提取外层解法时会排除嵌套的其他解法。“题目描述”只显示一次，位于第一个匹配的解法类入口前一行。从编辑器菜单或命令面板操作时，多个解法会弹出选择框，单个解法自动使用。

提交和测试只临时提取所选类，自动将类名、构造器与自身类型引用改为 `Solution`，保留 import 和引用的同级辅助类。如果 `Solution*` 仅包裹 `MyStack` 等设计题类，则提取该内部类并保留原名。外层 package、main、其他解法以及力扣提供的节点类型本地定义不提交。原文件不改名、不改写；临时文件在操作结束或失败后删除。代码中引用的共享函数或字段应放在对应解法类内部。

## 共享设置

从 0.18.8 起，`leetcode.defaultLanguage` 也支持工作区设置。

从 0.18.7 起，`leetcode.workspaceFolder`、`leetcode.filePath` 和 `leetcode.editor.shortcuts` 支持工作区设置。用户级设置仍作为其他工作区的默认值，当前仓库的配置优先。

将以下内容加入算法仓库的 `.vscode/settings.json`，并提交该文件：

```json
{
    "leetcode.workspaceFolder": "${workspaceFolder}/algo/code",
    "leetcode.filePath": {
        "default": {
            "folder": "",
            "filename": "${id}.${kebab-case-name}.${ext}"
        },
        "java": {
            "folder": "src/main/java/com/haruhiro_lain/LeetCode/${tag}"
        }
    },
    "leetcode.editor.shortcuts": ["submit", "test", "description"],
    "leetcode.defaultLanguage": "java"
}
```

在 VS Code 中打开算法仓库根目录。`${workspaceFolder}` 使用当前打开的仓库位置；也可以把根目录写成 `algo/code` 这样的相对路径。未打开文件夹时，使用工作区变量或相对路径会提示错误，不会创建含变量名的目录。多根工作区会先选择保存题解的根文件夹。

没有找到已有题解时，单标签题目自动创建标签目录，多标签题目弹出选择框。已有题解直接打开或选择已有路径，不随标签设置迁移。新建 Java 文件会按源目录生成包声明、外层类、空 main 和内部 Solution，具体格式见“Java 文件模板”。

插件生成的文件保留 `@lc app=leetcode.cn id=题号 lang=java` 标记，点击首个匹配解法类入口前一行的“题目描述”可以再次打开题目。该入口依赖当前已加载的题目列表；提示未找到题号时，先登录并刷新题目列表。

另一台电脑需安装本定制版一次；上游市场版不会读取这些工作区设置。先拉取插件 `feat/personalization` 分支和算法工作空间 `main` 分支，再从工作空间根目录运行 `node scripts/vscode/install-leetcode.cjs`。两台电脑的 JDK 目录相同时，可在工作空间共享 `java.configuration.runtimes`。登录凭据由各机自行保存。安装后重新加载 VS Code 窗口。

## 构建

使用 Node.js 22.13 或更高版本：

```text
npm ci --registry=https://registry.npmjs.org --no-audit --no-fund
npm run lint
npm test
npm exec --yes --package=@vscode/vsce@4.0.0 -- vsce package --out LeetCode-CN-0.19.4.vsix
```
