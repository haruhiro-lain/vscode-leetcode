const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { loadStudyPlans, resolveStudyPath } = require('../out/src/studyPlans/studyPlanLoader');
let root;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'leetcode-plans-')); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });
async function write(file, text) {
    const full = path.join(root, file); await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, text); return full;
}
async function load(plans) {
    const file = await write('.vscode/leetcode-study-plans.json', JSON.stringify({ version: 1, plans }));
    return loadStudyPlans([{ file, workspaceRoot: root }]);
}
const flatten = entries => entries.flatMap(entry => entry.kind === 'group' ? flatten(entry.children) : [entry]);

test('manual plans mix nested modules, numeric LeetCode IDs and relative Markdown statements', async () => {
    await write('题目/本地.md', '# 本地题名\n\n题面');
    const plans = [{ id: 'mine', name: '我的题单', items: [
        { name: '哈希', items: [{ leetcode: 1 }, { leetcode: '49' }] },
        { file: '${workspaceFolder}/题目/本地.md' },
    ] }];
    const result = await load(plans), entries = flatten(result.roots);
    assert.deepEqual(result.errors, []);
    assert.equal(result.roots[0].children[0].name, '哈希');
    assert.deepEqual(entries.map(entry => entry.kind), ['leetcode', 'leetcode', 'markdown']);
    assert.deepEqual(entries.slice(0, 2).map(entry => entry.problemId), ['1', '49']);
    assert.equal(entries[2].name, '本地题名');
    assert.equal(entries[2].file, path.join(root, '题目/本地.md'));
    assert.deepEqual((await load(plans)).roots, result.roots);
    assert.ok(result.dependencies.has(entries[2].file));
});

test('Markdown indices preserve heading hierarchy and row order without duplicating Java answer links', async () => {
    await write('docs/a b.md', '# 原题');
    await write('code/704.java', '// @lc app=leetcode.cn id=704 lang=java');
    await write('code/128.java', '// OD article ID, not a LeetCode question');
    await write('docs/index.md', '# 目录\n## 新系统\n| 题目 | 答案 |\n|---|---|\n| [本地题](a%20b.md) | [Java](../code/128.java) |\n## 算法\n### 数组\n- [二分查找](../code/704.java)\n- [重复练习](../code/704.java)\n- [非力扣](../code/128.java)\n## 不含题目\n[官网](https://example.com/test.md)\n```md\n[伪题](fake.md)\n```\n');
    const result = await load([{ id: 'source', name: '导入', source: '../docs/index.md' }]);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.roots[0].children.map(entry => entry.name), ['新系统', '算法']);
    assert.equal(result.roots[0].children[1].children[0].name, '数组');
    const leaves = flatten(result.roots);
    assert.deepEqual(leaves.map(entry => entry.name), ['本地题', '二分查找', '重复练习']);
    assert.deepEqual(leaves.map(entry => entry.problemId), [undefined, '704', '704']);
    assert.equal(new Set(leaves.map(entry => entry.id)).size, 3);
    assert.equal(leaves[0].file, path.join(root, 'docs/a b.md'));
});

test('folder plans recursively group Markdown files, ignore README and update when files change', async () => {
    await write('local/README.md', '# 索引'); await write('local/2.md', '# 第二题');
    await write('local/10.md', '# 第十题'); await write('local/模块/1.md', '# 分组题');
    await write('local/.private/hidden.md', '# 隐藏'); await write('local/a.java', 'class A {}');
    const plans = [{ id: 'dir', name: '本地', folder: '../local' }];
    const first = await load(plans);
    assert.deepEqual(flatten(first.roots).map(entry => entry.name).sort(), ['第二题', '第十题', '分组题'].sort());
    assert.ok(first.directories.has(path.join(root, 'local')));
    assert.ok(first.roots[0].children.find(entry => entry.name === '模块').kind === 'group');
    await fs.unlink(path.join(root, 'local/2.md'));
    await write('local/3.md', '# 新题');
    assert.deepEqual(flatten((await load(plans)).roots).map(entry => entry.name).sort(), ['新题', '第十题', '分组题'].sort());
});

