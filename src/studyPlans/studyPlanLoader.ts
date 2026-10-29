import * as fs from "fs-extra";
import * as path from "path";
import * as crypto from "crypto";
import * as MarkdownIt from "markdown-it";
import { findLocalCompletion } from "./localCompletion";
import { defaultBuiltinStudyPlans } from "./builtinStudyPlans";

export interface IStudyPlanEntry {
    id: string;
    name: string;
    kind: "group" | "leetcode" | "markdown" | "builtin";
    children: IStudyPlanEntry[];
    problemId?: string;
    file?: string;
    completed?: boolean;
    builtin?: string;
}

export interface IStudyPlanSource { file: string; workspaceRoot?: string; }
export interface IStudyPlanResult { roots: IStudyPlanEntry[]; dependencies: Set<string>; directories: Set<string>; errors: string[]; configured: boolean; }

export function resolveStudyPath(value: string, base: string, workspaceRoot?: string): string {
    if (!value || typeof value !== "string") throw new Error("题单路径不能为空。");
    if (value.indexOf("${workspaceFolder}") >= 0) {
        if (!workspaceRoot) throw new Error("题单路径使用了 ${workspaceFolder}，请先打开工作区文件夹。");
        value = value.split("${workspaceFolder}").join(workspaceRoot);
    }
    if (/\$\{[^}]*\}/.test(value)) throw new Error("题单路径仅支持 ${workspaceFolder} 变量。");
    return path.resolve(base, value);
}

function makeEntry(key: string, name: string, kind: IStudyPlanEntry["kind"]): IStudyPlanEntry {
    return { id: "StudyPlan." + crypto.createHash("sha1").update(key).digest("hex"), name, kind, children: [] };
}

export async function loadStudyPlans(sources: IStudyPlanSource[]): Promise<IStudyPlanResult> {
    const result: IStudyPlanResult = { roots: [], dependencies: new Set(), directories: new Set(), errors: [], configured: false };
    for (const source of sources) {
        result.dependencies.add(path.resolve(source.file));
        if (!await fs.pathExists(source.file)) continue;
        try {
            const config = JSON.parse((await fs.readFile(source.file, "utf8")).replace(/^\uFEFF/, ""));
            if (config.version !== 1 || !Array.isArray(config.plans)) throw new Error("题单配置须包含 version: 1 和 plans 数组。");
            result.configured = true;
            const ids: Set<string> = new Set();
            const builtins: Set<string> = new Set();
            for (const plan of config.plans) {
                try {
                    if (!plan || typeof plan.id !== "string" || !plan.id.trim() || ids.has(plan.id)) throw new Error("题单 id 不能为空或重复。");
                    ids.add(plan.id);
                    const entry = await readItem(plan, source, source.file + ":" + plan.id, path.dirname(source.file), result, 0);
                    if (entry.kind !== "group" && entry.kind !== "builtin") throw new Error("题单顶层必须是 builtin、items、source 或 folder 分组。");
                    if (entry.builtin) {
                        if (builtins.has(entry.builtin)) throw new Error("同一配置中默认分类不能重复：" + entry.builtin);
                        builtins.add(entry.builtin);
                    }
                    result.roots.push(entry);
                } catch (error) { result.errors.push(`${source.file}：${error.message}`); }
            }
        } catch (error) { result.errors.push(`${source.file}：${error.message}`); }
    }
    return result;
}

async function readItem(item: any, source: IStudyPlanSource, key: string, base: string, result: IStudyPlanResult, depth: number): Promise<IStudyPlanEntry> {
    if (!item || depth > 32) throw new Error("题单条目无效或分组超过 32 层。");
    const variants = ["builtin", "items", "source", "folder", "leetcode", "file"].filter((field) => item[field] !== undefined);
    if (variants.length !== 1) throw new Error("每个条目须且只能指定 builtin、items、source、folder、leetcode、file 之一。");
    const kind = variants[0];
    if (kind === "leetcode") {
        const id = String(item.leetcode);
        if (!/^\d+$/.test(id)) throw new Error("leetcode 须为数字题号。");
        return Object.assign(makeEntry(key, item.name || id, "leetcode"), { problemId: id });
    }
    if (kind !== "file" && (typeof item.name !== "string" || !item.name.trim())) throw new Error("分组须指定 name。");
    if (kind === "builtin") {
        if (depth !== 0) throw new Error("builtin 默认分类只能放在 plans 顶层。");
        if (!defaultBuiltinStudyPlans.some((category) => category.builtin === item.builtin)) throw new Error("不支持的默认分类：" + item.builtin);
        return Object.assign(makeEntry(key, item.name, "builtin"), { builtin: item.builtin });
    }
    if (kind === "file") {
        const file = resolveStudyPath(item.file, base, source.workspaceRoot);
        if (path.extname(file).toLowerCase() !== ".md") throw new Error("本地题目须为 .md 文件。");
        result.dependencies.add(file);
        // Keep explicit missing files visible so users can repair their path from the preview error.
        return readLocalProblem(file, key, item.name);
    }
    const entry = makeEntry(key, item.name, "group");
    if (kind === "items") {
        if (!Array.isArray(item.items)) throw new Error("items 须为数组。");
        for (let index = 0; index < item.items.length; index++) {
            try { entry.children.push(await readItem(item.items[index], source, key + ":" + index, base, result, depth + 1)); } catch (error) {
                result.errors.push(`${source.file} / ${item.name}：${error.message}`);
            }
        }
    } else if (kind === "source") {
        if (item.sourceMode !== undefined && ["links", "leetcode"].indexOf(item.sourceMode) < 0) throw new Error("sourceMode 仅支持 links 或 leetcode。");
        const file = resolveStudyPath(item.source, base, source.workspaceRoot);
        if (path.extname(file).toLowerCase() !== ".md") throw new Error("source 须为 Markdown 题单索引。");
        result.dependencies.add(file);
        entry.children = await readMarkdownIndex(file, source, key, result, item.sourceMode || "links");
    } else {
        const folder = resolveStudyPath(item.folder, base, source.workspaceRoot);
        entry.children = await readFolder(folder, key, result, depth);
    }
    return entry;
}

