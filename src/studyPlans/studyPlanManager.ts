import * as path from "path";
import * as fs from "fs-extra";
import * as vscode from "vscode";
import { explorerNodeManager } from "../explorer/explorerNodeManager";
import { LeetCodeNode } from "../explorer/LeetCodeNode";
import { leetCodeChannel } from "../leetCodeChannel";
import { leetCodeManager } from "../leetCodeManager";
import { defaultProblem, ProblemState } from "../shared";
import { IStudyPlanEntry, IStudyPlanResult, IStudyPlanSource, loadStudyPlans, resolveStudyPath } from "./studyPlanLoader";
import { StudyPlanNode } from "./StudyPlanNode";
import { arabicModuleName } from "./moduleLabel";
import { shouldHideSolvedProblem } from "../utils/settingUtils";
import { defaultBuiltinStudyPlans } from "./builtinStudyPlans";

export const defaultStudyPlanPath = ".vscode/leetcode-study-plans.json";

export class StudyPlanManager implements vscode.Disposable {
    private result: IStudyPlanResult = { roots: [], dependencies: new Set(), directories: new Set(), errors: [], configured: false };
    private listeners: vscode.Disposable[] = [];
    private timer: NodeJS.Timeout | undefined;
    private revision = 0;

    public initialize(refresh: () => Promise<void>): void {
        const schedule = (): void => {
            if (this.timer) clearTimeout(this.timer);
            this.timer = setTimeout(() => { refresh().catch((error) => leetCodeChannel.appendLine(String(error))); }, 350);
        };
        const watcher = vscode.workspace.createFileSystemWatcher("**/*.{md,MD,json,java}");
        const onFile = (uri: vscode.Uri): void => { if (this.isRelevant(uri.fsPath)) schedule(); };
        this.listeners.push(watcher, watcher.onDidCreate(onFile), watcher.onDidChange(onFile), watcher.onDidDelete(onFile),
            vscode.workspace.onDidChangeWorkspaceFolders(schedule),
            vscode.workspace.onDidChangeConfiguration((event) => { if (event.affectsConfiguration("leetcode.studyPlanFiles")) schedule(); }));
    }

    public async refresh(): Promise<void> {
        const revision = ++this.revision;
        const sources = this.getSources();
        const result = await loadStudyPlans(sources);
        if (revision !== this.revision) return;
        this.result = result;
        for (const error of result.errors) leetCodeChannel.appendLine("[自定义题单] " + error);
    }

    public getRoots(): LeetCodeNode[] {
        if (!this.result.configured) return leetCodeManager.getUser() ? explorerNodeManager.getRootNodes() : [];
        const roots: LeetCodeNode[] = [];
        const builtins: Set<string> = new Set();
        for (const entry of this.result.roots) {
            if (entry.kind === "builtin") {
                // Multiple workspace folders may each declare the same default category.
                if (!leetCodeManager.getUser() || builtins.has(entry.builtin!)) continue;
                builtins.add(entry.builtin!);
                roots.push(new LeetCodeNode(Object.assign({}, defaultProblem, { id: entry.builtin!, name: entry.name }), false));
            } else roots.push(new StudyPlanNode(entry));
        }
        return roots;
    }

    public getChildren(node: StudyPlanNode): LeetCodeNode[] {
        if (node.entry.kind !== "group") return [];
        const nodes: LeetCodeNode[] = [];
        for (const entry of node.entry.children) {
            if (entry.kind === "leetcode") {
                const problem = leetCodeManager.getUser() ? explorerNodeManager.getNodeById(entry.problemId!) : undefined;
                if (problem) nodes.push(problem);
            } else if (entry.kind !== "markdown" || !entry.completed || !shouldHideSolvedProblem()) nodes.push(new StudyPlanNode(entry));
        }
        // Sort LeetCode slots only. Local statements and submodules retain the authored order.
        const sorted = explorerNodeManager.getNodesByIds(nodes.filter((item) => item.isProblem).map((item) => item.id));
        let index = 0;
        return nodes.map((item) => item.isProblem ? sorted[index++] : item);
    }

