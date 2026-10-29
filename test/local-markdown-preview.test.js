const assert = require('node:assert/strict');
const { test, beforeEach } = require('node:test');
const path = require('node:path');
const { pathToFileURL, fileURLToPath } = require('node:url');
const Module = require('node:module');
const { localMarkdownTarget, localMarkdownHtml } = require('../out/src/webview/localMarkdownHtml');
const { findLocalCompletion } = require('../out/src/studyPlans/localCompletion');
const root = path.resolve('local-preview-fixture');
class Uri {
    constructor(url) { this.url = new URL(url); }
    static file(file) { return new Uri(pathToFileURL(file)); }
    static parse(url) { return new Uri(url); }
    get fsPath() { return fileURLToPath(this.url); }
    get scheme() { return this.url.protocol.slice(0, -1); }
    get fragment() { return decodeURIComponent(this.url.hash.slice(1)); }
    with(values) { const next = new Uri(this.url); if (values.fragment !== undefined) next.url.hash = values.fragment; if (values.query !== undefined) next.url.search = values.query; return next; }
    toString() { return this.url.toString(); }
}
let documents, panels, opened, external, errors, documentChanged, provider, warnings, refreshed, saved, applyResult, saveResult;
const noopDisposable = () => ({ dispose() {} });
const vscode = {
    Uri, ViewColumn: { One: 1, Two: 2 }, env: { appRoot: root, openExternal: async uri => external.push(uri.toString()) },
    Range: class { constructor(start, end) { this.start = start; this.end = end; } },
    WorkspaceEdit: class { constructor() { this.changes = []; } replace(uri, range, text) { this.changes.push({ uri, range, text }); } },
    commands: { executeCommand: async command => { if (command === 'leetcode.refreshStudyPlans') refreshed++; } },
    workspace: {
        onDidChangeConfiguration: noopDisposable,
        getConfiguration: () => ({ get: (_key, fallback) => fallback, inspect: () => ({ defaultValue: '' }) }),
        getWorkspaceFolder: () => ({ uri: Uri.file(root) }),
        onDidChangeTextDocument: fn => { documentChanged = fn; return noopDisposable(); },
        openTextDocument: async uri => {
            const doc = documents.get(uri.fsPath); if (!doc) throw Error('ENOENT: ' + uri.fsPath); return doc;
        },
        applyEdit: async edit => {
            if (!applyResult) return false;
            for (const change of edit.changes) {
                const doc = documents.get(change.uri.fsPath);
                doc.text = doc.text.slice(0, change.range.start) + change.text + doc.text.slice(change.range.end);
                doc.isDirty = true; documentChanged({ document: doc });
            }
            return true;
        },
    },
    window: {
        showErrorMessage: message => errors.push(message), showTextDocument: async uri => opened.push(uri.fsPath),
        showWarningMessage: message => warnings.push(message),
        createWebviewPanel: (type, title, column, options) => {
            let dispose, receive;
            const panel = { type, title, column, options, reveal() {},
                dispose() { if (dispose) dispose(); },
                onDidDispose(fn, context) { dispose = () => fn.call(context); return noopDisposable(); },
                webview: { html: '', cspSource: 'https://webview.example',
                    asWebviewUri: uri => ({ toString: () => 'https://webview.example/' + encodeURIComponent(uri.fsPath) }),
                    onDidReceiveMessage(fn, context) { receive = message => fn.call(context, message); return noopDisposable(); },
                },
                message: message => receive(message),
            }; panels.push(panel); return panel;
        },
    },
};
const mocks = { vscode, '../leetCodeChannel': { leetCodeChannel: { appendLine() {} } },
    '../utils/osUtils': { isWindows: () => false }, '../utils/uiUtils': { promptHintMessage: async () => {}, openSettingsEditor() {} } };
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) { return mocks[name] || originalLoad.call(this, name, parent, isMain); };
let Preview, engine;
try {
    ({ LocalMarkdownPreviewProvider: Preview } = require('../out/src/webview/localMarkdownPreviewProvider'));
    ({ markdownEngine: engine } = require('../out/src/webview/markdownEngine'));
} finally { Module._load = originalLoad; }
function document(file, text) {
    const uri = Uri.file(path.join(root, file)); const doc = { uri, text, isDirty: false, getText() { return this.text; }, positionAt: offset => offset,
        async save() { if (!saveResult) return false; this.isDirty = false; saved.push(this.uri.fsPath); return true; } };
    documents.set(uri.fsPath, doc); return doc;
}
beforeEach(() => { documents = new Map(); panels = []; opened = []; external = []; errors = []; warnings = []; refreshed = 0; saved = []; applyResult = true; saveResult = true; provider = new Preview(); });

