import * as fse from "fs-extra";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { buildJavaSubmission, findJavaSolutions, IJavaSolutionTarget } from "./javaSolutionUtils";
import { getActiveFilePath } from "./workspaceUtils";
import * as wsl from "./wslUtils";

export interface IPreparedSolutionFile {
    filePath: string;
    dispose(): Promise<void>;
}

export async function prepareSolutionFile(uri?: vscode.Uri, target?: IJavaSolutionTarget): Promise<IPreparedSolutionFile | undefined> {
    const originalUri: vscode.Uri | undefined = uri || vscode.window.activeTextEditor?.document.uri;
    const filePath: string | undefined = await getActiveFilePath(uri);
    if (!filePath) return undefined;
    const document: vscode.TextDocument | undefined = originalUri ? await vscode.workspace.openTextDocument(originalUri) : undefined;
    if (!document || path.extname(document.uri.fsPath).toLowerCase() !== ".java") {
        return { filePath, dispose: async () => undefined };
    }
    const content: string = document.getText();
    if (!target && !/@lc\s+app=\S+\s+id=\S+\s+lang=java\b/.test(content)) {
        return { filePath, dispose: async () => undefined };
    }
    const solutions: IJavaSolutionTarget[] = findJavaSolutions(content);
    if (!target && solutions.length === 0) return { filePath, dispose: async () => undefined };
    if (!target && solutions.length > 1) {
        const pick = await vscode.window.showQuickPick(solutions.map((solution) => ({
            label: solution.name,
            description: `第 ${document.positionAt(solution.start).line + 1} 行`,
            solution,
        })), { placeHolder: "请选择要提交或运行测试的 Java 解法" });
        if (!pick) return undefined;
        target = pick.solution;
    }
    const code: string = buildJavaSubmission(content, target || solutions[0]);
    const directory: string = await fse.mkdtemp(path.join(os.tmpdir(), "leetcode-cn-"));
    try {
        const temporaryPath: string = path.join(directory, path.basename(document.uri.fsPath));
        await fse.writeFile(temporaryPath, code, "utf8");
        return {
            filePath: wsl.useWsl() ? await wsl.toWslPath(temporaryPath) : temporaryPath,
            dispose: () => fse.remove(directory),
        };
    } catch (error) {
        await fse.remove(directory);
        throw error;
    }
}
