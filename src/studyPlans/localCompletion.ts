export const completionMarker = "<!-- leetcode-cn:passed -->";
export const completionLine = /^ {0,3}[-*+] \[([ xX])\] 已通过\s+<!-- leetcode-cn:passed -->\s*$/;
export const completionInline = /^\[([ xX])\] 已通过\s+<!-- leetcode-cn:passed -->\s*$/;

interface ICompletionPosition { checked: boolean; offset: number; }

function* documentLines(content: string): IterableIterator<{ text: string; offset: number }> {
    let offset = 0;
    let fence = "";
    const frontMatter = /^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(content);
    for (const text of content.split("\n")) {
        if (!frontMatter || offset >= frontMatter[0].length) {
            const delimiter = /^ {0,3}(`{3,}|~{3,})/.exec(text);
            if (delimiter) {
                if (!fence) fence = delimiter[1];
                else if (delimiter[1][0] === fence[0] && delimiter[1].length >= fence.length) fence = "";
            } else if (!fence) yield { text, offset };
        }
        offset += text.length + 1;
    }
}

// Only the dedicated marker outside code fences is authoritative. Other task lists are unrelated.
export function findLocalCompletion(content: string): ICompletionPosition | undefined {
    let found: ICompletionPosition | undefined;
    for (const line of documentLines(content)) {
        const match = completionLine.exec(line.text);
        if (match) {
            if (found) throw new Error("本地题目中存在多个通过标记，请只保留标题下的一处。");
            found = { checked: match[1].toLowerCase() === "x", offset: line.offset + line.text.indexOf("[") + 1 };
        }
    }
    return found;
}

export function completionEdit(content: string, checked: boolean): { start: number; end: number; text: string } {
    const found = findLocalCompletion(content);
    if (found) return { start: found.offset, end: found.offset + 1, text: checked ? "x" : " " };
    const eol = content.indexOf("\r\n") >= 0 ? "\r\n" : "\n";
    const line = `- [${checked ? "x" : " "}] 已通过 ${completionMarker}`;
    for (const lineInfo of documentLines(content)) {
        if (!/^\uFEFF?# /.test(lineInfo.text)) continue;
        const nextLine = lineInfo.offset + lineInfo.text.length;
        const hasNewline = content[nextLine] === "\n";
        const headingEnd = nextLine + (hasNewline ? 1 : 0);
        const prefix = hasNewline ? eol : eol + eol;
        const suffix = content.slice(headingEnd).startsWith(eol) ? "" : eol;
        return { start: headingEnd, end: headingEnd, text: prefix + line + eol + suffix };
    }
    // Keep front matter intact when a document has no level-one title.
    const frontMatter = /^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(content);
    const position = frontMatter ? frontMatter[0].length : content.charCodeAt(0) === 0xFEFF ? 1 : 0;
    const fallbackPrefix = frontMatter && !/\n$/.test(frontMatter[0]) ? eol + eol : "";
    return { start: position, end: position, text: fallbackPrefix + line + eol + eol };
}

export function withLocalCompletion(content: string, checked: boolean): string {
    const edit = completionEdit(content, checked);
    return content.slice(0, edit.start) + edit.text + content.slice(edit.end);
}
