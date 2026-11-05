import * as path from "path";
import * as MarkdownIt from "markdown-it";

export function findLocalProblemId(content: string, file: string): string | undefined {
    const tokens = new MarkdownIt().parse(content, {});
    const headingIndex = tokens.findIndex((token) => token.type === "heading_open" && token.tag === "h1");
    const heading = headingIndex < 0 ? undefined : /^\s*\[([Pp]\d+|\d+)\](?:\s|$)/.exec(tokens[headingIndex + 1]?.content || "");
    if (heading) return heading[1].toUpperCase();
    for (const token of tokens) {
        if (token.type !== "inline") continue;
        const match = /^题目编号\s*[：:]\s*\[?([Pp]\d+|\d+)\b/.exec(token.content.trim());
        if (match) return match[1].toUpperCase();
    }
    return /^([Pp]\d+|\d+)(?=[._\s-]|$)/.exec(path.basename(file, path.extname(file)))?.[1].toUpperCase();
}

export function formatLocalProblemLabel(name: string, problemId?: string): string {
    if (!problemId) return name;
    const prefix = /^\s*\[([Pp]\d+|\d+)\]\s*/.exec(name);
    const title: string = prefix && prefix[1].toUpperCase() === problemId ? name.slice(prefix[0].length) : name;
    return `[${problemId}]${title ? " " + title : ""}`;
}
