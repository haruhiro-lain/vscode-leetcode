import * as vscode from "vscode";
import { StudyPlanNode } from "../studyPlans/StudyPlanNode";
import { localMarkdownPreviewProvider } from "../webview/localMarkdownPreviewProvider";
import { studyPlanManager } from "../studyPlans/studyPlanManager";
import { findLocalJavaFiles } from "../studyPlans/localJavaFiles";
import * as path from "path";

function getUri(input?: StudyPlanNode | vscode.Uri): vscode.Uri | undefined {
    return input instanceof StudyPlanNode ? input.uri : input;
}

export async function previewLocalMarkdown(input?: StudyPlanNode | vscode.Uri, sideMode: boolean = false): Promise<void> {
    let uri = getUri(input);
    if (!uri && vscode.window.activeTextEditor?.document.uri.fsPath.toLowerCase().endsWith(".md")) uri = vscode.window.activeTextEditor.document.uri;
    if (!uri) uri = (await vscode.window.showOpenDialog({ canSelectMany: false, filters: { "Markdown 题目": ["md"] }, openLabel: "预览本地题目" }))?.[0];
    if (uri?.scheme === "file" && path.extname(uri.fsPath).toLowerCase() === ".java") {
        const java = uri.fsPath;
        const problems = studyPlanManager.getLocalProblems(java);
        if (!problems.length) { vscode.window.showInformationMessage("未找到对应的本地题目，请刷新题单或检查关联路径。"); return; }
        const selected = problems.length === 1 ? problems[0] : await vscode.window.showQuickPick(problems.map((problem) => ({
            label: problem.name, description: vscode.workspace.asRelativePath(problem.file, true), file: problem.file,
        })), { placeHolder: "请选择要查看的题目描述", matchOnDescription: true });
        if (selected) await localMarkdownPreviewProvider.show(vscode.Uri.file(selected.file), [java], true);
        return;
    }
    if (uri) await localMarkdownPreviewProvider.show(uri, input instanceof StudyPlanNode ? input.entry.javaFiles : undefined, sideMode);
}

export async function startLocalProblem(input: StudyPlanNode | vscode.Uri, preferred?: readonly string[]): Promise<void> {
    const uri = getUri(input);
    if (!uri || uri.scheme !== "file" || path.extname(uri.fsPath).toLowerCase() !== ".md") return;
    try {
        const selected = preferred?.length ? preferred : input instanceof StudyPlanNode ? input.entry.javaFiles : undefined;
        const candidates = selected?.length ? selected : studyPlanManager.getJavaFiles(uri.fsPath);
        const files = await findLocalJavaFiles(uri.fsPath, candidates);
        if (!files.length) { vscode.window.showInformationMessage("未找到对应的 Java 文件，请刷新题目或检查关联路径。"); return; }
        const choice = files.length === 1 ? files[0] : (await vscode.window.showQuickPick(files.map((file) => ({
            label: path.basename(file), description: vscode.workspace.asRelativePath(file, true), file,
        })), { placeHolder: "请选择要打开的 Java 题解", matchOnDescription: true }))?.file;
        if (choice) await vscode.window.showTextDocument(vscode.Uri.file(choice), { preview: false, viewColumn: vscode.ViewColumn.One });
    } catch (error) { vscode.window.showErrorMessage("无法打开本地题解：" + error.message); }
}

export async function openLocalMarkdown(input: StudyPlanNode | vscode.Uri): Promise<void> {
    const uri = getUri(input);
    if (uri) await vscode.window.showTextDocument(uri);
}
