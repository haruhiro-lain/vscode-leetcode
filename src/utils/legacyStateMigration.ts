import * as cp from "child_process";
import * as fse from "fs-extra";
import * as path from "path";
import { ExtensionContext } from "vscode";
import { extensionId, legacyExtensionId, legacyMigrationKey } from "./extensionIdentity";

const handoffName: string = "legacy-login-migration.json";

async function removeHandoff(file: string): Promise<void> {
    try {
        await fse.unlink(file);
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }
}

export async function importLegacyState(context: ExtensionContext): Promise<number> {
    const handoff: string = path.join(context.globalStorageUri.fsPath, handoffName);
    if (context.globalState.get<boolean>(legacyMigrationKey)) {
        await removeHandoff(handoff);
        return 0;
    }
    if (!await fse.pathExists(handoff)) return 0;
    const payload = await fse.readJson(handoff);
    if (payload.schemaVersion !== 1 || payload.sourceId !== legacyExtensionId || payload.targetId !== extensionId ||
        !payload.state || typeof payload.state !== "object" || Array.isArray(payload.state)) {
        throw new Error("旧插件登录迁移文件无效，请重新运行安装脚本。");
    }
    const state = payload.state;
    const hasNewLogin: boolean = context.globalState.get("leetcode-cookie") !== undefined || context.globalState.get("leetcode-user-status") !== undefined;
    let count: number = 0;
    if (!hasNewLogin) {
        const cookie = state["leetcode-cookie"];
        const user = state["leetcode-user-status"];
        if (typeof cookie === "string" && cookie.trim()) {
            await context.globalState.update("leetcode-cookie", cookie);
            count++;
        }
        if (user && typeof user === "object" && typeof user.username === "string" && typeof user.isSignedIn === "boolean") {
            await context.globalState.update("leetcode-user-status", {
                isSignedIn: user.isSignedIn, isPremium: user.isPremium === true,
                username: user.username, avatar: typeof user.avatar === "string" ? user.avatar : "",
                ...(typeof user.isVerified === "boolean" ? { isVerified: user.isVerified } : {}),
            });
            count++;
        }
    }
    if (context.globalState.get("leetcode.hasInited") === undefined && typeof state["leetcode.hasInited"] === "boolean") {
        await context.globalState.update("leetcode.hasInited", state["leetcode.hasInited"]);
        count++;
    }
    await context.globalState.update(legacyMigrationKey, true);
    await removeHandoff(handoff);
    return count;
}

export async function migrateLegacyState(context: ExtensionContext, nodeCommand: string): Promise<number> {
    if (!context.globalState.get<boolean>(legacyMigrationKey) &&
        !await fse.pathExists(path.join(context.globalStorageUri.fsPath, handoffName))) {
        const script: string = context.asAbsolutePath(path.join("scripts", "migrate-legacy-state.cjs"));
        await new Promise<void>((resolve, reject) => {
            cp.execFile(nodeCommand, [script, "--storage-root", path.dirname(context.globalStorageUri.fsPath)],
                { windowsHide: true, timeout: 15000, maxBuffer: 65536 }, (error) => {
                    if (error) reject(new Error("未能迁移旧插件登录状态，请使用 Node.js 22.13 或更高版本重新运行安装脚本。"));
                    else resolve();
                });
        });
    }
    const imported: number = await importLegacyState(context);
    if (!context.globalState.get<boolean>(legacyMigrationKey)) await context.globalState.update(legacyMigrationKey, true);
    return imported;
}
