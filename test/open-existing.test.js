const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');
const { ensureExerciseFile } = require('../out/src/utils/exerciseFileUtils');
let root, opened, generated, picks, errors, hints, active, choose, defaultLanguage, previews, wsl;
let supported, languageQueries, metadataError, cachedProblems, listedProblems, listCalls, user, premium, infos, loginPrompts;
const node = { id: '1', name: '两数之和', tags: ['array', 'hash-table'], difficulty: 'Easy', locked: false };
const config = { get: (key, fallback) => ({
    defaultLanguage, 'filePath.java.folder': 'src/main/java/com/haruhiro_lain/LeetCode/${tag}',
    'filePath.default.filename': '${id}.${kebab-case-name}.${ext}',
})[key] ?? fallback };
const vscode = {
    env: { appName: 'VS Code', uriScheme: 'vscode' },
    workspace: { getConfiguration: () => config },
    window: { get activeTextEditor() { return active ? { document: { uri: { fsPath: active } } } : undefined; },
        showTextDocument: async uri => opened.push(uri.fsPath),
        showInformationMessage: message => infos.push(message),
        showQuickPick: async (items, options) => { picks.push({ items, options }); return choose(items); } },
    Uri: class { static file(fsPath) { return { fsPath }; } }, ViewColumn: { One: 1 },
};
const mocks = {
    vscode,
    '../explorer/explorerNodeManager': { explorerNodeManager: { getAllNodes: () => cachedProblems, getNodeById: id => cachedProblems.find(item => item.id === id) } }, '../explorer/LeetCodeNode': { LeetCodeNode: class {} },
    '../studyPlans/studyPlanManager': { studyPlanManager: { refresh: async () => {}, getRoots: () => [] } },
    './localProblems': {},
    '../leetCodeChannel': { leetCodeChannel: { appendLine() {} } },
    '../leetCodeManager': { leetCodeManager: { getUser: () => user } },
    '../globalState': { globalState: { getUserStatus: () => ({ isPremium: premium }) } },
    '../leetCodeExecutor': { leetCodeExecutor: {
        showProblem: async (problem, language, file) => {
            generated.push({ language, file });
            await ensureExerciseFile(file, language, problem.id, async () => language === 'java'
                ? `// @lc app=leetcode.cn id=${problem.id} lang=java\nclass Solution { public int[] twoSum(int[] nums, int target) {} }`
                : `// @lc app=leetcode.cn id=${problem.id} lang=${language}\nSELECT * FROM Customers;`);
        }, getDescription: async () => 'description',
        getProblemLanguages: async id => { languageQueries.push(id); if (metadataError) throw metadataError; return supported[id] || ['java', 'mysql']; },
    } },
    '../utils/workspaceUtils': { selectWorkspaceFolder: async () => wsl ? '/mnt/mock/code' : root },
    '../utils/settingUtils': { getDescriptionConfiguration: () => ({ showInComment: false, showInWebview: true }), shouldUseEndpointTranslation: () => true, shouldHideSolvedProblem: () => false },
    '../utils/uiUtils': { promptHintMessage: async () => hints++, promptForSignIn: () => loginPrompts++ },
    '../utils/wslUtils': { useWsl: () => wsl, toWinPath: async input => input === '/mnt/mock/code' ? root : input },
    '../utils/commandErrorUtils': { handleCommandError: async error => errors.push(error) },
    '../webview/leetCodePreviewProvider': { leetCodePreviewProvider: { show: () => previews++ } },
    '../webview/leetCodeSolutionProvider': {},
    './plugin': { getLeetCodeEndpoint: () => 'leetcode-cn' }, './list': { listProblems: async () => { listCalls++; return listedProblems; } },
};
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) { return mocks[name] || originalLoad.call(this, name, parent, isMain); };
let showProblem, pickOne;
try { ({ showProblem, pickOne } = require('../out/src/commands/show')); }
finally { Module._load = originalLoad; }

beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'leetcode-open-'));
    opened = []; generated = []; picks = []; errors = []; hints = 0; previews = 0; active = undefined;
    defaultLanguage = 'java'; choose = items => items[0]; wsl = false;
    supported = {}; languageQueries = []; metadataError = undefined; cachedProblems = []; listedProblems = []; listCalls = 0;
    user = 'fixture'; premium = false; infos = []; loginPrompts = 0;
});
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });
async function write(relative, content = '// @lc app=leetcode.cn id=1 lang=java\n// keep my completed solution') {
    const file = path.join(root, relative);
    await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, content);
    return file;
}

test('Start Coding opens a single existing answer before language/tag selection and never touches it', async () => {
    const content = '// @lc app=leetcode.cn id=1 lang=java\n// completed implementation';
    const file = await write('programmercarl/array/1.两数之和.java', content);
    defaultLanguage = undefined;
    await showProblem(node);
    assert.deepEqual(opened, [file]);
    assert.equal(await fs.readFile(file, 'utf8'), content);
    assert.deepEqual([generated.length, picks.length, errors.length, hints, previews], [0, 0, 0, 0, 0]);
    assert.deepEqual(languageQueries, []);
});

