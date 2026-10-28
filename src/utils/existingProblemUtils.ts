import * as fse from "fs-extra";
import * as path from "path";

const ignoredDirectories = new Set(["node_modules", "target", "build", "out", "bin", "tmp", "temp"]);
const normalizeId = (id: string): string => /^\d+$/.test(id) ? id.replace(/^0+(?=\d)/, "") : id.trim();
const normalizeTitle = (title: string): string => title.replace(/[\s\p{P}\p{S}]/gu, "").toLowerCase();

function matchesProblem(file: string, content: string, root: string, id: string, name: string): boolean {
    const metadata = content.match(/^[ \t]*(?:(?:\/\/|#|\*|--|\/\*|<!--)[ \t]*)?@lc[ \t]+((?=[^\r\n]*\b(?:app|id)=)[^\r\n]*)/m);
    if (metadata) {
        const app = /\bapp=([^\s]+)/.exec(metadata[1]);
        const problemId = /\bid=([^\s]+)/.exec(metadata[1]);
        return (!app || /^(?:leetcode|leetcode\.cn)$/.test(app[1])) && !!problemId && normalizeId(problemId[1]) === id;
    }
    if (path.relative(root, file).split(path.sep).some((part) => /^od$/i.test(part))) return false;
    const stem = path.basename(file, path.extname(file));
    const numbered = /^(\d+)(?:[. _-]|$)/.exec(stem);
    if (numbered) return normalizeId(numbered[1]) === id;
    const legacy = /^leetcode[_-]?(\d+)$/i.exec(stem);
    if (legacy) return normalizeId(legacy[1]) === id;

    // Older Java files encode the question ID as the final underscore segment.
    // Limit this fallback to the LeetCode tree and reject a conflicting title:
    // String_3_54.java is a different platform's exercise, not LeetCode 54.
    const suffix = /_(\d+)$/.exec(stem);
    if (!suffix || normalizeId(suffix[1]) !== id || !path.relative(root, file).split(path.sep).some((part) => /^leetcode$/i.test(part))) return false;
    const heading = content.split(/\r?\n/, 40).join("\n").match(/^[ \t]*\/\/[ \t]*\d+[.、][ \t]*(.+)$/m);
    return !heading || normalizeTitle(heading[1]) === normalizeTitle(name);
}

export async function findExistingProblemFiles(root: string, id: string, name: string, extensions: readonly string[]): Promise<string[]> {
    const supported = new Set(extensions.map((extension) => "." + extension.toLowerCase()));
    const matches: string[] = [];
    async function visit(directory: string): Promise<void> {
        let entries;
        try { entries = await fse.readdir(directory, { withFileTypes: true }); } catch (error) {
            if (error.code === "ENOENT" || error.code === "ENOTDIR") return;
            throw error;
        }
        for (const entry of entries) {
            const file = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                if (!entry.name.startsWith(".") && !ignoredDirectories.has(entry.name.toLowerCase())) await visit(file);
            } else if (entry.isFile() && supported.has(path.extname(entry.name).toLowerCase())) {
                try {
                    const content = await fse.readFile(file, "utf8");
                    if (matchesProblem(file, content, root, normalizeId(id), name)) matches.push(file);
                } catch (error) {
                    if (error.code !== "ENOENT") throw error;
                }
            }
        }
    }
    await visit(root);
    return matches.sort((left, right) => left.localeCompare(right));
}
