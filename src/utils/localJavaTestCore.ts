import * as cp from "child_process";
import * as fse from "fs-extra";
import * as os from "os";
import * as path from "path";
import { analyzeJavaSource, buildJavaSubmission, findJavaSolutions, IJavaSolutionTarget } from "./javaSolutionUtils";

export interface ILocalTestOptions {
    javac: string;
    java: string;
    write(text: string): void;
    cancelled: boolean;
    child?: cp.ChildProcess;
}

export function resolveLocalJavaTarget(source: string, target?: IJavaSolutionTarget): IJavaSolutionTarget {
    const solutions: IJavaSolutionTarget[] = findJavaSolutions(source);
    if (target) {
        const exact = solutions.find((solution) => solution.name === target.name && solution.start === target.start);
        if (exact) return exact;
        // 编辑器将换行规范化为 LF，磁盘可能使用 CRLF；保存格式化也会移动类的位置。
        const sameName = solutions.filter((solution) => solution.name === target.name);
        if (sameName.length === 1) return sameName[0];
        if (!sameName.length) throw new Error(`所选解法 ${target.name} 已删除或重命名，请重新选择解法。`);
        throw new Error(`存在多个 ${target.name} 且位置已变化，请重新点击要测试的解法入口。`);
    }
    if (solutions.length === 1) return solutions[0];
    if (!solutions.length) throw new Error("找不到 Solution 类；测试 main 请在文件中设置 mode: stdin。");
    throw new Error("存在多个 Solution 解法，请选择要运行的解法。");
}

export function parseLocalTestFile(text: string): any {
    let data: any;
    try { data = JSON.parse(text.replace(/^\uFEFF/, "")); } catch { throw new Error('测试文件须为 JSON：{"method":"方法名","cases":[{"input":[参数],"expected":结果}]}'); }
    if (!data || !Array.isArray(data.cases) || !data.cases.length) throw new Error("测试文件的 cases 必须是非空数组。");
    if (data.mode !== undefined && !["method", "stdin"].includes(data.mode)) throw new Error("mode 仅支持 method 或 stdin。");
    if (data.method !== undefined && !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(data.method)) throw new Error("method 必须是 Java 方法名。");
    if (data.timeoutMs !== undefined && (!Number.isInteger(data.timeoutMs) || data.timeoutMs < 100 || data.timeoutMs > 300000)) {
        throw new Error("timeoutMs 须为 100 到 300000 之间的整数。");
    }
    for (const [i, item] of data.cases.entries()) {
        if (!item || !Object.prototype.hasOwnProperty.call(item, "expected")) throw new Error(`用例 ${i + 1} 缺少 expected。`);
        if (data.mode === "stdin") {
            if (typeof item.input !== "string" || typeof item.expected !== "string") throw new Error(`标准输入用例 ${i + 1} 的 input 和 expected 须为字符串。`);
        } else if (!Array.isArray(item.input)) throw new Error(`用例 ${i + 1} 的 input 须为参数数组。`);
        if (item.outputArg !== undefined && (!Number.isInteger(item.outputArg) || item.outputArg < 0 || item.outputArg >= item.input.length)) {
            throw new Error(`用例 ${i + 1} 的 outputArg 超出参数范围。`);
        }
        if (item.comparison !== undefined && !["exact", "unordered", "unorderedNested"].includes(item.comparison)) throw new Error(`用例 ${i + 1} 的 comparison 无效。`);
    }
    return data;
}

function encode(value: any): Buffer {
    const chunks: Buffer[] = [];
    const byte = (n: number) => chunks.push(Buffer.from([n]));
    const integer = (n: number) => { const b: Buffer = Buffer.alloc(4); b.writeInt32BE(n, 0); chunks.push(b); };
    const string = (s: string) => { const b: Buffer = Buffer.from(s, "utf8"); integer(b.length); chunks.push(b); };
    const visit = (v: any): void => {
        if (v === null) {
            byte(0);
        } else if (typeof v === "boolean") {
            byte(1); byte(v ? 1 : 0);
        } else if (typeof v === "number") {
            byte(2); string(String(v));
        } else if (typeof v === "string") {
            byte(3); string(v);
        } else if (Array.isArray(v)) {
            byte(4); integer(v.length); for (const child of v) visit(child);
        } else {
            byte(5); const keys: string[] = Object.keys(v); integer(keys.length);
            for (const key of keys) { string(key); visit(v[key]); }
        }
    };
    visit(value);
    return Buffer.concat(chunks);
}

