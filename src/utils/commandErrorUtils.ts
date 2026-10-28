import * as vscode from "vscode";
import { leetCodeChannel } from "../leetCodeChannel";
import { leetCodeManager } from "../leetCodeManager";
import { isAuthenticationError } from "./commandResultUtils";
import { DialogOptions, DialogType, promptForOpenOutputChannel } from "./uiUtils";

let authenticationPrompt: Promise<void> | undefined;

async function promptToReauthenticate(): Promise<void> {
    const signIn: vscode.MessageItem = { title: "重新登录" };
    const choice: vscode.MessageItem | undefined = await vscode.window.showWarningMessage(
        "力扣登录已过期，请重新登录后重试。", signIn, DialogOptions.no);
    if (choice === signIn) await vscode.commands.executeCommand("leetcode.signin");
}

export async function handleCommandError(error: any, operation: string): Promise<void> {
    leetCodeChannel.appendLine(String(error));
    if (!isAuthenticationError(error)) {
        await promptForOpenOutputChannel(`${operation}：${error.message || error}`, DialogType.error);
        return;
    }
    if (authenticationPrompt) return authenticationPrompt;
    authenticationPrompt = (async () => {
        const status = await leetCodeManager.confirmSessionExpired(error.sessionRevision);
        if (status === "expired") {
            await promptToReauthenticate();
        } else if (status === "valid") {
            await vscode.window.showWarningMessage("力扣账号仍处于登录状态，已同步本地凭据，请重试刚才的操作。");
        } else if (status === "unknown") {
            await vscode.window.showWarningMessage("暂时无法验证力扣登录状态，可能遇到网络故障或网站验证。已保留登录信息，请稍后重试。");
        }
    })();
    try {
        await authenticationPrompt;
    } finally {
        authenticationPrompt = undefined;
    }
}
