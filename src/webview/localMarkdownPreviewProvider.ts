import * as path from "path";
import * as crypto from "crypto";
import * as vscode from "vscode";
import { ILeetCodeWebviewOption, LeetCodeWebview } from "./LeetCodeWebview";
import { markdownEngine } from "./markdownEngine";
import { localMarkdownHtml, localMarkdownTarget } from "./localMarkdownHtml";
import { completionEdit, findLocalCompletion, withLocalCompletion } from "../studyPlans/localCompletion";

export class LocalMarkdownPreviewProvider extends LeetCodeWebview {
    protected readonly viewType = "leetcode.localMarkdown";
    private document: vscode.TextDocument | undefined;
    private changeListener: vscode.Disposable | undefined;
    private revision = 0;
    private fragment = "";
    private updatingCompletion = false;

    public async show(uri: vscode.Uri): Promise<void> {
        const revision = ++this.revision;
        if (uri.scheme !== "file" || path.extname(uri.fsPath).toLowerCase() !== ".md") {
            vscode.window.showErrorMessage("请选择本地 .md 题目文件。"); return;
        }
        try {
            const document = await vscode.workspace.openTextDocument(uri.with({ fragment: "", query: "" }));
            if (revision !== this.revision) return;
            this.document = document;
            this.fragment = uri.fragment;
            if (!this.changeListener) this.changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
                if (this.panel && this.document && event.document.uri.toString() === this.document.uri.toString()) {
                    this.document = event.document;
                    this.panel.webview.html = this.getWebviewContent();
                }
            });
            this.showWebviewInternal();
        } catch (error) { vscode.window.showErrorMessage("无法读取本地题目：" + error.message); }
    }

    public dispose(): void {
        this.revision++;
        if (this.changeListener) this.changeListener.dispose();
        this.changeListener = undefined;
        super.dispose();
    }

    protected getWebviewOption(): ILeetCodeWebviewOption {
        return { title: `${path.basename(this.document!.uri.fsPath, ".md")}：题目描述`, viewColumn: vscode.ViewColumn.One };
    }

    protected getWebviewOptions(): vscode.WebviewOptions {
        const uri = this.document!.uri;
        const folder = vscode.workspace.getWorkspaceFolder(uri);
        return { enableScripts: true, enableCommandUris: false, localResourceRoots: [
            ...markdownEngine.localResourceRoots,
            folder ? folder.uri : vscode.Uri.file(path.dirname(uri.fsPath)),
        ] };
    }

    protected getWebviewContent(): string {
        const file = this.document!.uri.fsPath;
        const webview = this.panel!.webview;
        const content = this.document!.getText();
        const completion = findLocalCompletion(content);
        const formatted = completion ? content : withLocalCompletion(content, false);
        const position = findLocalCompletion(formatted)!;
        const body = markdownEngine.render(formatted, {
            localMarkdown: true,
            localCompletionLine: formatted.slice(0, position.offset).split("\n").length - 1,
            localCompletionHtml: `<label><input type="checkbox" id="local-completion"${completion?.checked ? " checked" : ""}> 已通过</label>`,
            resolveImage: (href: string): string => {
                const target = localMarkdownTarget(href, file);
                if (target) return webview.asWebviewUri(vscode.Uri.file(target.file)).toString();
                return /^https:|^data:image\//i.test(href) ? href : "";
            },
            resolveLink: (href: string): string => {
                const target = localMarkdownTarget(href, file);
                if (target) return vscode.Uri.file(target.file).with({ fragment: target.fragment }).toString();
                return /^https?:|^mailto:|^#/i.test(href) ? href : "";
            },
        });
        return localMarkdownHtml(body, markdownEngine.getStyles((uri) => webview.asWebviewUri(uri)), webview.cspSource,
            crypto.randomBytes(18).toString("hex"), this.fragment, this.document!.uri.toString());
    }

    protected async onDidReceiveMessage(message: { command: string; href?: string; checked?: boolean; document?: string }): Promise<void> {
        if (!this.document) return;
        if (message.command === "setPassed") {
            if (typeof message.checked === "boolean" && message.document === this.document.uri.toString()) await this.setCompletion(message.checked);
        } else if (message.command === "openSource") await vscode.window.showTextDocument(this.document.uri);
        else if (message.command === "refresh") await this.show(this.document.uri);
        else if (message.command === "openLink" && typeof message.href === "string") {
            const target = localMarkdownTarget(message.href, this.document.uri.fsPath);
            try {
                if (target) {
                    const uri = vscode.Uri.file(target.file).with({ fragment: target.fragment });
                    if (/\.md$/i.test(target.file)) await this.show(uri);
                    else await vscode.window.showTextDocument(uri.with({ fragment: "" }));
                } else if (/^https?:|^mailto:/i.test(message.href)) await vscode.env.openExternal(vscode.Uri.parse(message.href));
            } catch (error) { vscode.window.showErrorMessage("无法打开题目链接：" + error.message); }
        }
    }

    private async setCompletion(checked: boolean): Promise<void> {
        if (!this.document || this.updatingCompletion) return;
        const document = this.document;
        this.updatingCompletion = true;
        try {
            if (document.isDirty) {
                vscode.window.showWarningMessage("题面有未保存的修改，请先保存，再勾选通过状态。"); return;
            }
            const edit = completionEdit(document.getText(), checked);
            const workspaceEdit = new vscode.WorkspaceEdit();
            workspaceEdit.replace(document.uri, new vscode.Range(document.positionAt(edit.start), document.positionAt(edit.end)), edit.text);
            if (!await vscode.workspace.applyEdit(workspaceEdit)) throw new Error("无法修改题面的通过标记。");
            if (!await document.save()) throw new Error("通过标记尚未保存，请在编辑器中保存题面。");
            await vscode.commands.executeCommand("leetcode.refreshStudyPlans");
        } catch (error) { vscode.window.showErrorMessage("更新通过状态失败：" + error.message); } finally {
            this.updatingCompletion = false;
            if (this.panel && this.document === document) this.panel.webview.html = this.getWebviewContent();
        }
    }
}

export const localMarkdownPreviewProvider = new LocalMarkdownPreviewProvider();
