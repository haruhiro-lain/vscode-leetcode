// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import * as cp from "child_process";
import { EventEmitter } from "events";
import * as path from "path";
import * as vscode from "vscode";
import { leetCodeChannel } from "./leetCodeChannel";
import { leetCodeExecutor } from "./leetCodeExecutor";
import { Endpoint, IQuickItemEx, urls, urlsCn, UserStatus } from "./shared";
import { createEnvOption } from "./utils/cpUtils";
import { DialogType, openUrl, promptForOpenOutputChannel } from "./utils/uiUtils";
import * as wsl from "./utils/wslUtils";
import { getLeetCodeEndpoint } from "./commands/plugin";
import { globalState, UserDataType } from "./globalState";
import { queryUserData } from "./request/query-user-data";
import { parseQuery } from "./utils/toolUtils";
import { isOwnLoginCallback } from "./utils/extensionIdentity";
import { getSessionRevision } from "./utils/sessionRevision";

class LeetCodeManager extends EventEmitter {
    private currentUser: string | undefined;
    private userStatus: UserStatus;
    private loginTask: Promise<void> = Promise.resolve();
    private cliWriteTask: Promise<void> = Promise.resolve();
    private loginAttempt = 0;
    private pendingLogins = 0;
    private verificationTask: Promise<"expired" | "valid" | "unknown" | "stale"> | undefined;

    constructor() {
        super();
        this.currentUser = undefined;
        this.userStatus = UserStatus.SignedOut;
        this.handleUriSignIn = this.handleUriSignIn.bind(this);
    }

    public async getLoginStatus(): Promise<void> {
        const revision = getSessionRevision();
        const attempt = this.loginAttempt;
        try {
            const { cookie, data } = await this.queryStoredSession();
            if (!cookie) return;
            if (!data) return;
            if (!this.isCurrentSession(revision, attempt)) return;
            if (!data.isSignedIn) {
                this.invalidateSession();
                return;
            }
            await this.setCookieToCli(cookie, data.username, data.isPremium);
            if (!this.isCurrentSession(revision, attempt)) return;
            await globalState.setCookie(cookie);
            await globalState.setUserStatus(data);
            this.setSignedIn(data.username);
        } catch (_) {
            if (!this.isCurrentSession(revision, attempt)) return;
            // A challenge page, timeout or transport failure is not a logout.
            const cached = globalState.getUserStatus();
            if (cached?.isSignedIn && cached.username) this.setSignedIn(cached.username);
            leetCodeChannel.appendLine("暂时无法验证登录状态，已保留本地凭据；网络恢复后将再次验证。");
        } finally {
            this.emit("statusChanged");
        }
    }

    private async updateUserStatusWithCookie(cookie: string): Promise<void> {
        const attempt = ++this.loginAttempt;
        this.pendingLogins++;
        const task = this.loginTask.then(async () => {
            if (attempt !== this.loginAttempt) return;
            const revision = getSessionRevision();
            if (!/(?:^|;\s*)LEETCODE_SESSION=[^;]+/.test(cookie) ||
                !/(?:^|;\s*)csrftoken=[^;]+/.test(cookie) || /[\r\n]/.test(cookie)) {
                throw new Error("授权信息缺少完整的会话 Cookie，请重新进行网页授权。");
            }
            const data = await queryUserData(cookie);
            if (!this.isCurrentSession(revision, attempt)) return;
            if (!data.isSignedIn || !data.username) throw new Error("力扣确认此授权未登录，请重新进行网页授权。");
            // GraphQL is the source of truth. Do not repeat the CLI's obsolete
            // profile/favorite requests or parse interactive prompt chunks.
            await this.setCookieToCli(cookie, data.username, data.isPremium);
            if (!this.isCurrentSession(revision, attempt)) return;
            await globalState.setCookie(cookie);
            await globalState.setUserStatus(data);
            this.setSignedIn(data.username);
            this.emit("statusChanged");
            vscode.window.showInformationMessage(`已登录：${data.username}。`);
        });
        this.loginTask = task.catch(() => undefined);
        try { await task; } finally { this.pendingLogins--; }
    }

