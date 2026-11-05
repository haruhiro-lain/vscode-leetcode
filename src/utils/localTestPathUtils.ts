import * as path from "path";

export function resolveLocalTestPath(workspaceRoot: string, sourcePath: string): string {
    const relative: string = path.relative(workspaceRoot, sourcePath);
    if (!relative || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
        throw new Error("Java 文件必须位于其所属工作区目录内。");
    }
    const extension: string = path.extname(relative);
    if (extension.toLowerCase() !== ".java") throw new Error("本地文件测试目前支持 Java 题解。");
    return path.join(workspaceRoot, ".vscode", "LeetCode-CN", relative.slice(0, -extension.length) + ".txt");
}