test('local statements render tables, highlighted code, images and relative document links in the plugin panel', async () => {
    const doc = document('题目/一.md', '# 一道题\n\n| 输入 | 输出 |\n|---|---|\n| 1 | 2 |\n\n```java\nint n = 1;\n```\n\n![图](images/a%20b.png)\n[下一题](二.md#示例)\n\n## 示例\n正文');
    await provider.show(doc.uri);
    assert.equal(errors.length, 0); assert.equal(panels.length, 1);
    const panel = panels[0], html = panel.webview.html;
    assert.equal(panel.type, 'leetcode.localMarkdown');
    assert.match(panel.title, /题目描述/);
    assert.match(html, /<table>/); assert.match(html, /hljs-keyword/);
    assert.match(html, /id="示例"/);
    assert.match(html, /https:\/\/webview.example\//);
    assert.ok(html.includes(encodeURIComponent(path.join(root, '题目/images/a b.png'))));
    assert.ok(html.includes(Uri.file(path.join(root, '题目/二.md')).with({ fragment: '示例' }).toString()));
    assert.equal(panel.webview.options.enableCommandUris, false);
    assert.ok(panel.webview.options.localResourceRoots.some(uri => uri.fsPath === root));
    assert.match(html, /script-src 'nonce-[a-f0-9]+'/);
    provider.dispose();
});

test('Markdown, Java and external links use the proper preview/editor/browser and source edits refresh', async () => {
    const first = document('one.md', '# 第一题'); const second = document('二.md', '# 第二题\n## 示例');
    await provider.show(first.uri); const panel = panels[0];
    await panel.message({ command: 'openSource' }); assert.deepEqual(opened, [first.uri.fsPath]);
    first.text = '# 未保存的修改'; documentChanged({ document: first });
    assert.match(panel.webview.html, /未保存的修改/);
    await panel.message({ command: 'openLink', href: '二.md#示例' });
    assert.equal(panels.length, 1); assert.match(panel.webview.html, /第二题/);
    await panel.message({ command: 'openLink', href: '../Answer.java' });
    assert.equal(opened.at(-1), path.join(path.dirname(root), 'Answer.java'));
    await panel.message({ command: 'openLink', href: 'https://leetcode.cn/' });
    assert.deepEqual(external, ['https://leetcode.cn/']);
    await panel.message({ command: 'openLink', href: 'command:workbench.action.closeWindow' });
    assert.equal(external.length, 1);
    await panel.message({ command: 'openLink', href: 'missing.md' });
    assert.match(errors[0], /无法读取本地题目/);
    await panel.message({ command: 'refresh' }); assert.match(panel.webview.html, /第二题/);
    assert.equal(second.uri.fsPath, path.join(root, '二.md'));
    provider.dispose();
});

test('local Markdown escapes raw HTML, rejects command links and confines executable script to the toolbar', async () => {
    const doc = document('unsafe.md', '# 标题\n\n<script>alert(1)</script>\n\n[运行](command:evil)\n\n```html\n<img src=x onerror=evil()>\n```');
    await provider.show(doc.uri);
    const html = panels[0].webview.html;
    assert.equal(html.includes('<script>alert(1)</script>'), false);
    assert.equal(html.includes('href="command:evil"'), false);
    assert.match(html, /&lt;script&gt;/);
    assert.equal((html.match(/<script\b/g) || []).length, 1);
    assert.equal(localMarkdownHtml('', '', 'https://webview.example', 'abc123', '</script><script>evil()</script>').includes('const anchor = "</script>'), false);
    provider.dispose();
});

test('relative paths decode Chinese and spaces, fragments work and remote URLs stay separate', () => {
    const file = path.join(root, 'docs/one.md');
    assert.deepEqual(localMarkdownTarget('../%E9%A2%98%E7%9B%AE/a%20b.md#%E7%A4%BA%E4%BE%8B', file), { file: path.join(root, '题目/a b.md'), fragment: '示例' });
    assert.equal(localMarkdownTarget('https://example.com/a.md', file), undefined);
    assert.equal(localMarkdownTarget('command:evil', file), undefined);
    assert.equal(localMarkdownTarget('//example.com/a.md', file), undefined);
    assert.equal(localMarkdownTarget('#anchor', file), undefined);
    assert.equal(localMarkdownTarget('bad%xx.md', file), undefined);
    const html = engine.render('## 同名\n## 同名', { localMarkdown: true });
    assert.match(html, /id="同名"/); assert.match(html, /id="同名-1"/);
});

test('non-Markdown inputs are rejected without creating a panel', async () => {
    await provider.show(Uri.file(path.join(root, 'Answer.java')));
    assert.equal(panels.length, 0); assert.match(errors[0], /\.md/);
});

test('preview checkbox persists only the Markdown marker and supports unchecking without duplicates', async () => {
    const doc = document('question.md', '# 本地题\n\n题面内容');
    await provider.show(doc.uri); const panel = panels[0];
    assert.equal((panel.webview.html.match(/type="checkbox"/g) || []).length, 1);
    assert.equal(findLocalCompletion(doc.text), undefined);
    await panel.message({ command: 'setPassed', checked: true, document: doc.uri.toString() });
    assert.equal(findLocalCompletion(doc.text).checked, true);
    assert.deepEqual(saved, [doc.uri.fsPath]); assert.equal(refreshed, 1);
    assert.match(panel.webview.html, /id="local-completion" checked/);
    assert.ok(doc.text.includes('题面内容'));
    await panel.message({ command: 'setPassed', checked: false, document: doc.uri.toString() });
    assert.equal(findLocalCompletion(doc.text).checked, false);
    assert.equal(doc.text.split('<!-- leetcode-cn:passed -->').length - 1, 1);
    assert.equal(refreshed, 2); assert.equal(errors.length, 0);
    provider.dispose();
});

test('stale preview messages and dirty documents cannot overwrite or save unrelated edits', async () => {
    const first = document('first.md', '# 第一题'), second = document('second.md', '# 第二题');
    await provider.show(first.uri); const panel = panels[0]; await provider.show(second.uri);
    await panel.message({ command: 'setPassed', checked: true, document: first.uri.toString() });
    assert.equal(findLocalCompletion(second.text), undefined);
    second.isDirty = true;
    await panel.message({ command: 'setPassed', checked: true, document: second.uri.toString() });
    assert.match(warnings[0], /未保存/); assert.deepEqual(saved, []);
    assert.equal(findLocalCompletion(second.text), undefined);
    provider.dispose();
});

test('failed edits do not update progress and save failures are reported', async () => {
    const doc = document('question.md', '# 本地题'); await provider.show(doc.uri); const panel = panels[0];
    applyResult = false;
    await panel.message({ command: 'setPassed', checked: true, document: doc.uri.toString() });
    assert.equal(findLocalCompletion(doc.text), undefined); assert.equal(refreshed, 0);
    assert.match(errors[0], /更新通过状态失败/);
    applyResult = true; saveResult = false;
    await panel.message({ command: 'setPassed', checked: true, document: doc.uri.toString() });
    assert.equal(refreshed, 0); assert.match(errors[1], /尚未保存/);
    provider.dispose();
});

test('marker examples inside code and blockquotes never produce extra interactive checkboxes', async () => {
    const marker = '<!-- leetcode-cn:passed -->';
    const doc = document('example.md', '# 本地题\n\n```md\n- [x] 已通过 ' + marker + '\n```\n\n> - [x] 已通过 ' + marker);
    await provider.show(doc.uri);
    assert.equal((panels[0].webview.html.match(/type="checkbox"/g) || []).length, 1);
    assert.doesNotMatch(panels[0].webview.html, /id="local-completion" checked/);
    provider.dispose();
});
