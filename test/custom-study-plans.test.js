const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');
let root, user, sorting, hidden, problems, listCalls, opened, created, configChanged, planFiles;
const disposables = () => ({ dispose() {} });
const vscode = {
    env: { appName: 'VS Code', uriScheme: 'vscode' },
    Uri: { file: fsPath => ({ fsPath, scheme: 'file', toString: () => fsPath }), from: fields => fields },
    TreeItemCollapsibleState: { None: 0, Collapsed: 1 },
    EventEmitter: class { constructor() { this.event = () => {}; } fire() {} },
    workspace: {
        get workspaceFolders() { return [{ uri: { fsPath: root } }]; },
        getConfiguration: () => ({ get: (key, fallback) => key === 'studyPlanFiles' ? planFiles ?? fallback : fallback }),
        createFileSystemWatcher: () => ({ dispose() {}, onDidCreate: fn => { created = fn; return disposables(); }, onDidChange: () => disposables(), onDidDelete: () => disposables() }),
        onDidChangeWorkspaceFolders: disposables,
        onDidChangeConfiguration: fn => { configChanged = fn; return disposables(); },
    },
    window: { showTextDocument: async uri => opened.push(uri.fsPath), showWarningMessage() {}, showErrorMessage: message => { throw Error(message); } },
};
const mocks = {
    vscode,
    '../commands/list': { listProblems: async () => { listCalls++; return problems; } },
    '../commands/plugin': { getSortingStrategy: () => sorting },
    '../utils/settingUtils': { shouldHideSolvedProblem: () => hidden },
    '../leetCodeManager': { leetCodeManager: { getUser: () => user } },
    '../leetCodeChannel': { leetCodeChannel: { appendLine() {} } },
};
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) { return mocks[name] || originalLoad.call(this, name, parent, isMain); };
let manager, studyPlans, Provider, StudyPlanNode, SortingStrategy, ProblemState;
try {
    ({ explorerNodeManager: manager } = require('../out/src/explorer/explorerNodeManager'));
    ({ studyPlanManager: studyPlans } = require('../out/src/studyPlans/studyPlanManager'));
    ({ LeetCodeTreeDataProvider: Provider } = require('../out/src/explorer/LeetCodeTreeDataProvider'));
    ({ StudyPlanNode } = require('../out/src/studyPlans/StudyPlanNode'));
    ({ SortingStrategy, ProblemState } = require('../out/src/shared'));
} finally { Module._load = originalLoad; }
async function configure(plans) {
    const file = path.join(root, '.vscode/leetcode-study-plans.json');
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify({ version: 1, plans })); return file;
}
beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'leetcode-plan-ui-'));
    user = 'fixture'; sorting = SortingStrategy.None; hidden = false; listCalls = 0; opened = []; planFiles = undefined;
    problems = ['1', '49', '128'].map((id, index) => ({ id, name: 'Q' + id, state: index === 0 ? ProblemState.AC : ProblemState.Unknown,
        passRate: (index + 1) + '.00 %', tags: ['array'], companies: ['Unknown'], locked: false, isFavorite: id === '49', difficulty: 'Easy' }));
    await configure([{ id: 'custom', name: '混合题单', items: [
        { name: '模块', items: [{ leetcode: 1 }, { leetcode: 49 }, { leetcode: 128 }] },
        { name: '本地题', file: '${workspaceFolder}/local.md' },
    ] }]);
    await fs.writeFile(path.join(root, 'local.md'), '# 本地题');
    await manager.refreshCache(); await studyPlans.refresh();
});
afterEach(async () => { studyPlans.dispose(); manager.dispose(); await fs.rm(root, { recursive: true, force: true }); });
const provider = () => { const view = new Provider(); view.initialize({ asAbsolutePath: file => file }); return view; };

test('custom plans follow configuration exactly and reuse cached LeetCode actions and module sorting', () => {
    const view = provider(), roots = view.getChildren();
    assert.equal(roots[0].name, '混合题单');
    assert.equal(view.getTreeItem(roots[0]).label, '混合题单 (1/4)');
    const [module, local] = view.getChildren(roots[0]);
    assert.equal(view.getChildren(module)[0], manager.getNodeById('1'));
    assert.equal(view.getTreeItem(view.getChildren(module)[1]).contextValue, 'problem-favorite');
    assert.equal(view.getTreeItem(local).command.command, 'leetcode.previewLocalMarkdown');
    assert.equal(view.getTreeItem(local).contextValue, 'local-markdown');
    assert.equal(view.getTreeItem(local).collapsibleState, 0);
    assert.deepEqual(view.getChildren(local), []);
    assert.ok(local instanceof StudyPlanNode);
    assert.match(view.getTreeItem(roots[0]).tooltip, /已通过：1[\s\S]*本地题目：1[\s\S]*总题数：4/);
    sorting = SortingStrategy.AcceptanceRateDesc;
    assert.deepEqual(view.getChildren(module).map(node => node.id), ['128', '49', '1']);
    assert.deepEqual(view.getChildren(roots[0]).map(node => node.name), ['模块', '本地题']);
});

