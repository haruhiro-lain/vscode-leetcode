const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');
const { ensureExerciseFile } = require('../out/src/utils/exerciseFileUtils');
let root, opened, generated, picks, errors, hints, active, choose, defaultLanguage, previews, wsl;
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
        showQuickPick: async (items, options) => { picks.push({ items, options }); return choose(items); } },
    Uri: class { static file(fsPath) { return { fsPath }; } }, ViewColumn: { One: 1 },
};
const mocks = {
    vscode,
    '../explorer/explorerNodeManager': {}, '../explorer/LeetCodeNode': { LeetCodeNode: class {} },
    '../leetCodeChannel': { leetCodeChannel: { appendLine() {} } },
    '../leetCodeManager': { leetCodeManager: { getUser: () => 'fixture' } },
    '../leetCodeExecutor': { leetCodeExecutor: {
        showProblem: async (_problem, language, file) => {
            generated.push({ language, file });
            await ensureExerciseFile(file, language, '1', async () => '// @lc app=leetcode.cn id=1 lang=java\nclass Solution { public int[] twoSum(int[] nums, int target) {} }');
        }, getDescription: async () => 'description',
    } },
    '../utils/workspaceUtils': { selectWorkspaceFolder: async () => wsl ? '/mnt/mock/code' : root },
    '../utils/settingUtils': { getDescriptionConfiguration: () => ({ showInComment: false, showInWebview: true }), shouldUseEndpointTranslation: () => true },
    '../utils/uiUtils': { promptHintMessage: async () => hints++ },
    '../utils/wslUtils': { useWsl: () => wsl, toWinPath: async input => input === '/mnt/mock/code' ? root : input },
    '../utils/commandErrorUtils': { handleCommandError: async error => errors.push(error) },
    '../webview/leetCodePreviewProvider': { leetCodePreviewProvider: { show: () => previews++ } },
    '../webview/leetCodeSolutionProvider': {},
    './plugin': { getLeetCodeEndpoint: () => 'leetcode-cn' }, './list': {},
};
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) { return mocks[name] || originalLoad.call(this, name, parent, isMain); };
let showProblem;
try { ({ showProblem } = require('../out/src/commands/show')); }
finally { Module._load = originalLoad; }

beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'leetcode-open-'));
    opened = []; generated = []; picks = []; errors = []; hints = 0; previews = 0; active = undefined;
    defaultLanguage = 'java'; choose = items => items[0]; wsl = false;
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