async function readLocalProblem(file: string, key: string, name?: string): Promise<IStudyPlanEntry> {
    let title = path.basename(file, path.extname(file));
    let completed = false;
    try {
        const content = await fs.readFile(file, "utf8");
        const heading = /^#\s+(.+?)\s*#*\s*$/m.exec(content);
        if (heading) title = heading[1];
        completed = findLocalCompletion(content)?.checked || false;
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    return Object.assign(makeEntry(key, name || title, "markdown"), { file, completed });
}

async function readFolder(folder: string, key: string, result: IStudyPlanResult, depth: number): Promise<IStudyPlanEntry[]> {
    if (depth > 32) throw new Error("本地题目目录超过 32 层。");
    result.directories.add(folder);
    const entries = await fs.readdir(folder, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true }));
    const children: IStudyPlanEntry[] = [];
    for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.isSymbolicLink()) continue;
        const file = path.join(folder, entry.name);
        const childKey = key + ":" + entry.name;
        if (entry.isDirectory()) {
            const child = makeEntry(childKey, entry.name, "group");
            child.children = await readFolder(file, childKey, result, depth + 1);
            if (child.children.length) children.push(child);
        } else if (entry.isFile() && /\.md$/i.test(entry.name) && !/^readme\.md$/i.test(entry.name)) {
            result.dependencies.add(file);
            children.push(await readLocalProblem(file, childKey));
        }
    }
    return children;
}

interface ILink { href: string; name: string; }
function inlineLinks(token: any): ILink[] {
    const links: ILink[] = [];
    let current: ILink | undefined;
    for (const child of token.children || []) {
        if (child.type === "link_open") current = { href: child.attrGet("href") || "", name: "" };
        else if (child.type === "link_close" && current) { links.push(current); current = undefined; } else if (current) current.name += child.content || "";
    }
    return links;
}

async function readMarkdownIndex(file: string, source: IStudyPlanSource, key: string, result: IStudyPlanResult, mode: "links" | "leetcode"): Promise<IStudyPlanEntry[]> {
    const tokens = new MarkdownIt().parse(await fs.readFile(file, "utf8"), {});
    const root = makeEntry(key, "", "group");
    const stack = [{ level: 1, entry: root }];
    let rowLinks: ILink[] | undefined;
    let sequence = 0;
    const addLinks = async (links: ILink[]): Promise<void> => {
        const localLinks = links.filter((link) => !/^[a-z][a-z0-9+.-]*:|^\/\/|^#/i.test(link.href));
        // An OD row links to both its Markdown statement and Java answer: show one statement.
        const mdLinks = mode === "leetcode" ? [] : localLinks.filter((link) => /\.md(?:[?#]|$)/i.test(link.href));
        for (const link of mdLinks.length ? mdLinks : localLinks.filter((value) => /\.java(?:[?#]|$)/i.test(value.href))) {
            try {
                const target = resolveStudyPath(decodeURIComponent(link.href.split(/[?#]/)[0]), path.dirname(file), source.workspaceRoot);
                if (target === file) continue;
                result.dependencies.add(target);
                const childKey = key + ":link:" + sequence++;
                let child: IStudyPlanEntry;
                if (/\.md$/i.test(target)) {
                    child = await readLocalProblem(target, childKey, link.name);
                } else {
                    const text = await fs.readFile(target, "utf8");
                    const match = /@lc\s+app=leetcode(?:\.cn|\.com)?\s+id=(\d+)\b/.exec(text);
                    if (!match) continue; // Never interpret an OD article ID as a LeetCode question ID.
                    child = Object.assign(makeEntry(childKey, link.name || match[1], "leetcode"), { problemId: match[1] });
                }
                stack[stack.length - 1].entry.children.push(child);
            } catch (error) { result.errors.push(`${file} / ${link.name}：${error.message}`); }
        }
    };
    for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index];
        if (token.type === "heading_open") {
            const level = Number(token.tag.slice(1));
            if (level <= 1) { stack.splice(1); continue; }
            while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
            const group = makeEntry(key + ":heading:" + index, tokens[index + 1].content, "group");
            stack[stack.length - 1].entry.children.push(group);
            stack.push({ level, entry: group });
        } else if (token.type === "tr_open") rowLinks = [];
        else if (token.type === "tr_close") { await addLinks(rowLinks || []); rowLinks = undefined; } else if (token.type === "inline" && (index === 0 || tokens[index - 1].type !== "heading_open")) {
            const links = inlineLinks(token);
            if (rowLinks) rowLinks.push(...links); else await addLinks(links);
        }
    }
    const prune = (entries: IStudyPlanEntry[]): IStudyPlanEntry[] => entries.filter((entry) => {
        if (entry.kind !== "group") return true;
        entry.children = prune(entry.children);
        return entry.children.length > 0;
    });
    return prune(root.children);
}
