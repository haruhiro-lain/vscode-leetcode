const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const modules = require('./fixtures/hot100.json');
const ids = modules.flatMap(module => module.problemIds);
let root, problems, hideSolved, sorting, user;
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {
    const mocks = {
        vscode: { env: { appName: 'VS Code', uriScheme: 'vscode' },
            workspace: { get workspaceFolders() { return [{ uri: { fsPath: root } }]; }, getConfiguration: () => ({ get: (_key, fallback) => fallback }) },
            EventEmitter: class { constructor() { this.event = () => {}; } fire() {} dispose() {} },
            Uri: { from: fields => fields }, TreeItemCollapsibleState: { None: 0, Collapsed: 1 },
        },
        '../commands/list': { listProblems: async () => problems },
        '../commands/plugin': { getSortingStrategy: () => sorting },
        '../utils/settingUtils': { shouldHideSolvedProblem: () => hideSolved },
        '../leetCodeManager': { leetCodeManager: { getUser: () => user } },
        '../leetCodeChannel': { leetCodeChannel: { appendLine() {} } },
    };
    return mocks[name] || originalLoad.call(this, name, parent, isMain);
};
let manager, studyPlans, Provider, StudyPlanNode, Category, ProblemState, SortingStrategy;
try {
    ({ explorerNodeManager: manager } = require('../out/src/explorer/explorerNodeManager'));
    ({ studyPlanManager: studyPlans } = require('../out/src/studyPlans/studyPlanManager'));
    ({ StudyPlanNode } = require('../out/src/studyPlans/StudyPlanNode'));
    ({ LeetCodeTreeDataProvider: Provider } = require('../out/src/explorer/LeetCodeTreeDataProvider'));
    ({ Category, ProblemState, SortingStrategy } = require('../out/src/shared'));
} finally { Module._load = originalLoad; }
const fixture = (id, index = 0) => ({ id, name: 'question-' + id, isFavorite: id === '49', locked: false,
    state: id === '1' ? ProblemState.AC : id === '49' ? ProblemState.NotAC : ProblemState.Unknown,
    difficulty: 'Easy', passRate: (index + 1) + '.00 %', companies: ['Unknown'], tags: ['array'],
});
const hotPlan = () => ({ id: 'hot100', name: 'Hot100', source: '../Hot100.md', sourceMode: 'leetcode' });
async function configure(plans) {
    const file = path.join(root, '.vscode/leetcode-study-plans.json');
    await fs.writeFile(file, JSON.stringify({ version: 1, plans }));
    await studyPlans.refresh();
}
beforeEach(async () => {
    manager.dispose(); hideSolved = false; sorting = SortingStrategy.None; user = 'fixture';
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'leetcode-hot-custom-'));
    await fs.mkdir(path.join(root, '.vscode')); await fs.mkdir(path.join(root, 'code'));
    await Promise.all(ids.map(id => fs.writeFile(path.join(root, 'code', id + '.java'), `// @lc app=leetcode.cn id=${id} lang=java`)));
    const markdown = ['# Hot100'];
    for (const module of modules) {
        markdown.push('## ' + module.name, '| 题目 | 题号 |', '|---|---|', ...module.problemIds.map(id => `| [题目 ${id}](code/${id}.java) | ${id} |`));
    }
    markdown.push('## 相关题单', '| 题单 |', '|---|', '| [代码随想录](programmercarl.md) |', '[代码索引](code/README.md)');
    await fs.writeFile(path.join(root, 'Hot100.md'), markdown.join('\n'));
    problems = ids.map(fixture).reverse().concat(fixture('704'));
    await manager.refreshCache(); await configure([hotPlan()]);
});
afterEach(async () => { studyPlans.dispose(); manager.dispose(); await fs.rm(root, { recursive: true, force: true }); });
const hotRoot = () => studyPlans.getRoots().find(node => node.name === 'Hot100');
function provider() { const view = new Provider(); view.initialize({ asAbsolutePath: file => file }); return view; }
const leaves = view => view.getChildren(hotRoot()).flatMap(module => view.getChildren(module));

test('Hot100 is a configured study plan, with no built-in or duplicate category', () => {
    const view = provider(), roots = view.getChildren();
    assert.deepEqual(roots.map(node => node.name), ['Hot100']);
    assert.equal(roots.filter(node => node.name === 'Hot100').length, 1);
    assert.equal(manager.getRootNodes().some(node => node.name === 'Hot100'), false);
    assert.ok(hotRoot() instanceof StudyPlanNode);
    assert.equal(view.getTreeItem(hotRoot()).contextValue, 'studyplan');
    assert.equal(view.getTreeItem(hotRoot()).collapsibleState, 1);
});

