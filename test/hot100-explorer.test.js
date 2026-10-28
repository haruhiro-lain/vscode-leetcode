const assert = require('node:assert/strict');
const { test, beforeEach } = require('node:test');
const Module = require('node:module');
const { hot100ProblemIds } = require('../out/src/data/hot100');
let problems, hideSolved, sorting, user;
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {
    const mocks = {
        vscode: { env: { appName: 'VS Code', uriScheme: 'vscode' },
            EventEmitter: class { constructor() { this.event = () => {}; } fire() {} },
            Uri: { from: fields => fields }, TreeItemCollapsibleState: { None: 0, Collapsed: 1 },
        },
        '../commands/list': { listProblems: async () => problems },
        '../commands/plugin': { getSortingStrategy: () => sorting },
        '../utils/settingUtils': { shouldHideSolvedProblem: () => hideSolved },
        '../leetCodeManager': { leetCodeManager: { getUser: () => user } },
    };
    return mocks[name] || originalLoad.call(this, name, parent, isMain);
};
let manager, Provider, Category, ProblemState, SortingStrategy;
try {
    ({ explorerNodeManager: manager } = require('../out/src/explorer/explorerNodeManager'));
    ({ LeetCodeTreeDataProvider: Provider } = require('../out/src/explorer/LeetCodeTreeDataProvider'));
    ({ Category, ProblemState, SortingStrategy } = require('../out/src/shared'));
} finally { Module._load = originalLoad; }
const fixture = (id, index = 0) => ({ id, name: 'question-' + id, isFavorite: id === '49', locked: false,
    state: id === '1' ? ProblemState.AC : id === '49' ? ProblemState.NotAC : ProblemState.Unknown,
    difficulty: 'Easy', passRate: (index + 1) + '.00 %', companies: ['Unknown'], tags: ['array'],
});
beforeEach(() => {
    manager.dispose(); hideSolved = false; sorting = SortingStrategy.None; user = 'fixture';
    // Deliberately reverse the incoming list to verify study-plan ordering.
    problems = hot100ProblemIds.map(fixture).reverse().concat(fixture('704'));
});
const hotRoot = () => manager.getRootNodes().find(node => node.id === Category.Hot100);
function provider() { const instance = new Provider(); instance.initialize({ asAbsolutePath: file => file }); return instance; }

test('Hot100 is a root category with exactly 100 distinct bundled question IDs', async () => {
    assert.equal(hot100ProblemIds.length, 100);
    assert.equal(new Set(hot100ProblemIds).size, 100);
    assert.deepEqual(hot100ProblemIds.slice(0, 3), ['1', '49', '128']);
    assert.equal(hot100ProblemIds[99], '287');
    await manager.refreshCache();
    const view = provider(), roots = view.getChildren();
    assert.deepEqual(roots.slice(0, 2).map(node => node.id), [Category.All, Category.Hot100]);
    const item = view.getTreeItem(hotRoot());
    assert.equal(item.label, 'Hot100');
    assert.equal(item.collapsibleState, 1);
    assert.equal(item.contextValue, 'hot100');
    assert.equal(item.command, undefined);
});

test('Hot100 reuses real cached problem nodes and original actions instead of synthetic copies', async () => {
    await manager.refreshCache();
    const view = provider(), nodes = view.getChildren(hotRoot());
    assert.deepEqual(nodes.map(node => node.id), hot100ProblemIds);
    assert.equal(nodes.some(node => node.id === '704'), false);
    const first = nodes[0];
    assert.equal(first, manager.getNodeById('1'));
    assert.equal(first.state, ProblemState.AC);
    assert.equal(first.isProblem, true);
    assert.equal(first.previewCommand.command, 'leetcode.previewProblem');
    assert.equal(first.previewCommand.arguments[0], first);
    assert.equal(view.getTreeItem(first).contextValue, 'problem');
    assert.equal(view.getTreeItem(nodes[1]).contextValue, 'problem-favorite');
    assert.match(view.getTreeItem(hotRoot()).tooltip, /已通过：1[\s\S]*未通过：1[\s\S]*总题数：100/);
});

test('hiding solved problems applies to Hot100 and its displayed statistics', async () => {
    hideSolved = true;
    await manager.refreshCache();
    const view = provider(), nodes = view.getChildren(hotRoot());
    assert.equal(nodes.length, 99);
    assert.equal(nodes.some(node => node.id === '1'), false);
    assert.match(view.getTreeItem(hotRoot()).tooltip, /已通过：0[\s\S]*未通过：1[\s\S]*总题数：99/);
});

test('existing acceptance-rate sorting works and default order can be restored', async () => {
    await manager.refreshCache();
    sorting = SortingStrategy.AcceptanceRateDesc;
    assert.equal(manager.getHot100Nodes()[0].id, '287');
    sorting = SortingStrategy.AcceptanceRateAsc;
    assert.equal(manager.getHot100Nodes()[0].id, '1');
    sorting = SortingStrategy.None;
    assert.deepEqual(manager.getHot100Nodes().map(node => node.id), hot100ProblemIds);
});

test('refresh updates completion state and missing cache entries do not become fake problems', async () => {
    await manager.refreshCache();
    problems = problems.filter(problem => problem.id !== '2').map(problem => problem.id === '49' ? { ...problem, state: ProblemState.AC } : problem);
    await manager.refreshCache();
    const view = provider();
    assert.equal(manager.getHot100Nodes().length, 99);
    assert.equal(manager.getHot100Nodes().some(node => node.id === '2'), false);
    assert.match(view.getTreeItem(hotRoot()).tooltip, /已通过：2[\s\S]*未通过：0[\s\S]*总题数：99/);
    problems = []; await manager.refreshCache();
    assert.deepEqual(manager.getHot100Nodes(), []);
});

test('the existing sign-in gate and other root categories remain available', async () => {
    const view = provider(); user = undefined;
    assert.deepEqual(view.getChildren().map(node => node.id), ['notSignIn']);
    user = 'fixture'; await manager.refreshCache();
    for (const category of [Category.Difficulty, Category.Tag, Category.Company, Category.Favorite]) {
        assert.ok(view.getChildren().some(node => node.id === category));
    }
    assert.equal(view.getChildren(manager.getRootNodes().find(node => node.id === Category.All)).length, 101);
});