test('bad plans and items report errors while valid plans and missing explicit statements remain usable', async () => {
    const result = await load([
        { id: 'valid', name: '有效', items: [{ leetcode: '1' }, { leetcode: 'slug' }, { file: '../missing.md' }, { items: [], name: '坏条目', file: 'bad.md' }] },
        { id: 'valid', name: '重复', items: [] },
        { id: 'missing', name: '缺少索引', source: '../missing-index.md' },
    ]);
    assert.equal(result.roots.length, 1);
    assert.equal(flatten(result.roots).length, 2);
    assert.equal(result.errors.length, 4);
    assert.ok(result.dependencies.has(path.join(root, 'missing-index.md')));
    const bad = await write('bad.json', '{ broken');
    assert.equal((await loadStudyPlans([{ file: bad }])).errors.length, 1);
    assert.deepEqual((await loadStudyPlans([{ file: path.join(root, 'none.json') }])).roots, []);
    assert.throws(() => resolveStudyPath('${workspaceFolder}/x', root));
    assert.throws(() => resolveStudyPath('${unsupported}/x', root, root));
});

test('different workspaces and plan IDs do not collide', async () => {
    const files = await Promise.all(['one', 'two'].map(name => write(name + '/plans.json', JSON.stringify({ version: 1, plans: [{ id: 'mine', name: '相同名称', items: [{ leetcode: 1 }] }] }))));
    const result = await loadStudyPlans(files.map(file => ({ file, workspaceRoot: path.dirname(file) })));
    assert.equal(result.roots.length, 2);
    assert.notEqual(result.roots[0].id, result.roots[1].id);
});

test('LeetCode-only source mode ignores Markdown navigation even inside tables', async () => {
    await write('code/1.java', '// @lc app=leetcode.cn id=1 lang=java');
    await write('docs/local.md', '# 本地题');
    await write('docs/index.md', '# 索引\n## 哈希\n| 题目 | 答案 |\n|---|---|\n| [题面](local.md) | [两数之和](../code/1.java) |\n## 相关题单\n| 链接 |\n|---|\n| [导航](local.md) |\n');
    const result = await load([{ id: 'only-lc', name: '力扣题单', source: '../docs/index.md', sourceMode: 'leetcode' }]);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.roots[0].children.map(entry => entry.name), ['哈希']);
    assert.deepEqual(flatten(result.roots).map(entry => entry.problemId), ['1']);
    assert.equal((await load([{ id: 'bad', name: '无效配置', source: '../docs/index.md', sourceMode: 'invalid' }])).errors.length, 1);
});

test('built-in categories are valid root entries and configuration presence is distinct from an empty plan array', async () => {
    const result = await load([
        { id: 'favorite', name: '收藏', builtin: 'Favorite' },
        { id: 'mine', name: '自选', items: [] },
        { id: 'all', name: '全部题目', builtin: 'All' },
    ]);
    assert.deepEqual(result.errors, []); assert.equal(result.configured, true);
    assert.deepEqual(result.roots.map(entry => entry.kind), ['builtin', 'group', 'builtin']);
    assert.deepEqual(result.roots.map(entry => entry.builtin), ['Favorite', undefined, 'All']);
    assert.equal((await load([])).configured, true);
    assert.equal((await loadStudyPlans([{ file: path.join(root, 'missing.json') }])).configured, false);
});

test('invalid, nested, duplicate or ambiguous built-in definitions report errors without breaking valid roots', async () => {
    const result = await load([
        { id: 'good', name: '全部题目', builtin: 'All' },
        { id: 'duplicate', name: '重复', builtin: 'All' },
        { id: 'bad', name: '无效', builtin: 'Unknown' },
        { id: 'mixed', name: '混用', builtin: 'Tag', items: [] },
        { id: 'nested', name: '分组', items: [{ name: '内部分类', builtin: 'Favorite' }] },
    ]);
    assert.equal(result.errors.length, 4);
    assert.deepEqual(result.roots.map(entry => entry.name), ['全部题目', '分组']);
    assert.deepEqual(result.roots[1].children, []);
});
