import * as path from "path";
import * as MarkdownIt from "markdown-it";
import { URL } from "url";

const parser = new MarkdownIt({ html: false });

export function localHydroSubmissionUrl(content: string, file: string): string | undefined {
    const filename = /^\b(P\d+)[-.].+\.md$/i.exec(path.basename(file));
    if (!filename) return undefined;
    const expectedId = filename[1].toUpperCase();
    const ids: Set<string> = new Set();
    for (const token of parser.parse(content, {})) {
        if (token.type !== "inline" || !token.children || !/^(?:题目编号|在线练习|OJ题号)\s*[：:]/.test(token.content)) continue;
        for (const child of token.children) {
            if (child.type !== "link_open") continue;
            try {
                const url = new URL(child.attrGet("href") || "");
                if (url.protocol !== "https:" || url.hostname !== "hydro.ac" || url.port || url.username || url.password) continue;
                const problem = /^\/d\/hwod_oj\/p\/(P\d+)(?:\/submit)?\/?$/.exec(url.pathname);
                if (problem) ids.add(problem[1]);
            } catch (_) { /* Non-URL links do not identify an online problem. */ }
        }
    }
    return ids.size === 1 && ids.has(expectedId) ? `https://hydro.ac/d/hwod_oj/p/${expectedId}/submit` : undefined;
}
