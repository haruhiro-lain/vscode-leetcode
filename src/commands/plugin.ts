// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import { localizeLabel } from "../utils/labelUtils";
import * as vscode from "vscode";
import { leetCodeTreeDataProvider } from "../explorer/LeetCodeTreeDataProvider";
import { leetCodeExecutor } from "../leetCodeExecutor";
import { IQuickItemEx } from "../shared";
import { Endpoint, SortingStrategy } from "../shared";
import { DialogType, promptForOpenOutputChannel, promptForSignIn } from "../utils/uiUtils";
import { deleteCache } from "./cache";

export async function switchEndpoint(): Promise<void> {
    const isCnEnabled: boolean = getLeetCodeEndpoint() === Endpoint.LeetCodeCN;
    const picks: Array<IQuickItemEx<string>> = [];
    picks.push(
        {
            label: `${isCnEnabled ? "" : "$(check) "}LeetCode`,
            description: "leetcode.com",
            detail: `使用 LeetCode 国际站`,
            value: Endpoint.LeetCode,
        },
        {
            label: `${isCnEnabled ? "$(check) " : ""}力扣`,
            description: "leetcode.cn",
            detail: `启用中国版 LeetCode`,
            value: Endpoint.LeetCodeCN,
        },
    );
    const choice: IQuickItemEx<string> | undefined = await vscode.window.showQuickPick(picks);
    if (!choice || choice.value === getLeetCodeEndpoint()) {
        return;
    }
    const leetCodeConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("leetcode");
    try {
        const endpoint: string = choice.value;
        await leetCodeExecutor.switchEndpoint(endpoint);
        await leetCodeConfig.update("endpoint", endpoint, true /* UserSetting */);
        vscode.window.showInformationMessage(`已切换站点：${endpoint}`);
    } catch (error) {
        await promptForOpenOutputChannel("切换站点失败，请打开输出面板查看详情。", DialogType.error);
    }

    try {
        await vscode.commands.executeCommand("leetcode.signout");
        await deleteCache();
        await promptForSignIn();
    } catch (error) {
        await promptForOpenOutputChannel("登录失败，请打开输出面板查看详情。", DialogType.error);
    }
}

export function getLeetCodeEndpoint(): string {
    const leetCodeConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("leetcode");
    return leetCodeConfig.get<string>("endpoint", Endpoint.LeetCode);
}

const SORT_ORDER: SortingStrategy[] = [
    SortingStrategy.None,
    SortingStrategy.AcceptanceRateAsc,
    SortingStrategy.AcceptanceRateDesc,
];

export async function switchSortingStrategy(): Promise<void> {
    const currentStrategy: SortingStrategy = getSortingStrategy();
    const picks: Array<IQuickItemEx<string>> = [];
    picks.push(
        ...SORT_ORDER.map((s: SortingStrategy) => {
            return {
                label: `${currentStrategy === s ? "$(check)" : "    "} ${localizeLabel(s)}`,
                value: s,
            };
        }),
    );

    const choice: IQuickItemEx<string> | undefined = await vscode.window.showQuickPick(picks);
    if (!choice || choice.value === currentStrategy) {
        return;
    }

    const leetCodeConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("leetcode");
    await leetCodeConfig.update("problems.sortStrategy", choice.value, true);
    await leetCodeTreeDataProvider.refresh();
}

export function getSortingStrategy(): SortingStrategy {
    const leetCodeConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("leetcode");
    return leetCodeConfig.get<SortingStrategy>("problems.sortStrategy", SortingStrategy.None);
}
