// Java source ranges are computed from tokens so comments, strings and nested
// braces cannot make one implementation consume the next one.
export interface IJavaSolutionTarget {
    name: string;
    start: number;
}

export interface IToken {
    value: string;
    start: number;
    end: number;
    parent?: number;
}

export interface IJavaType extends IJavaSolutionTarget {
    declarationStart: number;
    kind: string;
    open: number;
    end: number;
    parent?: number;
}

function tokenize(source: string): IToken[] {
    const tokens: IToken[] = [];
    const braces: number[] = [];
    let i: number = 0;
    while (i < source.length) {
        const start: number = i;
        if (/\s/.test(source[i])) {
            i++;
        } else if (source.substr(i, 2) === "//") {
            while (i < source.length && source[i] !== "\n" && source[i] !== "\r") i++;
        } else if (source.substr(i, 2) === "/*") {
            const end: number = source.indexOf("*/", i + 2);
            i = end < 0 ? source.length : end + 2;
        } else if (source[i] === '"' || source[i] === "'") {
            const delimiter: string = source.substr(i, 3) === '"""' ? '"""' : source[i];
            i += delimiter.length;
            while (i < source.length) {
                if (source[i] === "\\") i += 2;
                else if (source.substr(i, delimiter.length) === delimiter) {
                    i += delimiter.length;
                    break;
                } else i++;
            }
        } else {
            if (/[A-Za-z_$]/.test(source[i])) {
                while (i < source.length && /[A-Za-z0-9_$]/.test(source[i])) i++;
            } else i++;
            const value: string = source.slice(start, i);
            if (value === "}") braces.pop();
            tokens.push({ value, start, end: i, parent: braces[braces.length - 1] });
            if (value === "{") braces.push(tokens.length - 1);
        }
    }
    return tokens;
}

function parseTypes(tokens: IToken[]): IJavaType[] {
    const types: IJavaType[] = [];
    const ends: Map<number, number> = new Map<number, number>();
    // A closing brace's parent is the opening brace's parent. Use a separate
    // stack to pair braces, including anonymous classes and method bodies.
    const stack: number[] = [];
    tokens.forEach((token, i) => {
        if (token.value === "{") stack.push(i);
        else if (token.value === "}") {
            const open: number | undefined = stack.pop();
            if (open !== undefined) ends.set(open, token.end);
        }
    });
    tokens.forEach((token, i) => {
        if (["class", "interface", "enum", "record"].indexOf(token.value) < 0 ||
            tokens[i - 1]?.value === "." || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(tokens[i + 1]?.value || "")) return;
        let parentheses: number = 0;
        for (let j: number = i + 2; j < tokens.length; j++) {
            const value: string = tokens[j].value;
            if (value === "(") parentheses++;
            if (value === ")") parentheses--;
            if (value === ";" && parentheses === 0) break;
            if (value !== "{" || parentheses !== 0) continue;
            const end: number | undefined = ends.get(j);
            let declaration: number = i - 1;
            while (declaration >= 0 && declaration !== token.parent &&
                !(tokens[declaration].parent === token.parent && [";", "}"].indexOf(tokens[declaration].value) >= 0)) declaration--;
            if (end !== undefined) types.push({
                name: tokens[i + 1].value, start: token.start, kind: token.value,
                open: j, end, parent: token.parent, declarationStart: tokens[declaration + 1].start,
            });
            break;
        }
    });
    return types;
}

function solutionTypes(types: IJavaType[]): IJavaType[] {
    return types.filter((type) => type.kind === "class" && /^Solution[A-Za-z0-9_$]*$/.test(type.name) &&
        (type.parent === undefined || types.some((parent) => parent.open === type.parent)));
}

export function analyzeJavaSource(source: string): { tokens: IToken[]; types: IJavaType[] } {
    const tokens: IToken[] = tokenize(source);
    return { tokens, types: parseTypes(tokens) };
}

export function findJavaSolutions(source: string): IJavaSolutionTarget[] {
    return solutionTypes(parseTypes(tokenize(source))).map(({ name, start }) => ({ name, start }));
}

