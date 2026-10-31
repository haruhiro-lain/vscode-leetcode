// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";
import { explorerNodeManager } from "../explorer/explorerNodeManager";
import { LeetCodeNode } from "../explorer/LeetCodeNode";
import { getEditorShortcuts } from "../utils/settingUtils";
import { findJavaSolutions } from "../utils/javaSolutionUtils";
import { studyPlanManager } from "../studyPlans/studyPlanManager";

export class CustomCodeLensProvider implements vscode.CodeLensProvider {

    private onDidChangeCodeLensesEmitter: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();

    get onDidChangeCodeLenses(): vscode.Event<void> {
        return this.onDidChangeCodeLensesEmitter.event;
    }

    public refresh(): void {
        this.onDidChangeCodeLensesEmitter.fire();
    }

    public provideCodeLenses(document: vscode.TextDocument): vscode.ProviderResult<vscode.CodeLens[]> {
        const shortcuts: string[] = getEditorShortcuts();
        if (!shortcuts) {
            return;
        }

        const content: string = document.getText();
        const matchResult: RegExpMatchArray | null = content.match(/@lc app=.* id=(.*) lang=.*/);
        if (!matchResult) {
            if (shortcuts.indexOf("description") < 0 || !["java", "markdown"].includes(document.languageId) ||
                !studyPlanManager.getLocalProblems(document.uri.fsPath).length) return undefined;
            const localSolutions = document.languageId === "java" ? findJavaSolutions(content) : [];
            // VS Code renders CodeLens above its anchor and aligns it with that line's first non-whitespace character.
            const line = localSolutions.length ? document.positionAt(localSolutions[0].start).line : 0;
            return [new vscode.CodeLens(new vscode.Range(line, 0, line, 0), {
                title: "题目描述",
                command: "leetcode.previewLocalMarkdown",
                arguments: [document.uri, true],
            })];
        }
        const nodeId: string | undefined = matchResult[1];
        let node: LeetCodeNode | undefined;
        if (nodeId) {
            node = explorerNodeManager.getNodeById(nodeId);
        }

        let codeLensLine: number = document.lineCount - 1;
        for (let i: number = document.lineCount - 1; i >= 0; i--) {
            const lineContent: string = document.lineAt(i).text;
            if (lineContent.indexOf("@lc code=end") >= 0) {
                codeLensLine = i;
                break;
            }
        }

        const range: vscode.Range = new vscode.Range(codeLensLine, 0, codeLensLine, 0);
        const codeLens: vscode.CodeLens[] = [];

        const solutions = document.languageId === "java" ? findJavaSolutions(content) : [];
        if (shortcuts.indexOf("description") >= 0) {
            const descriptionLine: number = solutions.length > 0 ? Math.max(0, document.positionAt(solutions[0].start).line - 1) : 0;
            codeLens.push(new vscode.CodeLens(new vscode.Range(descriptionLine, 0, descriptionLine, 0), {
                title: "题目描述",
                command: "leetcode.previewProblem",
                arguments: [document.uri],
            }));
        }
        for (const solution of solutions) {
            const position = document.positionAt(solution.start);
            const classRange = new vscode.Range(position.line, 0, position.line, 0);
            if (shortcuts.indexOf("submit") >= 0) {
                codeLens.push(new vscode.CodeLens(classRange, {
                    title: "提交代码",
                    command: "leetcode.submitSolution",
                    arguments: [document.uri, solution],
                }));
            }
            if (shortcuts.indexOf("test") >= 0) {
                codeLens.push(new vscode.CodeLens(classRange, {
                    title: "运行测试",
                    command: "leetcode.testSolution",
                    arguments: [document.uri, solution],
                }));
            }
        }

        if (solutions.length === 0 && shortcuts.indexOf("submit") >= 0) {
            codeLens.push(new vscode.CodeLens(range, {
                title: "提交代码",
                command: "leetcode.submitSolution",
                arguments: [document.uri],
            }));
        }

        if (solutions.length === 0 && shortcuts.indexOf("test") >= 0) {
            codeLens.push(new vscode.CodeLens(range, {
                title: "运行测试",
                command: "leetcode.testSolution",
                arguments: [document.uri],
            }));
        }

        if (shortcuts.indexOf("star") >= 0 && node) {
            codeLens.push(new vscode.CodeLens(range, {
                title: node.isFavorite ? "取消收藏" : "收藏",
                command: node.isFavorite ? "leetcode.removeFavorite" : "leetcode.addFavorite",
                arguments: [node],
            }));
        }

        if (shortcuts.indexOf("solution") >= 0) {
            codeLens.push(new vscode.CodeLens(range, {
                title: "题解",
                command: "leetcode.showSolution",
                arguments: [document.uri],
            }));
        }

        return codeLens;
    }
}

export const customCodeLensProvider: CustomCodeLensProvider = new CustomCodeLensProvider();