async function execute(command: string, args: string[], cwd: string, options: ILocalTestOptions, input?: string, timeout: number = 30000): Promise<{ code: number; output: string }> {
    if (options.cancelled) throw new Error("测试已取消。");
    return new Promise((resolve, reject) => {
        const child: cp.ChildProcess = cp.spawn(command, args, { cwd, windowsHide: true, shell: false });
        options.child = child;
        let output: string = "";
        let outputLength: number = 0;
        let timedOut: boolean = false;
        const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
        for (const stream of [child.stdout, child.stderr]) {
            stream?.setEncoding("utf8");
            stream?.on("data", (text: string) => {
                if (stream === child.stdout) output += text;
                outputLength += text.length;
                if (outputLength > 4 * 1024 * 1024) { child.kill(); return; }
                options.write(text);
            });
        }
        child.on("error", (error) => { clearTimeout(timer); reject(new Error(`无法启动 ${command}：${error.message}。请配置本机 JDK。`)); });
        child.on("close", (code) => {
            clearTimeout(timer);
            if (options.child === child) options.child = undefined;
            if (timedOut) reject(new Error(`运行超时（${timeout} ms）。`));
            else if (options.cancelled) reject(new Error("测试已取消。"));
            else resolve({ code: code === null ? 1 : code, output });
        });
        child.stdin?.on("error", () => undefined);
        child.stdin?.end(input || "");
    });
}

export async function executeLocalJavaTests(sourcePath: string, testPath: string, target: IJavaSolutionTarget | undefined, options: ILocalTestOptions): Promise<number> {
    const data = parseLocalTestFile(await fse.readFile(testPath, "utf8"));
    const source: string = await fse.readFile(sourcePath, "utf8");
    const directory: string = await fse.mkdtemp(path.join(os.tmpdir(), "leetcode-local-"));
    try {
        options.write(`本地 Java 测试：${sourcePath}\n测试文件：${testPath}\n`);
        if (data.mode === "stdin") {
            const stdinAnalysis = analyzeJavaSource(source);
            const top = stdinAnalysis.types.find((type) => type.parent === undefined && type.name === "Main") ||
                stdinAnalysis.types.find((type) => type.parent === undefined && type.kind === "class");
            if (!top) throw new Error("找不到包含 main 的 Java 类。");
            const packageMatch = source.match(/^\s*package\s+([\w.]+)\s*;/m);
            const filename: string = top.name + ".java";
            await fse.writeFile(path.join(directory, filename), source, "utf8");
            const stdinCompiled = await execute(options.javac, ["-encoding", "UTF-8", "-d", directory, filename], directory, options);
            if (stdinCompiled.code) return stdinCompiled.code;
            let stdinFailures: number = 0;
            for (const [i, item] of data.cases.entries()) {
                options.write(`\n用例 ${i + 1}\n输入：${JSON.stringify(item.input)}\n期望：${JSON.stringify(item.expected)}\n`);
                const result = await execute(options.java, ["-Dfile.encoding=UTF-8", "-cp", directory, (packageMatch ? packageMatch[1] + "." : "") + top.name], directory, options, item.input, data.timeoutMs || 10000);
                const normal = (s: string) => s.replace(/\r\n/g, "\n").replace(/\n$/, "");
                const pass: boolean = result.code === 0 && normal(result.output) === normal(item.expected);
                options.write(`\n实际：${JSON.stringify(result.output)}\n${pass ? "PASS" : "FAIL"}\n`);
                if (!pass) stdinFailures++;
            }
            options.write(`\n总计 ${data.cases.length}，通过 ${data.cases.length - stdinFailures}，失败 ${stdinFailures}\n`);
            return stdinFailures ? 1 : 0;
        }
        const selected: IJavaSolutionTarget = resolveLocalJavaTarget(source, target);
        const metadata: string = /@lc\s+app=/.test(source) ? "" : "// @lc app=leetcode.cn id=local lang=java\n";
        const adjusted = { name: selected.name, start: selected.start + metadata.length };
        let submission: string = buildJavaSubmission(metadata + source, adjusted);
        // LeetCode 提供的节点在本地编译时使用源文件中的定义。
        const analysis = analyzeJavaSource(source);
        for (const type of analysis.types.filter((item) => ["TreeNode", "ListNode", "Node"].includes(item.name))) {
            submission += "\n" + source.slice(type.start, type.end);
        }
        await fse.writeFile(path.join(directory, "Solution.java"), "import java.util.*;\nimport java.io.*;\nimport java.math.*;\n" + submission, "utf8");
        await fse.copy(path.resolve(__dirname, "../../../resources/LocalJavaRunner.java"), path.join(directory, "LocalJavaRunner.java"));
        await fse.writeFile(path.join(directory, "cases.bin"), encode(data));
        options.write(`解法：${selected.name}，编译中…\n`);
        const compiled = await execute(options.javac, ["-encoding", "UTF-8", "-d", directory, "Solution.java", "LocalJavaRunner.java"], directory, options);
        if (compiled.code) return compiled.code;
        // 每个用例独立 JVM，超时或异常不会妨碍后续用例。
        let failures: number = 0;
        for (let i: number = 0; i < data.cases.length; i++) {
            try {
                const result = await execute(options.java, ["-Dfile.encoding=UTF-8", "-cp", directory, "LocalJavaRunner", "cases.bin", String(i)], directory, options, undefined, data.timeoutMs || 10000);
                if (result.code) failures++;
            } catch (error) {
                if (options.cancelled) throw error;
                failures++;
                options.write(`用例 ${i + 1} FAIL：${error.message}\n`);
            }
        }
        options.write(`\n总计 ${data.cases.length}，通过 ${data.cases.length - failures}，失败 ${failures}\n`);
        return failures ? 1 : 0;
    } finally {
        await fse.remove(directory);
    }
}