    private setSignedIn(username: string): void {
        this.currentUser = username;
        this.userStatus = UserStatus.SignedIn;
    }

    private isCurrentSession(revision: number, attempt: number): boolean {
        return revision === getSessionRevision() && attempt === this.loginAttempt;
    }

    public async confirmSessionExpired(commandRevision?: number): Promise<"expired" | "valid" | "unknown" | "stale"> {
        if (this.pendingLogins) return "stale";
        if (commandRevision !== undefined && commandRevision !== getSessionRevision()) return "stale";
        if (this.verificationTask) return this.verificationTask;
        this.verificationTask = this.verifySession();
        try { return await this.verificationTask; } finally { this.verificationTask = undefined; }
    }

    private async verifySession(): Promise<"expired" | "valid" | "unknown" | "stale"> {
        const revision = getSessionRevision();
        const attempt = this.loginAttempt;
        try {
            const { cookie, data } = await this.queryStoredSession();
            if (!this.isCurrentSession(revision, attempt)) return "stale";
            if (!cookie) {
                this.invalidateSession();
                return "expired";
            }
            if (!data) return "unknown";
            if (!data.isSignedIn) {
                this.invalidateSession();
                return "expired";
            }
            await this.setCookieToCli(cookie, data.username, data.isPremium);
            if (!this.isCurrentSession(revision, attempt)) return "stale";
            await globalState.setCookie(cookie);
            await globalState.setUserStatus(data);
            this.setSignedIn(data.username);
            // No statusChanged event here: a failed list refresh must not
            // recursively trigger another identical failing list request.
            return "valid";
        } catch (_) {
            return this.isCurrentSession(revision, attempt) ? "unknown" : "stale";
        }
    }

    private async queryStoredSession(): Promise<{ cookie?: string; data?: UserDataType }> {
        const cookie = globalState.getCookie();
        let data: UserDataType | undefined;
        let uncertain = false;
        if (cookie) {
            try {
                data = await queryUserData(cookie);
                if (data.isSignedIn) return { cookie, data };
            } catch (_) { uncertain = true; }
        }
        let cliCookie: string | undefined;
        try { cliCookie = (await this.runCliSession("read")).cookie; } catch (_) { uncertain = true; }
        if (cliCookie && cliCookie !== cookie) {
            try {
                const cliData = await queryUserData(cliCookie);
                if (cliData.isSignedIn) return { cookie: cliCookie, data: cliData };
                data = cliData;
            } catch (_) { uncertain = true; }
        }
        if (uncertain) throw new Error("暂时无法确认已有会话是否有效。");
        return { cookie: cookie || cliCookie, data };
    }

    private async showLoginError(error: any): Promise<void> {
        // Axios errors contain request headers; never log the raw error.
        const status = error?.response?.status;
        const message = status === 403
            ? "力扣返回了网站验证或访问限制，无法确认登录状态。已保留原登录信息，请稍后重试网页授权。"
            : status || error?.isAxiosError
                ? "暂时无法连接力扣验证授权，已保留原登录信息，请稍后重试。"
                : error?.message || "登录状态同步未完成，请重试授权。";
        leetCodeChannel.appendLine(message);
        await promptForOpenOutputChannel(message, DialogType.error);
    }

