const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');
const { findLocalJavaFiles, localJavaCandidates } = require('../out/src/studyPlans/localJavaFiles');
let root, mapped, statements, opened, infos, errors, picks, previews, choose;
class LocalNode {
    constructor(file, javaFiles) { this.uri = { fsPath: file, scheme: 'file' }; this.entry = { kind: 'markdown', file, javaFiles }; }
}
const mocks = {
    vscode: { Uri: { file: fsPath => ({ fsPath, scheme: 'file' }) }, ViewColumn: { One: 1 },
        workspace: { asRelativePath: file => path.relative(root, file) },
        window: { showTextDocument: async (uri, options) => opened.push({ file: uri.fsPath, options }),
            showQuickPick: async items => { picks.push(items); return choose(items); },
            showInformationMessage: message => infos.push(message), showErrorMessage: message => errors.push(message) } },
    '../studyPlans/StudyPlanNode': { StudyPlanNode: LocalNode },
    '../studyPlans/studyPlanManager': { studyPlanManager: { getJavaFiles: () => mapped, getLocalProblems: () => statements } },
    '../webview/localMarkdownPreviewProvider': { localMarkdownPreviewProvider: { show: async (...args) => previews.push(args) } },
};
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) { return mocks[name] || originalLoad.call(this, name, parent, isMain); };
let start, preview;
try { ({ startLocalProblem: start, previewLocalMarkdown: preview } = require('../out/src/commands/localProblems')); }
finally { Module._load = originalLoad; }
beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'leetcode-local-java-'));
    mapped = []; statements = []; opened = []; infos = []; errors = []; picks = []; previews = []; choose = items => items[0];
});
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });
async function write(file, text) {
    const full = path.join(root, file); await fs.mkdir(path.dirname(full), { recursive: true }); await fs.writeFile(full, text); return full;
}

test('explicit associations take priority; Java candidates must be existing files and duplicates are removed', async () => {
    const md = await write('题目.md', '# 题目\n[其他代码](other.java)');
    const preferred = await write('code/Answer.java', 'class Answer {}');
    await write('other.java', 'class Other {}'); await write('题目.java', 'class SameName {}');
    assert.deepEqual(await findLocalJavaFiles(md, [preferred, preferred, path.join(root, 'missing.java')]), [preferred]);
    await fs.mkdir(path.join(root, 'not-a-file.java'));
    const resolved = await findLocalJavaFiles(md, [path.join(root, 'not-a-file.java')]);
    assert.deepEqual(resolved, [path.join(root, 'other.java'), path.join(root, '题目.java')]);
});

test('fallback association supports encoded Java links and same-name siblings, ignoring remote and example links', async () => {
    const md = await write('题目.md', '# 题目\n\n[Java](code/a%20b.java)\n[网站](https://example.com/Remote.java)\n\n```md\n[示例](Example.java)\n```');
    const linked = await write('code/a b.java', 'class A {}');
    await write('Example.java', 'class Example {}');
    assert.deepEqual(await findLocalJavaFiles(md), [linked]);
    const sameName = await write('题目.java', 'class Local {}');
    assert.deepEqual(await findLocalJavaFiles(md), [linked, sameName]);
    assert.deepEqual(localJavaCandidates(md, [], '[待创建](new.java)'), [path.join(root, 'new.java'), sameName]);
});

test('Start Coding opens the selected volume code and preserves existing source contents', async () => {
    const md = await write('problems/shared.md', '# 共用题面');
    const c = await write('cvolume/Answer.java', '// keep C volume code');
    const n = await write('newsystem/Answer.java', '// keep new system code');
    mapped = [c, n];
    await start(new LocalNode(md, [n]));
    assert.deepEqual(opened, [{ file: n, options: { preview: false, viewColumn: 1 } }]);
    assert.equal(picks.length, 0); assert.equal(await fs.readFile(n, 'utf8'), '// keep new system code');
    await preview(new LocalNode(md, [c]));
    assert.deepEqual(previews[0][1], [c]);
});

test('direct statement opens offer relative paths for multiple code files and cancellation opens nothing', async () => {
    const md = await write('shared.md', '# 共用题面');
    const c = await write('cvolume/Answer.java', 'class C {}'), n = await write('newsystem/Answer.java', 'class N {}');
    mapped = [c, n]; choose = () => undefined;
    await start({ fsPath: md, scheme: 'file' }); assert.deepEqual(opened, []);
    assert.deepEqual(picks[0].map(item => item.description), [path.relative(root, c), path.relative(root, n)]);
    choose = items => items[1]; await start({ fsPath: md, scheme: 'file' });
    assert.equal(opened[0].file, n);
});

test('deleted or absent Java files cause a hint without creating or modifying any code', async () => {
    const md = await write('statement.md', '# 题面'); const java = await write('Answer.java', 'class A {}');
    mapped = [java]; await fs.unlink(java);
    await start({ fsPath: md, scheme: 'file' });
    assert.equal(opened.length, 0); assert.match(infos[0], /未找到对应的 Java/);
    assert.deepEqual(await fs.readdir(root), ['statement.md']); assert.deepEqual(errors, []);
});

test('Java description opens the matching local statement and keeps the selected volume for Start Coding', async () => {
    const md = await write('problems/shared.md', '# 共用题面');
    const java = await write('cvolume/Answer.java', 'class Answer {}');
    statements = [{ file: md, name: '共用题面' }];
    await preview({ fsPath: java, scheme: 'file' });
    assert.deepEqual(previews, [[{ fsPath: md, scheme: 'file' }, [java], true]]);
    assert.deepEqual(opened, []); assert.deepEqual(picks, []);
});

test('ambiguous local statement descriptions allow choosing or cancelling and missing associations give a hint', async () => {
    const java = await write('Answer.java', 'class Answer {}');
    const a = await write('a.md', '# 第一题'), b = await write('b.md', '# 第二题');
    statements = [{ file: a, name: '第一题' }, { file: b, name: '第二题' }];
    choose = () => undefined;
    await preview({ fsPath: java, scheme: 'file' }); assert.deepEqual(previews, []);
    assert.deepEqual(picks[0].map(item => item.description), [path.relative(root, a), path.relative(root, b)]);
    choose = items => items[1]; await preview({ fsPath: java, scheme: 'file' });
    assert.equal(previews[0][0].fsPath, b); assert.deepEqual(previews[0][1], [java]);
    statements = []; await preview({ fsPath: java, scheme: 'file' });
    assert.equal(previews.length, 1); assert.match(infos[0], /未找到对应的本地题目/);
});