test('multiple answers show relative directories and open only the chosen file', async () => {
    await write('LeetCodeHot100/1.两数之和.java');
    const carl = await write('programmercarl/array/1.两数之和.java');
    choose = items => items.find(item => item.file === carl);
    await showProblem(node);
    assert.deepEqual(opened, [carl]);
    assert.equal(picks.length, 1);
    assert.ok(picks[0].items.some(item => item.description === path.join('programmercarl', 'array')));
    assert.equal(generated.length, 0);
});

test('an already active matching editor is reused and cancellation never creates a duplicate', async () => {
    const file = await write('LeetCodeHot100/1.两数之和.java');
    await write('programmercarl/1.两数之和.java');
    active = file;
    await showProblem(node);
    assert.deepEqual(opened, [file]); assert.equal(picks.length, 0);
    active = undefined; opened = []; choose = () => undefined;
    await showProblem(node);
    assert.deepEqual(opened, []); assert.equal(generated.length, 0);
});

test('when no answer exists the original tag, creation, Java template and description behavior remains', async () => {
    choose = items => items.find(item => item === 'hash-table');
    await showProblem(node);
    assert.deepEqual(errors, []);
    assert.equal(generated.length, 1);
    assert.equal(generated[0].language, 'java');
    assert.match(generated[0].file, /LeetCode[\\/]hash_table[\\/]1\..*\.java$/);
    assert.deepEqual(opened, [generated[0].file]);
    assert.match(await fs.readFile(generated[0].file, 'utf8'), /class LeetCode1/);
    assert.deepEqual([hints, previews], [1, 1]);
});

test('existing files in another language and WSL roots can still be opened directly', async () => {
    const file = await write('custom/answer.py', '# @lc app=leetcode.cn id=1 lang=python3');
    wsl = true;
    await showProblem(node);
    assert.deepEqual(opened, [file]);
    assert.equal(generated.length, 0); assert.equal(errors.length, 0);
});

test('a Java default offers only supported languages for SQL problems without changing the default', async () => {
    const sql = { ...node, id: '9000', name: 'Find Loyal Customers' };
    supported[sql.id] = ['mssql', 'mysql', 'oraclesql', 'postgresql', 'pythondata'];
    await showProblem(sql);
    assert.deepEqual(picks[0].items, ['mysql']);
    assert.match(picks[0].options.placeHolder, /不支持 java/);
    assert.equal(defaultLanguage, 'java'); assert.equal(errors.length, 0);
    assert.equal(generated[0].language, 'mysql'); assert.match(generated[0].file, /\.sql$/);
    assert.match(await fs.readFile(generated[0].file, 'utf8'), /SELECT \* FROM Customers/);
    assert.equal(opened.length, 1);
});

test('cancelling an incompatible-language choice creates no code and never changes the default', async () => {
    supported[node.id] = ['mysql']; choose = () => undefined;
    await showProblem(node);
    assert.deepEqual(generated, []); assert.deepEqual(opened, []);
    assert.deepEqual(await fs.readdir(root), []); assert.equal(defaultLanguage, 'java'); assert.deepEqual(errors, []);
});

test('when none of the problem languages is registered the supported list is explained without generating Java', async () => {
    supported[node.id] = ['pythondata']; await showProblem(node);
    assert.match(infos[0], /不支持 java.*pythondata/);
    assert.deepEqual(generated, []); assert.deepEqual(opened, []); assert.deepEqual(picks, []);
});

test('random selection skips SQL and inaccessible premium problems, reuses cache and verifies languages only once', async () => {
    const sql = { ...node, id: '9000' }, locked = { ...node, id: '9001', locked: true };
    cachedProblems = [sql, locked, node]; supported[sql.id] = ['mysql', 'pythondata'];
    const originalRandom = Math.random; Math.random = () => 0;
    try { await pickOne(); } finally { Math.random = originalRandom; }
    assert.equal(listCalls, 0); assert.deepEqual(languageQueries, ['9000', '1']);
    assert.equal(generated.length, 1); assert.equal(generated[0].language, 'java');
    assert.match(generated[0].file, /1\..*\.java$/); assert.deepEqual(errors, []);
});

test('random selection can use the problem list before cache initialization and premium accounts keep paid problems', async () => {
    premium = true; listedProblems = [{ ...node, locked: true }];
    await pickOne();
    assert.equal(listCalls, 1); assert.deepEqual(languageQueries, ['1']); assert.equal(generated.length, 1);
});

test('random selection handles empty lists, signed-out users and exhaustive language mismatches without undefined problems', async () => {
    await pickOne(); assert.equal(infos.length, 1); assert.deepEqual(generated, []);
    user = undefined; await pickOne(); assert.equal(loginPrompts, 1); assert.equal(listCalls, 1);
    user = 'fixture'; cachedProblems = [{ ...node, id: '9000' }, { ...node, id: '9001' }];
    supported = { '9000': ['mysql'], '9001': ['pythondata'] };
    await pickOne(); assert.equal(languageQueries.length, 2);
    assert.equal(new Set(languageQueries).size, 2); assert.match(infos.at(-1), /没有找到支持 java/);
    assert.deepEqual(generated, []); assert.deepEqual(errors, []);
});

test('metadata failures stop random selection and surface the original error without treating it as a language mismatch', async () => {
    cachedProblems = [node, { ...node, id: '2' }]; metadataError = Error('network unavailable');
    await pickOne();
    assert.equal(languageQueries.length, 1); assert.deepEqual(errors, [metadataError]);
    assert.deepEqual(generated, []); assert.deepEqual(infos, []);
});