    public getTooltip(node: StudyPlanNode): string {
        if (node.entry.kind === "markdown") return node.entry.file || "";
        const { accepted, failed, local, total } = this.getProgress(node);
        return `已通过：${accepted}\n未通过：${failed}\n本地题目：${local}\n总题数：${total}`;
    }

    public getLabel(node: StudyPlanNode): string {
        if (node.entry.kind === "markdown") return node.name;
        const { accepted, total } = this.getProgress(node);
        return `${arabicModuleName(node.name)} (${accepted}/${total})`;
    }

    public getProgress(node: StudyPlanNode): { accepted: number; failed: number; local: number; total: number } {
        let accepted = 0;
        let failed = 0;
        let local = 0;
        let total = 0;
        const visit = (entry: IStudyPlanEntry): void => {
            if (entry.kind === "group") { for (const child of entry.children) visit(child); return; }
            total++;
            if (entry.kind === "markdown") {
                local++;
                if (entry.completed) accepted++;
            } else if (leetCodeManager.getUser()) {
                const problem = explorerNodeManager.getNodeById(entry.problemId!, true);
                if (problem?.state === ProblemState.AC) accepted++;
                else if (problem?.state === ProblemState.NotAC) failed++;
            }
        };
        visit(node.entry);
        return { accepted, failed, local, total };
    }

    public async editConfiguration(): Promise<void> {
        try {
            const sources = this.getSources();
            if (!sources.length) { vscode.window.showWarningMessage("请先打开工作区文件夹，或设置 leetcode.studyPlanFiles。"); return; }
            const chosen = sources.length === 1 ? sources[0] : (await vscode.window.showQuickPick(
                sources.map((source) => ({ label: path.basename(path.dirname(source.file)) + "/" + path.basename(source.file), description: source.file, source })),
                { placeHolder: "选择要编辑的自定义题单配置" },
            ))?.source;
            if (!chosen) return;
            await fs.ensureDir(path.dirname(chosen.file));
            if (!await fs.pathExists(chosen.file)) {
                const sample = { version: 1, plans: [defaultBuiltinStudyPlans[0], { id: "my-plan", name: "我的题单", items: [
                    { name: "哈希", items: [{ leetcode: "1" }, { leetcode: "49" }] },
                ] }, ...defaultBuiltinStudyPlans.slice(1)] };
                try { await fs.writeFile(chosen.file, JSON.stringify(sample, null, 4) + "\n", { flag: "wx" }); } catch (error) {
                    if (error.code !== "EEXIST") throw error;
                }
            }
            await vscode.window.showTextDocument(vscode.Uri.file(chosen.file));
        } catch (error) { vscode.window.showErrorMessage("无法打开题单配置：" + error.message); }
    }

    public dispose(): void {
        this.revision++;
        if (this.timer) clearTimeout(this.timer);
        for (const listener of this.listeners) listener.dispose();
        this.listeners = [];
    }

    private isRelevant(file: string): boolean {
        const normalized = path.resolve(file);
        if (this.result.dependencies.has(normalized)) return true;
        // Include missing/default manifests so creating the first configuration updates the view.
        if (this.getSources().some((source) => source.file === normalized)) return true;
        for (const folder of this.result.directories) {
            const relative = path.relative(folder, normalized);
            if (relative === "" || relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative)) return true;
        }
        return false;
    }

    private getSources(): IStudyPlanSource[] {
        const sources: IStudyPlanSource[] = [];
        const folders = vscode.workspace.workspaceFolders || [];
        const add = (workspaceRoot?: string, uri?: vscode.Uri): void => {
            const files = vscode.workspace.getConfiguration("leetcode", uri).get<string[]>("studyPlanFiles", [defaultStudyPlanPath]);
            if (!Array.isArray(files)) return;
            for (const file of files) {
                try {
                    if (!workspaceRoot && !path.isAbsolute(file)) continue;
                    const resolved = resolveStudyPath(file, workspaceRoot || ".", workspaceRoot);
                    if (!sources.some((source) => source.file === resolved)) sources.push({ file: resolved, workspaceRoot });
                } catch (error) { leetCodeChannel.appendLine("[自定义题单] " + error.message); }
            }
        };
        if (!folders.length) add();
        for (const folder of folders) add(folder.uri.fsPath, folder.uri);
        return sources;
    }
}

export const studyPlanManager = new StudyPlanManager();
