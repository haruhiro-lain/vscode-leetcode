// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";
import { leetCodeTreeDataProvider } from "../explorer/LeetCodeTreeDataProvider";
import { leetCodeExecutor } from "../leetCodeExecutor";
import { leetCodeManager } from "../leetCodeManager";
import { promptForSignIn } from "../utils/uiUtils";
import { IJavaSolutionTarget } from "../utils/javaSolutionUtils";
import { IPreparedSolutionFile, prepareSolutionFile } from "../utils/solutionFileUtils";
import { handleCommandError } from "../utils/commandErrorUtils";
import { leetCodeSubmissionProvider } from "../webview/leetCodeSubmissionProvider";

export async function submitSolution(uri?: vscode.Uri, target?: IJavaSolutionTarget): Promise<void> {
    if (!leetCodeManager.getUser()) {
        promptForSignIn();
        return;
    }

    let prepared: IPreparedSolutionFile | undefined;
    try {
        prepared = await prepareSolutionFile(uri, target);
        if (!prepared) return;
        const result: string = await leetCodeExecutor.submitSolution(prepared.filePath);
        leetCodeSubmissionProvider.show(result);
    } catch (error) {
        await handleCommandError(error, "提交失败");
        return;
    } finally {
        if (prepared) await prepared.dispose();
    }

    leetCodeTreeDataProvider.refresh();
}