test('signed-out users can browse local statements and modules without remote problem operations', () => {
    user = undefined;
    const view = provider(), roots = view.getChildren();
    assert.equal(roots[0].id, 'notSignIn');
    assert.equal(roots[1].name, '混合题单');
    const [module, local] = view.getChildren(roots[1]);
    assert.deepEqual(view.getChildren(module), []);
    assert.equal(view.getTreeItem(local).command.command, 'leetcode.previewLocalMarkdown');
    assert.match(view.getTreeItem(roots[1]).tooltip, /总题数：4/);
});

test('hide-solved filters custom modules while keeping local statements visible', async () => {
    hidden = true; await manager.refreshCache();
    const view = provider(), root = studyPlans.getRoots()[0], [module, local] = view.getChildren(root);
    assert.deepEqual(view.getChildren(module).map(node => node.id), ['49', '128']);
    assert.equal(local.name, '本地题');
    assert.match(view.getTreeItem(root).tooltip, /已通过：1[\s\S]*总题数：4/);
    assert.equal(view.getTreeItem(root).label, '混合题单 (1/4)');
});

test('creating/saving configuration refreshes local plans without calling the LeetCode CLI', async () => {
    const view = provider(); studyPlans.initialize(() => view.refreshStudyPlans());
    const before = listCalls;
    const file = await configure([{ id: 'next', name: '新题单', folder: '${workspaceFolder}/statements' }]);
    await fs.mkdir(path.join(root, 'statements')); await fs.writeFile(path.join(root, 'statements/a.md'), '# 新题');
    created(vscode.Uri.file(file));
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.equal(studyPlans.getRoots()[0].name, '新题单');
    assert.equal(studyPlans.getChildren(studyPlans.getRoots()[0])[0].name, '新题');
    assert.equal(listCalls, before);
    await fs.writeFile(path.join(root, 'statements/b.md'), '# 新增题');
    created(vscode.Uri.file(path.join(root, 'statements/b.md')));
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.equal(studyPlans.getChildren(studyPlans.getRoots()[0]).length, 2);
    assert.equal(listCalls, before);
    assert.equal(typeof configChanged, 'function');
});

test('edit configuration preserves existing contents and can create a usable default template', async () => {
    const file = path.join(root, '.vscode/leetcode-study-plans.json');
    const original = await fs.readFile(file, 'utf8');
    await studyPlans.editConfiguration(); assert.deepEqual(opened, [file]);
    assert.equal(await fs.readFile(file, 'utf8'), original);
    await fs.unlink(file); await studyPlans.editConfiguration();
    const sample = JSON.parse(await fs.readFile(file, 'utf8'));
    assert.equal(sample.version, 1); assert.equal(sample.plans[1].name, '我的题单');
    assert.deepEqual(sample.plans.filter(plan => plan.builtin).map(plan => plan.builtin), ['All', 'Difficulty', 'Tag', 'Company', 'Favorite']);
});