function renamedClass(source: string, type: IJavaType, tokens: IToken[], oldName?: string, excluded: IJavaType[] = []): string {
    const edits: Array<{ start: number; end: number; text: string }> = excluded.map((child) => ({
        start: child.declarationStart, end: child.end, text: "",
    }));
    for (const token of tokens) {
        if (token.start < type.start || token.end > type.end || !oldName || token.value !== oldName ||
            excluded.some((child) => token.start >= child.declarationStart && token.end <= child.end)) continue;
        edits.push({ start: token.start, end: token.end, text: "Solution" });
    }
    let result: string = "";
    let offset: number = type.start;
    for (const edit of edits.sort((a, b) => a.start - b.start)) {
        if (edit.start < offset) continue;
        result += source.slice(offset, edit.start) + edit.text;
        offset = edit.end;
    }
    return (result + source.slice(offset, type.end)).replace(/^[ \t]*\/\/[ \t]*@lc code=(?:start|end)[^\r\n]*(?:\r?\n|$)/gm, "");
}

export function buildJavaSubmission(source: string, target: IJavaSolutionTarget): string {
    const tokens: IToken[] = tokenize(source);
    const types: IJavaType[] = parseTypes(tokens);
    const selected: IJavaType | undefined = solutionTypes(types).find((type) => type.name === target.name && type.start === target.start);
    if (!selected) throw new Error("所选解法已变化或类的大括号不完整，请重新点击该类上方的入口。");
    const metadata: RegExpMatchArray | null = source.match(/@lc\s+app=\S+\s+id=\S+\s+lang=java\b/);
    if (!metadata) throw new Error("Java 题解缺少 @lc app=… id=… lang=java 题目标记。");

    // Design problems may use Solution2 only as a local container for MyStack,
    // MyQueue, etc. Submit that single inner type under its original judge name.
    const children: IJavaType[] = types.filter((type) => type.parent === selected.open);
    let judgeType: IJavaType = selected;
    if (children.length === 1 && !/^Solution[A-Za-z0-9_$]*$/.test(children[0].name)) {
        const child: IJavaType = children[0];
        const outside: IToken[] = tokens.filter((token) => token.start > tokens[selected.open].start &&
            token.end < selected.end && (token.start < child.start || token.end > child.end));
        if (outside.every((token) => ["public", "private", "protected", "static", "final", "abstract", "strictfp"].indexOf(token.value) >= 0)) {
            judgeType = child;
        }
    }

    const imports: string[] = [];
    tokens.forEach((token, i) => {
        if (token.value !== "import" || token.parent !== undefined) return;
        const end: IToken | undefined = tokens.slice(i).find((candidate) => candidate.value === ";");
        if (end) imports.push(source.slice(token.start, end.end));
    });

    // Keep referenced sibling/top-level helper types, but leave the local
    // harness and LeetCode-provided node stubs out of the judge source.
    const helpers: IJavaType[] = types.filter((type) => type !== selected &&
        (type.parent === selected.parent || type.parent === undefined) &&
        !/^Solution[A-Za-z0-9_$]*$/.test(type.name) &&
        !(type.start < selected.start && type.end > selected.end) &&
        ["ListNode", "TreeNode", "Node"].indexOf(type.name) < 0);
    const included: IJavaType[] = [judgeType];
    for (const current of included) {
        const identifiers: Set<string> = new Set(tokens.filter((token) =>
            token.start >= current.start && token.end <= current.end).map((token) => token.value));
        for (const helper of helpers) {
            if (identifiers.has(helper.name) && included.indexOf(helper) < 0) included.push(helper);
        }
    }
    const code: string = imports.concat(included.map((type) => {
        const nestedSolutions: IJavaType[] = solutionTypes(types).filter((child) => child.start > type.start && child.end < type.end);
        return renamedClass(source, type, tokens, type === selected ? selected.name : undefined, nestedSolutions);
    })).join("\n\n");
    return `// ${metadata[0]}\n// @lc code=start\n${code}\n// @lc code=end\n`;
}