    public async handleUriSignIn(uri: vscode.Uri): Promise<void> {
        if (!isOwnLoginCallback(uri.authority)) {
            await promptForOpenOutputChannel("登录回调未指向 LeetCode-CN，请从当前插件重新发起登录。", DialogType.error);
            return;
        }
        try {
            await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress: vscode.Progress<{}>) => {
                progress.report({ message: "正在获取用户信息…" });
                const queryParams = parseQuery(uri.query);
                const cookie = queryParams["cookie"];
                if (!cookie) {
                    promptForOpenOutputChannel(`未能获取 Cookie，请重新登录。`, DialogType.error);
                    return;
                }

                await this.updateUserStatusWithCookie(cookie)

            });
        } catch (error) {
            await this.showLoginError(error);
        }
    }

    public async handleInputCookieSignIn(): Promise<void> {
        const cookie: string | undefined = await vscode.window.showInputBox({
            prompt: '请输入从 LeetCode 网站复制的 Cookie',
            password: true,
            ignoreFocusOut: true,
            validateInput: (s: string): string | undefined =>
                s ? undefined : 'Cookie 不能为空',
        })

        if (cookie) await this.updateUserStatusWithCookie(cookie);
    }

    public async signIn(): Promise<void> {
        const picks: Array<IQuickItemEx<string>> = []
        picks.push(
            {
                label: '网页授权登录',
                detail: '在浏览器中完成 LeetCode 网站授权',
                value: 'WebAuth',
                description: '推荐'
            },
            {
                label: '使用 Cookie 登录',
                detail: '使用从浏览器复制的 LeetCode Cookie 登录',
                value: 'Cookie',
            }
        )

        const choice: IQuickItemEx<string> | undefined = await vscode.window.showQuickPick(picks)
        if (!choice) {
            return
        }
        const loginMethod: string = choice.value

        if (loginMethod === 'WebAuth') {
            openUrl(this.getAuthLoginUrl())
            return
        }

        try {
            await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "正在获取用户信息…" }, async () => {
                await this.handleInputCookieSignIn()
            });
        } catch (error) {
            await this.showLoginError(error);
        }
    }

    public async signOut(): Promise<void> {
        this.invalidateSession();
        try {
            await this.loginTask;
            await this.cliWriteTask;
            await leetCodeExecutor.signOut();
            vscode.window.showInformationMessage("已退出登录。");
        } catch (error) {
            // swallow the error when sign out.
        }
    }

    public getStatus(): UserStatus {
        return this.userStatus;
    }

    public invalidateSession(): void {
        this.loginAttempt++;
        this.currentUser = undefined;
        this.userStatus = UserStatus.SignedOut;
        globalState.removeAll();
        this.emit("statusChanged");
    }

    public getUser(): string | undefined {
        return this.currentUser;
    }

    public getAuthLoginUrl(): string {
        switch (getLeetCodeEndpoint()) {
            case Endpoint.LeetCodeCN:
                return urlsCn.authLoginUrl;
            case Endpoint.LeetCode:
            default:
                return urls.authLoginUrl;
        }
    }

    public async setCookieToCli(cookie: string, name: string, paid: boolean = false): Promise<void> {
        const revision = getSessionRevision();
        const attempt = this.loginAttempt;
        const task = this.cliWriteTask.then(async () => {
            if (this.isCurrentSession(revision, attempt)) await this.runCliSession("write", { cookie, name, paid });
        });
        this.cliWriteTask = task.catch(() => undefined);
        return task;
    }

    private async runCliSession(operation: string, input?: {}): Promise<{ cookie?: string }> {
        let helper = `"${path.join(__dirname, "..", "..", "scripts", "cli-session.cjs")}"`;
        if (wsl.useWsl()) helper = await wsl.toWslPath(helper);
        return new Promise((resolve, reject) => {
            const args = [leetCodeExecutor.node, helper, operation, getLeetCodeEndpoint()];
            const child = wsl.useWsl() ? cp.spawn("wsl", args, { shell: true, windowsHide: true })
                : cp.spawn(args[0], args.slice(1), { shell: true, windowsHide: true, env: createEnvOption() });
            let output = "";
            const timer = setTimeout(() => {
                child.kill();
                reject(new Error("本地登录状态同步超时，请重试授权。"));
            }, 15000);
            child.stdout?.on("data", (data: Buffer) => { output += data.toString(); });
            child.stderr?.on("data", () => { /* Never log credential-bearing output. */ });
            child.stdin?.on("error", () => { /* close/error settles the request. */ });
            child.on("error", () => {
                clearTimeout(timer);
                reject(new Error("无法启动本地登录同步，请检查 Node.js 配置。"));
            });
            child.on("close", (code) => {
                clearTimeout(timer);
                if (code !== 0) return reject(new Error("本地登录状态同步失败，请重试授权。"));
                try { resolve(JSON.parse(output)); } catch (_) { reject(new Error("本地登录状态同步结果无效，请重试授权。")); }
            });
            child.stdin?.end(input ? JSON.stringify(input) : "");
        });
    }
}

export const leetCodeManager: LeetCodeManager = new LeetCodeManager();