test('one Markdown checkbox controls shared local entries and full-plan progress survives filtering', async () => {
    await fs.writeFile(path.join(root, 'local.md'), '# 本地题\n\n- [x] 已通过 <!-- leetcode-cn:passed -->\n\n题面');
    await configure([{ id: 'local', name: '十一、混合练习（4题）', items: [
        { name: '一、模块（1题）', items: [{ file: '${workspaceFolder}/local.md' }] },
        { name: '二、另一模块', items: [{ file: '${workspaceFolder}/local.md' }] },
        { leetcode: 1 }, { leetcode: '999999' },
    ] }]);
    await studyPlans.refresh();
    const view = provider(), plan = studyPlans.getRoots()[0], [first, second] = view.getChildren(plan);
    assert.equal(view.getTreeItem(plan).label, '11、混合练习 (3/4)');
    assert.equal(view.getTreeItem(first).label, '1、模块 (1/1)');
    assert.equal(view.getTreeItem(second).label, '2、另一模块 (1/1)');
    const local = view.getChildren(first)[0];
    assert.equal(local.state, ProblemState.AC); assert.match(view.getTreeItem(local).iconPath, /check\.png$/);
    hidden = true; await manager.refreshCache();
    assert.deepEqual(view.getChildren(first), []);
    assert.equal(view.getTreeItem(plan).label, '11、混合练习 (3/4)');
    assert.equal(manager.getNodeById('1'), undefined);
    assert.equal(manager.getNodeById('1', true).state, ProblemState.AC);
    await fs.writeFile(path.join(root, 'local.md'), '# 本地题\n\n- [ ] 已通过 <!-- leetcode-cn:passed -->\n');
    await studyPlans.refresh();
    assert.equal(view.getTreeItem(studyPlans.getRoots()[0]).label, '11、混合练习 (1/4)');
});

test('built-in and custom roots interleave exactly as configured while retaining original category behavior', async () => {
    const configured = [
        { id: 'tags', name: '标签', builtin: 'Tag' },
        { id: 'custom', name: '我的题单', items: [{ leetcode: '1' }] },
        { id: 'favorites', name: '收藏', builtin: 'Favorite' },
        { id: 'all', name: '全部练习', builtin: 'All' },
        { id: 'difficulty', name: '难度', builtin: 'Difficulty' },
        { id: 'companies', name: '公司', builtin: 'Company' },
    ];
    await configure(configured); await studyPlans.refresh();
    const view = provider(), roots = view.getChildren(), calls = listCalls;
    assert.deepEqual(roots.map(node => node.name), configured.map(plan => plan.name));
    assert.equal(roots[0].id, 'Tag');
    assert.equal(view.getChildren(roots[0])[0].id, 'Tag.array');
    assert.deepEqual(view.getChildren(roots[2]).map(node => node.id), ['49']);
    assert.equal(view.getChildren(roots[3])[0], manager.getNodeById('1'));
    assert.deepEqual(view.getChildren(roots[4]).map(node => node.id), ['Difficulty.Easy', 'Difficulty.Medium', 'Difficulty.Hard']);
    assert.equal(view.getChildren(roots[5])[0].id, 'Company.Unknown');
    await configure([...configured].reverse()); await studyPlans.refresh();
    assert.deepEqual(view.getChildren().map(node => node.name), configured.map(plan => plan.name).reverse());
    assert.equal(listCalls, calls);
    user = undefined;
    assert.deepEqual(view.getChildren().map(node => node.name), ['登录 LeetCode-CN', '我的题单']);
});

test('explicit empty configurations hide every root; absent or malformed configurations fall back to default categories', async () => {
    const view = provider();
    await configure([]); await studyPlans.refresh();
    assert.deepEqual(view.getChildren(), []);
    await fs.unlink(path.join(root, '.vscode/leetcode-study-plans.json')); await studyPlans.refresh();
    assert.deepEqual(view.getChildren().map(node => node.id), ['All', 'Difficulty', 'Tag', 'Company', 'Favorite']);
    await fs.writeFile(path.join(root, '.vscode/leetcode-study-plans.json'), '{ broken'); await studyPlans.refresh();
    assert.deepEqual(view.getChildren().map(node => node.id), ['All', 'Difficulty', 'Tag', 'Company', 'Favorite']);
    await configure([{ id: 'only', name: '收藏', builtin: 'Favorite' }]); await studyPlans.refresh();
    assert.deepEqual(view.getChildren().map(node => node.id), ['Favorite']);
});

test('multiple JSON files preserve their declared order and reuse each built-in category only once', async () => {
    await fs.writeFile(path.join(root, 'first.json'), JSON.stringify({ version: 1, plans: [
        { id: 'all', name: '全部题目', builtin: 'All' }, { id: 'one', name: '题单一', items: [] },
    ] }));
    await fs.writeFile(path.join(root, 'second.json'), JSON.stringify({ version: 1, plans: [
        { id: 'two', name: '题单二', items: [] }, { id: 'all', name: '另一个全部题目', builtin: 'All' }, { id: 'fav', name: '收藏', builtin: 'Favorite' },
    ] }));
    planFiles = ['second.json', 'first.json']; await studyPlans.refresh();
    assert.deepEqual(provider().getChildren().map(node => node.name), ['题单二', '另一个全部题目', '收藏', '题单一']);
});
