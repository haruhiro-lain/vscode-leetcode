import * as vscode from "vscode";
import { StudyPlanNode } from "../studyPlans/StudyPlanNode";
import { localMarkdownPreviewProvider } from "../webview/localMarkdownPreviewProvider";

function getUri(input?: StudyPlanNode | vscode.Uri): vscode.Uri | undefined {
    return input instanceof StudyPlanNode ? input.uri : input;
}

export async function previewLocalMarkdown(input?: StudyPlanNode | vscode.Uri): Promise<void> {
    let uri = getUri(input);
    if (!uri && vscode.window.activeTextEditor?.document.uri.fsPath.toLowerCase().endsWith(".md")) uri = vscode.window.activeTextEditor.document.uri;
    if (!uri) uri = (await vscode.window.showOpenDialog({ canSelectMany: false, filters: { "Markdown 题目": ["md"] }, openLabel: "预览本地题目" }))?.[0];
    if (uri) await localMarkdownPreviewProvider.show(uri);
}

export async function openLocalMarkdown(input: StudyPlanNode | vscode.Uri): Promise<void> {
    const uri = getUri(input);
    if (uri) await vscode.window.showTextDocument(uri);
}
