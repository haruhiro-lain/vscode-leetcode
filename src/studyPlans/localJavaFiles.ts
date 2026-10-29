import * as fs from "fs-extra";
import * as path from "path";
import * as MarkdownIt from "markdown-it";
import { localMarkdownTarget } from "../webview/localMarkdownHtml";

function uniqueJavaFiles(files: readonly string[]): string[] {
    const seen: Set<string> = new Set();
    return files.filter((file) => {
        if (path.extname(file).toLowerCase() !== ".java") return false;
        const key = process.platform === "win32" ? path.resolve(file).toLowerCase() : path.resolve(file);
        if (seen.has(key)) return false;
        seen.add(key); return true;
    }).map((file) => path.resolve(file));
}

export function localJavaCandidates(statement: string, candidates: readonly string[], content: string): string[] {
    const linked: string[] = [];
    const tokens = new MarkdownIt().parse(content, {});
    for (const token of tokens) {
        if (token.type !== "inline" || !token.children) continue;
        for (const child of token.children) {
            if (child.type !== "link_open") continue;
            const target = localMarkdownTarget(child.attrGet("href") || "", statement);
            if (target) linked.push(target.file);
        }
    }
    return uniqueJavaFiles([...candidates, ...linked, statement.slice(0, -path.extname(statement).length) + ".java"]);
}

async function existingJavaFiles(files: readonly string[]): Promise<string[]> {
    const existing: string[] = [];
    for (const file of uniqueJavaFiles(files)) {
        try { if ((await fs.stat(file)).isFile()) existing.push(file); } catch (_) { /* Missing files do not expose a coding action. */ }
    }
    return existing;
}

export async function findLocalJavaFiles(statement: string, candidates: readonly string[] = [], content?: string): Promise<string[]> {
    const preferred = await existingJavaFiles(candidates);
    if (preferred.length) return preferred;
    if (content === undefined) {
        try { content = await fs.readFile(statement, "utf8"); } catch (_) { content = ""; }
    }
    return existingJavaFiles(localJavaCandidates(statement, [], content));
}
