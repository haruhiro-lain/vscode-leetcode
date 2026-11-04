import * as path from "path";
import * as vscode from "vscode";
import * as fse from "fs-extra";
import { findJavaSolutions, IJavaSolutionTarget } from "./javaSolutionUtils";
import { executeLocalJavaTests, ILocalTestOptions, parseLocalTestFile } from "./localJavaTestCore";

export async function runLocalJavaTests(uri?: vscode.Uri, target?: IJavaSolutionTarget): Promise<void> {
    const sourceUri: vscode.Uri | undefined = uri || vscode.window.activeTextEditor?.document.uri;
    if (!sourceUri || path.extname(sourceUri.fsPath).toLowerCase() !== ".java") throw new Error("本地文件测试目前支持 Java 题解。");
    const document: vscode.TextDocument = await vscode.workspace.openTextDocument(sourceUri);
    if (document.isDirty && !await document.save()) throw new Error("请先保存 Java 题解。");
    const testPath: string = path.join(path.dirname(sourceUri.fsPath), path.basename(sourceUri.fsPath, path.extname(sourceUri.fsPath)) + ".txt");
    if (!await fse.pathExists(testPath)) throw new Error(`未找到测试文件：${testPath}。请在 Java 文件同目录创建同名 .txt 文件。`);
    const testDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(testPath));
    if (testDocument.isDirty && !await testDocument.save()) throw new Error("请先保存测试文件。");
    const data = parseLocalTestFile(await fse.readFile(testPath, "utf8"));
    if (data.mode !== "stdin" && !target) {
        const solutions = findJavaSolutions(document.getText());
        if (solutions.length > 1) {
            const pick = await vscode.window.showQuickPick(solutions.map((solution) => ({ label: solution.name, solution })), { placeHolder: "请选择本地运行的解法" });
            if (!pick) return;
            target = pick.solution;
        }
    }
    const config = vscode.workspace.getConfiguration("java", sourceUri);
    const runtimes = config.get<Array<{ path: string; default?: boolean }>>("configuration.runtimes", []);
    const home: string | undefined = config.get<string>("jdt.ls.java.home") || runtimes.find((runtime) => runtime.default)?.path || runtimes[0]?.path || process.env.JAVA_HOME;
    const binary = (name: string) => home ? path.join(home, "bin", name + (process.platform === "win32" ? ".exe" : "")) : name;
    const writes = new vscode.EventEmitter<string>();
    const options: ILocalTestOptions = {
        javac: binary("javac"), java: binary("java"), cancelled: false,
        write: (text: string) => writes.fire(text.replace(/\r?\n/g, "\r\n")),
    };
    const selectedTarget = target;
    const terminal = vscode.window.createTerminal({ name: `本地测试 · ${path.basename(sourceUri.fsPath)}`, pty: {
        onDidWrite: writes.event,
        open: () => {
            executeLocalJavaTests(sourceUri.fsPath, testPath, selectedTarget, options)
                .then((code) => options.write(`\n本地测试结束（退出码 ${code}）。\n`), (error) => options.write(`\n测试失败：${error.message}\n`));
        },
        close: () => { options.cancelled = true; options.child?.kill(); writes.dispose(); },
        handleInput: (text: string) => { if (text.includes("\u0003")) { options.cancelled = true; options.child?.kill(); } },
    } });
    terminal.show();
}
