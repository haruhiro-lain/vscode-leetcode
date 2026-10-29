import * as path from "path";
import { fileURLToPath } from "url";

export function localMarkdownTarget(href: string, file: string): { file: string; fragment: string } | undefined {
    if (!href || href.startsWith("#") || /^(?!file:)[a-z][a-z0-9+.-]*:|^\/\//i.test(href)) return undefined;
    try {
        const hash = href.indexOf("#");
        const fragment = hash < 0 ? "" : decodeURIComponent(href.slice(hash + 1));
        const location = (hash < 0 ? href : href.slice(0, hash)).split("?")[0];
        const target = /^file:/i.test(location) ? fileURLToPath(location) : path.resolve(path.dirname(file), decodeURIComponent(location));
        return { file: target, fragment };
    } catch (_) { return undefined; }
}

export function escapeLocalHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
}

export function localMarkdownHtml(body: string, styles: string, cspSource: string, nonce: string, fragment: string, documentUri: string = ""): string {
    const anchor = JSON.stringify(fragment).replace(/</g, "\\u003c");
    const document = JSON.stringify(documentUri).replace(/</g, "\\u003c");
    return `<!DOCTYPE html><html><head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${escapeLocalHtml(cspSource)} https: data:; style-src ${escapeLocalHtml(cspSource)} 'unsafe-inline'; script-src 'nonce-${nonce}';">
        ${styles}
        <style>body { padding-bottom: 4rem; } code { white-space: pre-wrap; }
        .local-toolbar { position: sticky; top: 0; display: flex; align-items: center; gap: 0.6rem; padding: 0.6rem 0; background: var(--vscode-editor-background); }
        button { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; padding: 0.35rem 0.7rem; cursor: pointer; }
        button:hover { background: var(--vscode-button-hoverBackground); } h1,h2,h3,h4,h5,h6 { scroll-margin-top: 4rem; }</style>
        </head><body><div class="local-toolbar"><span>本地题目</span><button id="source">打开源文件</button><button id="refresh">刷新</button></div>
        ${body}
        <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        document.getElementById('source').onclick = () => vscode.postMessage({command: 'openSource'});
        document.getElementById('refresh').onclick = () => vscode.postMessage({command: 'refresh'});
        const completion = document.getElementById('local-completion');
        if (completion) completion.onchange = () => {
            completion.disabled = true;
            vscode.postMessage({command: 'setPassed', checked: completion.checked, document: ${document}});
        };
        document.addEventListener('click', event => {
            const link = event.target.closest && event.target.closest('a');
            if (!link) return;
            const href = link.getAttribute('href') || '';
            if (href.startsWith('#')) return;
            event.preventDefault(); vscode.postMessage({command: 'openLink', href});
        });
        const anchor = ${anchor};
        if (anchor) document.getElementById(anchor)?.scrollIntoView();
        </script></body></html>`;
}
