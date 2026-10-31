export function parseProblemLanguages(description: string): string[] | undefined {
    const plain = description.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
    // Langs belongs to the CLI header, before its category/difficulty and HTML body.
    const header = plain.split(/^\* /m)[0];
    const match = /^Langs:[\t ]*([^\r\n]+)$/m.exec(header);
    if (!match) return undefined;
    const languages = match[1].trim().split(/\s+/);
    if (!languages.length || languages.some((language) => !/^[a-z][a-z0-9]*$/.test(language))) return undefined;
    return Array.from(new Set(languages));
}
