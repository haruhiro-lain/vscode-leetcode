// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";
import { leetCodeExecutor } from "../leetCodeExecutor";
import { leetCodeManager } from "../leetCodeManager";
import { IQuickItemEx } from "../shared";
import { DialogOptions, DialogType, promptForOpenOutputChannel, promptForSignIn } from "../utils/uiUtils";

export async function getSessionList(): Promise<ISession[]> {
    const signInStatus: string | undefined = leetCodeManager.getUser();
    if (!signInStatus) {
        promptForSignIn();
        return [];
    }
    const result: string = await leetCodeExecutor.listSessions();
    const lines: string[] = result.split("\n");
    const sessions: ISession[] = [];
    const reg: RegExp = /(.?)\s*(\d+)\s+(.*)\s+(\d+ \(\s*\d+\.\d+ %\))\s+(\d+ \(\s*\d+\.\d+ %\))/;
    for (const line of lines) {
        const match: RegExpMatchArray | null = line.match(reg);
        if (match && match.length === 6) {
            sessions.push({
                active: !!(match[1].trim()),
                id: match[2].trim(),
                name: match[3].trim(),
                acQuestions: match[4].trim(),
                acSubmits: match[5].trim(),
            });
        }
    }
    return sessions;
}

export async function manageSessions(): Promise<void> {
    const choice: IQuickItemEx<ISession | string> | undefined = await vscode.window.showQuickPick(parseSessionsToPicks(true /* includeOperation */));
    if (!choice || choice.description === "当前使用") {
        return;
    }
    if (choice.value === ":createSession") {
        await createSession();
        return;
    }
    if (choice.value === ":deleteSession") {
        await deleteSession();
        return;
    }
    try {
        await leetCodeExecutor.enableSession((choice.value as ISession).id);
        vscode.window.showInformationMessage(`已切换至会话「${choice.label}」。`);
        await vscode.commands.executeCommand("leetcode.refreshExplorer");
    } catch (error) {
        await promptForOpenOutputChannel("切换会话失败，请打开输出面板查看详情。", DialogType.error);
    }
}

async function parseSessionsToPicks(includeOperations: boolean = false): Promise<Array<IQuickItemEx<ISession | string>>> {
    return new Promise(async (resolve: (res: Array<IQuickItemEx<ISession | string>>) => void): Promise<void> => {
        try {
            const sessions: ISession[] = await getSessionList();
            const picks: Array<IQuickItemEx<ISession | string>> = sessions.map((s: ISession) => Object.assign({}, {
                label: `${s.active ? "$(check) " : ""}${s.name}`,
                description: s.active ? "当前使用" : "",
                detail: `已通过题目：${s.acQuestions}，通过提交：${s.acSubmits}`,
                value: s,
            }));

            if (includeOperations) {
                picks.push(...parseSessionManagementOperations());
            }
            resolve(picks);
        } catch (error) {
            return await promptForOpenOutputChannel("获取会话列表失败，请打开输出面板查看详情。", DialogType.error);
        }
    });
}

function parseSessionManagementOperations(): Array<IQuickItemEx<string>> {
    return [{
        label: "$(plus) 创建刷题会话",
        description: "",
        detail: "创建独立的刷题记录",
        value: ":createSession",
    }, {
        label: "$(trashcan) 删除刷题会话",
        description: "",
        detail: "删除指定的刷题记录",
        value: ":deleteSession",
    }];
}

async function createSession(): Promise<void> {
    const session: string | undefined = await vscode.window.showInputBox({
        prompt: "请输入新会话的名称。",
        validateInput: (s: string): string | undefined => s && s.trim() ? undefined : "会话名称不能为空",
    });
    if (!session) {
        return;
    }
    try {
        await leetCodeExecutor.createSession(session);
        vscode.window.showInformationMessage("会话已创建，可点击状态栏切换。");
    } catch (error) {
        await promptForOpenOutputChannel("创建会话失败，请打开输出面板查看详情。", DialogType.error);
    }
}

async function deleteSession(): Promise<void> {
    const choice: IQuickItemEx<ISession | string> | undefined = await vscode.window.showQuickPick(
        parseSessionsToPicks(false /* includeOperation */),
        { placeHolder: "请选择要删除的刷题会话" },
    );
    if (!choice) {
        return;
    }

    const selectedSession: ISession = choice.value as ISession;
    if (selectedSession.active) {
        vscode.window.showInformationMessage("不能删除正在使用的会话。");
        return;
    }

    const action: vscode.MessageItem | undefined = await vscode.window.showWarningMessage(
        `此操作无法撤销，确定删除会话「${selectedSession.name}」吗？`,
        DialogOptions.yes,
        DialogOptions.no,
    );
    if (action !== DialogOptions.yes) {
        return;
    }

    const confirm: string | undefined = await vscode.window.showInputBox({
        prompt: "请输入 yes 确认删除会话",
        validateInput: (value: string): string => {
            if (value === "yes") {
                return "";
            } else {
                return "请输入 yes 进行确认";
            }
        },
    });

    if (confirm === "yes") {
        await leetCodeExecutor.deleteSession(selectedSession.id);
        vscode.window.showInformationMessage("会话已删除。");
    }
}

export interface ISession {
    active: boolean;
    id: string;
    name: string;
    acQuestions: string;
    acSubmits: string;
}
