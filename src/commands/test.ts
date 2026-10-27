// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import * as fse from "fs-extra";
import * as vscode from "vscode";
import { leetCodeExecutor } from "../leetCodeExecutor";
import { leetCodeManager } from "../leetCodeManager";
import { IQuickItemEx, UserStatus } from "../shared";
import { isWindows, usingCmd } from "../utils/osUtils";
import { DialogType, promptForOpenOutputChannel, showFileSelectDialog } from "../utils/uiUtils";
import { getActiveFilePath } from "../utils/workspaceUtils";
import * as wsl from "../utils/wslUtils";
import { leetCodeSubmissionProvider } from "../webview/leetCodeSubmissionProvider";

export async function testSolution(uri?: vscode.Uri): Promise<void> {
    try {
        if (leetCodeManager.getStatus() === UserStatus.SignedOut) {
            return;
        }

        const filePath: string | undefined = await getActiveFilePath(uri);
        if (!filePath) {
            return;
        }
        const picks: Array<IQuickItemEx<string>> = [];
        picks.push(
            {
                label: "$(three-bars) 默认测试用例",
                description: "",
                detail: "使用题目自带的测试用例",
                value: ":default",
            },
            {
                label: "$(pencil) 输入测试用例…",
                description: "",
                detail: "在输入框中填写自定义测试用例",
                value: ":direct",
            },
            {
                label: "$(file-text) 从文件读取…",
                description: "",
                detail: "使用文件中的测试用例",
                value: ":file",
            },
        );
        const choice: IQuickItemEx<string> | undefined = await vscode.window.showQuickPick(picks);
        if (!choice) {
            return;
        }

        let result: string | undefined;
        switch (choice.value) {
            case ":default":
                result = await leetCodeExecutor.testSolution(filePath);
                break;
            case ":direct":
                const testString: string | undefined = await vscode.window.showInputBox({
                    prompt: "请输入测试用例，多个参数之间使用 \\n 分隔。",
                    validateInput: (s: string): string | undefined => s && s.trim() ? undefined : "测试用例不能为空。",
                    placeHolder: "例如：[1,2,3]\\n4",
                    ignoreFocusOut: true,
                });
                if (testString) {
                    result = await leetCodeExecutor.testSolution(filePath, parseTestString(testString));
                }
                break;
            case ":file":
                const testFile: vscode.Uri[] | undefined = await showFileSelectDialog(filePath);
                if (testFile && testFile.length) {
                    const input: string = (await fse.readFile(testFile[0].fsPath, "utf-8")).trim();
                    if (input) {
                        result = await leetCodeExecutor.testSolution(filePath, parseTestString(input.replace(/\r?\n/g, "\\n")));
                    } else {
                        vscode.window.showErrorMessage("所选测试文件不能为空。");
                    }
                }
                break;
            default:
                break;
        }
        if (!result) {
            return;
        }
        leetCodeSubmissionProvider.show(result);
    } catch (error) {
        await promptForOpenOutputChannel("测试失败：请打开输出面板查看详情。", DialogType.error);
    }
}

function parseTestString(test: string): string {
    if (wsl.useWsl() || !isWindows()) {
        return `'${test}'`;
    }

    // In windows and not using WSL
    if (usingCmd()) {
        return `"${test.replace(/"/g, '\\"')}"`;
    } else {
        // Assume using PowerShell
        return `'${test.replace(/"/g, '\\"')}'`;
    }
}
