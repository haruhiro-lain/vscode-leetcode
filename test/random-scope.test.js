const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');
let root, roots, problems, listed, decisions, picks, generated, opened, previews, localStarts, queries, infos, errors, user, premium, hidden, listCalls, workspaceCalls, languageSupport;
class StudyPlanNode {
    constructor(entry) { this.entry = entry; this.id = entry.id; this.name = entry.name; this.uri = { fsPath: entry.file, scheme: 'file' }; }
}
const mocks = {
    vscode: { env: { appName: 'VS Code', uriScheme: 'vscode' }, Uri: { file: fsPath => ({ fsPath }) }, ViewColumn: { One: 1 },
        workspace: { getConfiguration: () => ({ get: (key, fallback) => ({ defaultLanguage: 'java', 'filePath.default.filename': '${id}.answer.${ext}' })[key] ?? fallback }) },
        window: { showQuickPick: async (items, options) => { picks.push({ items, options }); return decisions.length ? decisions.shift()(items) : items[0]; },
            showInformationMessage: message => infos.push(message), showTextDocument: async uri => opened.push(uri.fsPath) } },
    '../studyPlans/StudyPlanNode': { StudyPlanNode },
    '../studyPlans/studyPlanManager': { studyPlanManager: { refresh: async () => {}, getRoots: () => roots } },
    '../explorer/explorerNodeManager': { explorerNodeManager: { getAllNodes: () => problems, getNodeById: id => problems.find(problem => problem.id === id) } },
    '../explorer/LeetCodeNode': { LeetCodeNode: class {} },
    '../leetCodeChannel': { leetCodeChannel: { appendLine() {} } },
    '../leetCodeManager': { leetCodeManager: { getUser: () => user } },
    '../globalState': { globalState: { getUserStatus: () => ({ isPremium: premium }) } },
    '../leetCodeExecutor': { leetCodeExecutor: { getProblemLanguages: async id => { queries.push(id); return languageSupport[id] || ['java']; },
        showProblem: async (problem, language, file) => generated.push({ id: problem.id, language, file }) } },
    '../utils/workspaceUtils': { selectWorkspaceFolder: async () => { workspaceCalls++; return root; } },
    '../utils/wslUtils': { useWsl: () => false },
    '../utils/settingUtils': { shouldUseEndpointTranslation: () => true, shouldHideSolvedProblem: () => hidden,
        getDescriptionConfiguration: () => ({ showInComment: false, showInWebview: false }) },
    '../utils/uiUtils': { promptHintMessage: async () => {}, promptForSignIn: () => infos.push('login') },
    '../utils/commandErrorUtils': { handleCommandError: async error => errors.push(error) },
    '../webview/leetCodePreviewProvider': {}, '../webview/leetCodeSolutionProvider': {},
    './localProblems': { startLocalProblem: async node => localStarts.push(node.entry), previewLocalMarkdown: async node => previews.push(node.entry) },
    './plugin': { getLeetCodeEndpoint: () => 'leetcode-cn' }, './list': { listProblems: async () => { listCalls++; return listed; } },
};
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) { return mocks[name] || originalLoad.call(this, name, parent, isMain); };
let pickOne, randomScopes, randomCandidates, nativeScopeValues, Category;
try {
    ({ pickOne } = require('../out/src/commands/show'));
    ({ randomScopes, randomCandidates, nativeScopeValues } = require('../out/src/utils/randomProblemUtils'));
    ({ Category } = require('../out/src/shared'));
} finally { Module._load = originalLoad; }
const problem = (id, extra = {}) => ({ id, name: 'Q' + id, tags: ['array'], companies: ['Foo'], difficulty: 'Easy',
    state: 3, locked: false, isFavorite: false, passRate: '50 %', ...extra });