test('Hot100 imports exactly 17 ordered modules and 100 distinct questions, excluding footer navigation', () => {
    const view = provider(), groups = view.getChildren(hotRoot());
    assert.equal(groups.length, 17); assert.equal(ids.length, 100); assert.equal(new Set(ids).size, 100);
    assert.deepEqual(groups.map(group => group.name), modules.map(module => module.name));
    for (let index = 0; index < groups.length; index++) {
        assert.deepEqual(view.getChildren(groups[index]).map(node => node.id), modules[index].problemIds);
    }
    assert.deepEqual(leaves(view).map(node => node.id), ids);
    assert.match(view.getTreeItem(hotRoot()).tooltip, /已通过：1[\s\S]*未通过：1[\s\S]*本地题目：0[\s\S]*总题数：100/);
});

test('Hot100 questions reuse cached completion, favorites, preview and coding actions', () => {
    const view = provider(), nodes = leaves(view);
    assert.equal(nodes[0], manager.getNodeById('1'));
    assert.equal(nodes[0].state, ProblemState.AC);
    assert.equal(nodes[0].previewCommand.command, 'leetcode.previewProblem');
    assert.equal(nodes[0].previewCommand.arguments[0], nodes[0]);
    assert.equal(view.getTreeItem(nodes[1]).contextValue, 'problem-favorite');
    assert.deepEqual(view.getChildren(nodes[0]), []);
});

test('hide-solved and completion refresh update Hot100 module and total statistics', async () => {
    const view = provider(), hash = view.getChildren(hotRoot())[0];
    assert.match(view.getTreeItem(hash).tooltip, /已通过：1[\s\S]*总题数：3/);
    hideSolved = true; await manager.refreshCache();
    assert.deepEqual(view.getChildren(hash).map(node => node.id), ['49', '128']);
    assert.equal(leaves(view).length, 99);
    assert.match(view.getTreeItem(hash).tooltip, /已通过：1[\s\S]*总题数：3/);
    assert.equal(view.getTreeItem(hotRoot()).label, 'Hot100 (1/100)');
    hideSolved = false; problems = problems.map(problem => problem.id === '49' ? { ...problem, state: ProblemState.AC } : problem);
    await manager.refreshCache();
    assert.match(view.getTreeItem(hotRoot()).tooltip, /已通过：2[\s\S]*总题数：100/);
});

test('acceptance sorting changes only question order within modules and default order restores', () => {
    const view = provider(); sorting = SortingStrategy.AcceptanceRateDesc;
    assert.deepEqual(view.getChildren(hotRoot()).map(group => group.name), modules.map(module => module.name));
    for (const [index, group] of view.getChildren(hotRoot()).entries()) {
        assert.deepEqual(view.getChildren(group).map(node => node.id), [...modules[index].problemIds].reverse());
    }
    sorting = SortingStrategy.AcceptanceRateAsc; assert.deepEqual(leaves(view).map(node => node.id), ids);
    sorting = SortingStrategy.None; assert.deepEqual(leaves(view).map(node => node.id), ids);
});

test('Hot100 can be renamed, reordered or removed through the same custom configuration', async () => {
    const view = provider();
    await configure([{ id: 'mine', name: '我的题单', items: [] }, { ...hotPlan(), name: '我的 Hot100' }]);
    assert.deepEqual(view.getChildren().map(node => node.name), ['我的题单', '我的 Hot100']);
    await configure([]);
    assert.equal(view.getChildren().some(node => node.name.includes('Hot100')), false);
    assert.deepEqual(view.getChildren(), []);
});

test('unavailable cache entries are skipped and sign-out preserves the configured module structure', async () => {
    const view = provider(); problems = problems.filter(problem => problem.id !== '2'); await manager.refreshCache();
    assert.equal(leaves(view).length, 99);
    problems = []; await manager.refreshCache();
    assert.equal(view.getChildren(hotRoot()).length, 17); assert.deepEqual(leaves(view), []);
    user = undefined;
    assert.deepEqual(view.getChildren().map(node => node.name), ['登录 LeetCode-CN', 'Hot100']);
    assert.equal(view.getChildren(hotRoot()).length, 17);
});
