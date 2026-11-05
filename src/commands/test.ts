// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";
import { leetCodeExecutor } from "../leetCodeExecutor";
import { leetCodeManager } from "../leetCodeManager";
import { IQuickItemEx, UserStatus } from "../shared";
import { isWindows, usingCmd } from "../utils/osUtils";
import { promptForSignIn } from "../utils/uiUtils";
import { IJavaSolutionTarget } from "../utils/javaSolutionUtils";
import { IPreparedSolutionFile, prepareSolutionFile } from "../utils/solutionFileUtils";
import { handleCommandError } from "../utils/commandErrorUtils";
import { runLocalJavaTests } from "../utils/localJavaTests";
import * as wsl from "../utils/wslUtils";
import { leetCodeSubmissionProvider } from "../webview/leetCodeSubmissionProvider";

export async function testSolution(uri?: vscode.Uri, target?: IJavaSolutionTarget): Promise<void> {
    let prepared: IPreparedSolutionFile | undefined;
    let local: boolean = false;
    try {
        const picks: Array<IQuickItemEx<string>> = [
            { label: "$(file-text) 从文件读取…", description: "本地运行", detail: "读取 .vscode/LeetCode-CN 中对应路径的 txt 输入和期望输出，本地编译并在终端显示结果", value: ":file" },
            { label: "$(three-bars) 默认测试用例", description: "力扣在线", detail: "使用题目自带的测试用例", value: ":default" },
            { label: "$(pencil) 输入测试用例…", description: "力扣在线", detail: "在输入框中填写自定义测试用例", value: ":direct" },
        ];
        const choice = await vscode.window.showQuickPick(picks);
        if (!choice) return;
        if (choice.value === ":file") {
            local = true;
            await runLocalJavaTests(uri, target);
            return;
        }
        if (leetCodeManager.getStatus() === UserStatus.SignedOut) {
            await promptForSignIn();
            return;
        }
        prepared = await prepareSolutionFile(uri, target);
        if (!prepared) return;
        let result: string | undefined;
        if (choice.value === ":default") {
            result = await leetCodeExecutor.testSolution(prepared.filePath);
        } else if (choice.value === ":direct") {
            const testString = await vscode.window.showInputBox({
                prompt: "请输入测试用例，多个参数之间使用 \\n 分隔。",
                validateInput: (s: string): string | undefined => s && s.trim() ? undefined : "测试用例不能为空。",
                placeHolder: "例如：[1,2,3]\\n4", ignoreFocusOut: true,
            });
            if (testString) result = await leetCodeExecutor.testSolution(prepared.filePath, parseTestString(testString));
        }
        if (result) leetCodeSubmissionProvider.show(result);
    } catch (error) {
        if (local) vscode.window.showErrorMessage(`本地测试失败：${error.message}`);
        else await handleCommandError(error, "测试失败");
    } finally {
        if (prepared) await prepared.dispose();
    }
}

function parseTestString(test: string): string {
    if (wsl.useWsl() || !isWindows()) return `'${test}'`;
    if (usingCmd()) return `"${test.replace(/"/g, '\\"')}"`;
    return `'${test.replace(/"/g, '\\"')}'`;
}