const group = (id, children) => ({ id, name: id, kind: 'group', children });
const lc = id => ({ id: 'ref-' + id, name: 'Q' + id, kind: 'leetcode', problemId: id, children: [] });
const md = (file, extra = {}) => ({ id: file, name: path.basename(file), kind: 'markdown', file, children: [], ...extra });
beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'leetcode-random-scope-'));
    roots = []; problems = []; listed = []; decisions = []; picks = []; generated = []; opened = []; previews = []; localStarts = []; queries = []; infos = []; errors = [];
    user = 'fixture'; premium = false; hidden = false; listCalls = 0; workspaceCalls = 0; languageSupport = {};
});
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });
const choosePlan = id => items => items.find(item => item.plan?.id === id);

test('scope picker always includes combined All, every built-in and custom plans in configured order', () => {
    const hot = group('Hot100', []), od = group('OD', []);
    const scopes = randomScopes([{ id: 'Hot100', name: 'Hot100', entry: hot }, { id: Category.Favorite, name: '我的收藏' }, { id: 'OD', name: 'OD', entry: od }]);
    assert.equal(scopes[0].all, true);
    assert.deepEqual(scopes.slice(1, 4).map(item => item.label), ['Hot100', '力扣 / 我的收藏', 'OD']);
    assert.deepEqual(new Set(scopes.filter(item => item.builtin).map(item => item.builtin)), new Set(Object.values(Category)));
});

test('cancel at the first picker performs no login, remote query, language selection or file operation', async () => {
    decisions = [() => undefined]; user = undefined;
    await pickOne();
    assert.match(picks[0].options.placeHolder, /请选择.*题单/); assert.equal(picks.length, 1);
    assert.deepEqual([queries.length, generated.length, opened.length, workspaceCalls, listCalls, infos.length], [0, 0, 0, 0, 0, 0]);
});

test('a custom plan includes nested modules but never draws from outside the selected IDs', async () => {
    const hot = group('Hot100', [group('module', [lc('2'), lc('2'), lc('3')])]); roots = [new StudyPlanNode(hot)];
    problems = [problem('1'), problem('2'), problem('3')]; decisions = [choosePlan('Hot100')];
    await pickOne();
    assert.equal(generated.length, 1); assert.ok(['2', '3'].includes(generated[0].id)); assert.equal(listCalls, 0);
    assert.equal(queries.length, 1); assert.deepEqual(errors, []);
});

test('missing custom IDs can refresh the remote list without widening the selected range', async () => {
    roots = [new StudyPlanNode(group('Hot100', [lc('2')]))]; problems = [problem('1')]; listed = [problem('1'), problem('2')];
    decisions = [choosePlan('Hot100')]; await pickOne();
    assert.equal(listCalls, 1); assert.deepEqual(queries, ['2']); assert.equal(generated[0].id, '2');
});

test('a selected SQL-only plan exhausts its own pool without falling back to compatible Java questions outside it', async () => {
    roots = [new StudyPlanNode(group('SQL', [lc('2')]))]; problems = [problem('1'), problem('2')]; languageSupport['2'] = ['mysql', 'pythondata'];
    decisions = [choosePlan('SQL')]; await pickOne();
    assert.deepEqual(queries, ['2']); assert.deepEqual(generated, []); assert.match(infos[0], /所选范围.*支持 java/);
});

test('native difficulty, tag, company and favorite selections all restrict the random pool', async () => {
    problems = [problem('1'), problem('2', { difficulty: 'Hard', tags: ['tree'], companies: ['Bar'], isFavorite: true }),
        problem('3', { difficulty: 'Medium', tags: ['string'], companies: ['Baz'] })];
    for (const [category, value, expected] of [[Category.Difficulty, 'Hard', '2'], [Category.Tag, 'string', '3'],
        [Category.Company, 'Foo', '1'], [Category.Favorite, undefined, '2']]) {
        decisions = [items => items.find(item => item.builtin === category)];
        if (value) decisions.push(items => items.find(item => item.value === value));
        generated = []; queries = []; await pickOne();
        assert.deepEqual(queries, [expected]); assert.equal(generated[0].id, expected);
    }
    assert.deepEqual(errors, []);
});

