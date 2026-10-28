// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import * as path from "path";

export function resolveConfiguredWorkspacePath(configuredPath: string, workspaceRoot?: string): string {
    let result: string = configuredPath.trim();
    if (!result) {
        throw new Error("请先设置 LeetCode 题解目录。");
    }
    if (result.indexOf("${workspaceFolder}") >= 0) {
        if (!workspaceRoot) {
            throw new Error("题解路径使用了 ${workspaceFolder}，请先在 VS Code 中打开仓库文件夹。");
        }
        result = result.split("${workspaceFolder}").join(workspaceRoot);
    }
    if (/\$\{[^}]*\}/.test(result)) {
        throw new Error("题解根目录仅支持 ${workspaceFolder} 路径变量。");
    }
    if (!path.isAbsolute(result) && !workspaceRoot) {
        throw new Error("题解路径为相对路径，请先在 VS Code 中打开仓库文件夹。");
    }
    return path.resolve(workspaceRoot || ".", result);
}
