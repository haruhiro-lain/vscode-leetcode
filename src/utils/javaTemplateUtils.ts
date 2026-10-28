import { analyzeJavaSource, findJavaSolutions, IJavaType, IToken } from "./javaSolutionUtils";

const mainMethod: string = "    public static void main(String[] args) {\n    }";
const nodeNames: string[] = ["ListNode", "TreeNode", "Node"];
const keywords: string[] = ("abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null").split(" ");

export function javaIdentifier(value: string): string {
    let identifier: string = value.replace(/[^A-Za-z0-9_$\u4e00-\u9fff]/g, "_");
    if (!identifier || /^[0-9]/.test(identifier) || keywords.indexOf(identifier) >= 0) identifier = "_" + identifier;
    return identifier;
}

function packageForPath(filePath: string): string | undefined {
    const match: RegExpMatchArray | null = filePath.replace(/\\/g, "/").match(/(?:^|\/)src\/(?:main|test)\/java\/(.+)\/[^/]+\.java$/);
    if (!match) return undefined;
    const segments: string[] = match[1].split("/");
    if (segments.some((segment) => javaIdentifier(segment) !== segment)) {
        throw new Error("Java 包目录包含无效名称，请使用字母、数字或下划线，且不能以数字开头。");
    }
    return segments.join(".");
}

function codeRegion(source: string): { start: number; end: number } {
    const start: RegExpMatchArray | null = source.match(/^[ \t]*\/\/[ \t]*@lc code=start[^\r\n]*\r?\n/m);
    const end: RegExpMatchArray | null = source.match(/^[ \t]*\/\/[ \t]*@lc code=end[^\r\n]*/m);
    if (start && end && start.index !== undefined && end.index !== undefined && start.index < end.index) {
        return { start: start.index + start[0].length, end: end.index };
    }
    return { start: 0, end: source.length };
}

function indent(source: string, spaces: number): string {
    const lines: string[] = source.replace(/\r\n/g, "\n").trimEnd().split("\n");
    while (lines.length && !lines[0].trim()) lines.shift();
    const widths: number[] = lines.filter((line) => line.trim()).map((line) => line.match(/^[ \t]*/)![0].length);
    const width: number = widths.length ? Math.min(...widths) : 0;
    return lines.map((line) => line.trim() ? " ".repeat(spaces) + line.slice(width) : "").join("\n");
}

function methodBodies(source: string): Array<{ open: IToken; close: IToken; body: IToken[]; owner: IJavaType }> {
    const { tokens, types } = analyzeJavaSource(source);
    const bodies: Array<{ open: IToken; close: IToken; body: IToken[]; owner: IJavaType }> = [];
    tokens.forEach((token, i) => {
        if (token.value !== "{" || tokens[i - 1]?.value !== ")") return;
        const owner: IJavaType | undefined = types.find((type) => type.open === token.parent);
        if (!owner) return;
        let depth: number = 1;
        for (let j: number = i + 1; j < tokens.length; j++) {
            if (tokens[j].value === "{") depth++;
            if (tokens[j].value === "}") depth--;
            if (depth === 0) {
                bodies.push({ open: token, close: tokens[j], body: tokens.slice(i + 1, j), owner });
                break;
            }
        }
    });
    return bodies;
}

export function isUnansweredJavaExercise(source: string): boolean {
    if (!/@lc\s+app=\S+\s+id=\S+\s+lang=java\b/.test(source)) return false;
    const region = codeRegion(source);
    const judgeCode: string = source.slice(region.start, region.end);
    const bodies = methodBodies(judgeCode);
    return bodies.length > 0 && bodies.every(({ open, close, body }) => body.length === 0 ||
        (body.map((token) => token.value).join(" ") === "throw new UnsupportedOperationException ( ) ;" &&
            /\(\s*"TODO"\s*\)/.test(judgeCode.slice(open.end, close.start))));
}