test('empty favorite/custom ranges and cancellation of native subcategory never fall back to all questions', async () => {
    problems = [problem('1')]; roots = [new StudyPlanNode(group('empty', []))];
    decisions = [items => items.find(item => item.builtin === Category.Favorite)]; await pickOne();
    decisions = [choosePlan('empty')]; await pickOne();
    decisions = [items => items.find(item => item.builtin === Category.Tag), () => undefined]; await pickOne();
    assert.equal(infos.length, 2); assert.deepEqual(generated, []); assert.deepEqual(queries, []); assert.equal(workspaceCalls, 0);
});

test('local OD plans work signed out, opening mapped Java or previewing Markdown without remote queries', async () => {
    const file = path.join(root, 'question.md'), java = path.join(root, 'Answer.java');
    await fs.writeFile(file, '# 本地题'); await fs.writeFile(java, 'class Answer {}');
    user = undefined; roots = [new StudyPlanNode(group('OD', [md(file, { javaFiles: [java] })]))];
    decisions = [choosePlan('OD')]; await pickOne();
    assert.equal(localStarts[0].file, file); assert.deepEqual(localStarts[0].javaFiles, [java]);
    await fs.unlink(java); decisions = [choosePlan('OD')]; await pickOne();
    assert.equal(previews[0].file, file); assert.deepEqual([queries.length, workspaceCalls, listCalls, infos.length], [0, 0, 0, 0]);
});

test('All combines native and custom leaves once per ID/file while preserving shared local Java associations', () => {
    const file = path.join(root, 'shared.md'), c = path.join(root, 'c/Answer.java'), n = path.join(root, 'n/Answer.java');
    const first = md(file, { javaFiles: [c] }), second = md(file, { javaFiles: [n] });
    const plans = [group('hot', [lc('1'), lc('1'), first]), group('OD', [second])];
    const pool = randomCandidates({ label: '全部', all: true }, plans, [problem('1'), problem('2')], false, false);
    assert.equal(pool.length, 3);
    assert.deepEqual(pool.filter(item => item.kind === 'leetcode').map(item => item.problem.id), ['1', '2']);
    assert.deepEqual(pool.find(item => item.kind === 'markdown').entry.javaFiles, [c, n]);
    assert.deepEqual(first.javaFiles, [c]); assert.deepEqual(second.javaFiles, [n]);
});

test('hide-solved and membership filters cover both native/custom candidates without deduplicating different MD files by OJ number', () => {
    const plans = [group('OD', [md(path.join(root, 'P00214-a.md')), md(path.join(root, 'P00214-b.md')),
        md(path.join(root, 'done.md'), { completed: true }), lc('1'), lc('2')])];
    const pool = randomCandidates({ label: '全部', all: true }, plans, [problem('1', { state: 1 }), problem('2', { locked: true }), problem('3')], true, false);
    assert.equal(pool.length, 3); assert.equal(pool.filter(item => item.kind === 'markdown').length, 2);
    assert.deepEqual(pool.filter(item => item.kind === 'leetcode').map(item => item.problem.id), ['3']);
    assert.deepEqual(nativeScopeValues(Category.Difficulty, [problem('1', { difficulty: 'Hard' }), problem('2')]).map(item => item.value), ['Easy', 'Hard']);
});

test('missing local Markdown is skipped with a range-specific hint, without drawing another plan', async () => {
    roots = [new StudyPlanNode(group('OD', [md(path.join(root, 'missing.md'))]))]; problems = [problem('1')];
    decisions = [choosePlan('OD')]; await pickOne();
    assert.match(infos[0], /本地题目文件已不存在/); assert.deepEqual(queries, []); assert.deepEqual(localStarts, []); assert.deepEqual(generated, []);
});
