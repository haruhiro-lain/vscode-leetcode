# 中文定制版：共享工作区设置

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
    "leetcode.editor.shortcuts": ["submit", "test", "description"]
}
```

在 VS Code 中打开算法仓库根目录。`${workspaceFolder}` 使用当前打开的仓库位置；也可以把根目录写成 `algo/code` 这样的相对路径。未打开文件夹时，使用工作区变量或相对路径会提示错误，不会创建含变量名的目录。多根工作区会先选择保存题解的根文件夹。

单标签题目自动创建标签目录，多标签题目弹出选择框。已有文件不迁移；在新标签目录中打开同一题目可能生成另一份文件。路径设置不自动生成 Java 包声明，也不恢复 Java 包装类适配或云端草稿同步功能。

插件生成的文件保留 `@lc app=leetcode.cn id=题号 lang=java` 标记，点击代码末尾的“题目描述”可以再次打开题目。该入口依赖当前已加载的题目列表；提示未找到题号时，先登录并刷新题目列表。

另一台电脑需安装本定制版一次；上游市场版不会读取这些工作区设置。登录凭据、JDK 路径不在共享配置中。升级本插件后重新加载 VS Code 窗口。

## 构建

使用 Node.js 22 或更高版本：

```text
npm ci --registry=https://registry.npmjs.org --no-audit --no-fund
npm run lint
npm test
npm exec --yes --package=@vscode/vsce@4.0.0 -- vsce package
```
