// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import * as cp from "child_process";
import * as vscode from "vscode";
import { leetCodeChannel } from "../leetCodeChannel";
import { commandResultError } from "./commandResultUtils";
import { getSessionRevision } from "./sessionRevision";
import { createNetworkEnvironment } from "./networkUtils";

export async function executeCommand(command: string, args: string[], options: cp.SpawnOptions = { shell: true }): Promise<string> {
    const sessionRevision = getSessionRevision();
    return new Promise((resolve: (res: string) => void, reject: (e: Error) => void): void => {
        let result: string = "";
        let stderr: string = "";

        const childProc: cp.ChildProcess = cp.spawn(command, args, { ...options, env: createEnvOption() });

        childProc.stdout?.on("data", (data: string | Buffer) => {
            data = data.toString();
            result = result.concat(data);
            leetCodeChannel.append(data);
        });

        childProc.stderr?.on("data", (data: string | Buffer) => {
            stderr += data.toString();
            leetCodeChannel.append(data.toString());
        });

        childProc.on("error", reject);

        childProc.on("close", (code: number | null) => {
            const error = commandResultError(code, result, stderr);
            if (error) {
                error.sessionRevision = sessionRevision;
                reject(error);
            } else {
                resolve(result);
            }
        });
    });
}

export async function executeCommandWithProgress(message: string, command: string, args: string[], options: cp.SpawnOptions = { shell: true }): Promise<string> {
    let result: string = "";
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (p: vscode.Progress<{}>) => {
        return new Promise<void>(async (resolve: () => void, reject: (e: Error) => void): Promise<void> => {
            p.report({ message });
            try {
                result = await executeCommand(command, args, options);
                resolve();
            } catch (e) {
                reject(e);
            }
        });
    });
    return result;
}

// Apply the same per-site routing as the extension's HTTP requests.
export function createEnvOption(): {} {
    return createNetworkEnvironment();
}