function nodeDefinition(name: string, source: string, id: string): string | undefined {
    for (const comment of source.match(/\/\*[\s\S]*?\*\//g) || []) {
        const plain: string = comment.slice(2, -2).split(/\r?\n/).map((line) => line.replace(/^[ \t]*\* ?/, "")).join("\n");
        const classStart: number = plain.search(new RegExp("\\bclass\\s+" + name + "\\b"));
        if (classStart < 0) continue;
        const declaration: string = plain.slice(classStart);
        const type: IJavaType | undefined = analyzeJavaSource(declaration).types.find((candidate) => candidate.name === name);
        if (type) return "static " + declaration.slice(type.start, type.end);
    }
    if (name === "ListNode") return `static class ListNode {
    int val;
    ListNode next;

    ListNode() { }
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}`;
    if (name === "TreeNode") return `static class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;

    TreeNode() { }
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) {
        this.val = val;
        this.left = left;
        this.right = right;
    }
}`;
    if (name === "Node" && id === "138") return `static class Node {
    int val;
    Node next;
    Node random;

    Node(int val) { this.val = val; }
}`;
    return undefined;
}

function extractDirectives(source: string): { code: string; imports: string[]; packageName?: string } {
    const { tokens } = analyzeJavaSource(source);
    const imports: string[] = [];
    let packageName: string | undefined;
    const edits: Array<{ start: number; end: number }> = [];
    tokens.forEach((token, i) => {
        if (token.parent !== undefined || ["package", "import"].indexOf(token.value) < 0) return;
        const end: IToken | undefined = tokens.slice(i + 1).find((candidate) => candidate.value === ";");
        if (!end) return;
        const directive: string = source.slice(token.start, end.end);
        if (token.value === "import") imports.push(directive);
        else packageName = directive.replace(/^package\s+|;$/g, "").trim();
        edits.push({ start: token.start, end: end.end });
    });
    for (const edit of edits.reverse()) source = source.slice(0, edit.start) + source.slice(edit.end);
    return { code: source, imports, packageName };
}

export function formatJavaExercise(source: string, filePath: string, id: string): string {
    const eol: string = source.indexOf("\r\n") >= 0 ? "\r\n" : "\n";
    source = source.replace(/\r\n/g, "\n");
    const outerName: string = javaIdentifier("LeetCode" + id);
    const { tokens, types } = analyzeJavaSource(source);
    const outer: IJavaType | undefined = types.find((type) => type.name === outerName && type.parent === undefined);
    if (outer) {
        const wrappedRegion = codeRegion(source);
        const wrappedCode: string = source.slice(wrappedRegion.start, wrappedRegion.end);
        if (wrappedRegion.start > 0 && findJavaSolutions(wrappedCode).length === 0 && analyzeJavaSource(wrappedCode).types.some((type) =>
            type.parent === undefined && nodeNames.indexOf(type.name) < 0)) {
            source = source.slice(0, wrappedRegion.start) + "    class Solution {\n" + indent(wrappedCode, 8) + "\n    }\n" + source.slice(wrappedRegion.end);
        }
        const hasMain: boolean = tokens.some((token, i) => token.parent === outer.open && token.value === "main" && tokens[i + 1]?.value === "(");
        if (!hasMain) source = source.slice(0, tokens[outer.open].end) + "\n" + mainMethod + "\n" + source.slice(tokens[outer.open].end);
        return source.replace(/\n/g, eol);
    }

    const region = codeRegion(source);
    let prefix: string = source.slice(0, region.start).replace(/^[ \t]*\/\/[ \t]*@lc code=start[^\n]*\n?$/m, "");
    let code: string = source.slice(region.start, region.end);
    if (region.start === 0) {
        const first: IJavaType | undefined = types.find((type) => type.parent === undefined);
        if (!first) throw new Error("Java 模板中未找到可生成的题解类。");
        prefix = source.slice(0, first.declarationStart);
        code = source.slice(first.declarationStart);
    }
    const header = extractDirectives(prefix);
    const body = extractDirectives(code);
    code = body.code;
    const packageName: string | undefined = packageForPath(filePath) || header.packageName || body.packageName;
    const imports: string[] = Array.from(new Set(["import java.util.*;"].concat(header.imports, body.imports)));
    const definitions: string[] = [];
    for (const name of nodeNames) {
        const structure = analyzeJavaSource(code);
        const declared: IJavaType | undefined = structure.types.find((type) => type.name === name && type.parent === undefined);
        if (declared) {
            definitions.push("static " + code.slice(declared.start, declared.end));
            code = code.slice(0, declared.declarationStart) + code.slice(declared.end);
        } else if (structure.tokens.some((token) => token.value === name) && !structure.types.some((type) => type.name === name)) {
            const definition: string | undefined = nodeDefinition(name, source, id);
            if (definition) definitions.push(definition);
        }
    }
    if (findJavaSolutions(code).length === 0) code = "class Solution {\n" + indent(code, 4) + "\n}";
    const metadata: string = header.code.trim();
    const nodeCode: string = definitions.length ? "\n\n    // 本地编译使用的节点定义；提交时由力扣提供。\n" + definitions.map((definition) => indent(definition, 4)).join("\n\n") : "";
    return ((packageName ? `package ${packageName};\n\n` : "") + imports.join("\n") + "\n\n" +
        (metadata ? metadata + "\n\n" : "") + `class ${outerName} {\n${mainMethod}\n\n` +
        `    // @lc code=start\n${indent(code, 4)}\n    // @lc code=end${nodeCode}\n}\n`).replace(/\n/g, eol);
}
