const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const Module = require('node:module');
const { findJavaSolutions } = require('../out/src/utils/javaSolutionUtils');
const { commandResultError } = require('../out/src/utils/commandResultUtils');

// Load extension modules with only the VS Code/UI boundary mocked. Production
// extraction, temporary files, and both command handlers run unchanged.
const source = `// @lc app=leetcode.cn id=1 lang=java
class Wrapper {
  class Solution { int answer() { return 1; } }
  class Solution2 { int answer() { return 2; } }
}`;
const uri = { fsPath: 'C:/practice/1.two-sum.java' };
const document = {
    uri, languageId: 'java', getText: () => source, lineCount: source.split('\n').length,
    lineAt: i => ({ text: source.split('\n')[i] }),
    positionAt: offset => ({ line: source.slice(0, offset).split('\n').length - 1, character: 0 }),
};
let picks = [];
let calls = [];
let results = [];
let errors = [];
let saved = 0;
let failExecution = false;
let executionError;
let userStatus = 1;
let invalidated = 0;
let authenticationOutcome = 'expired';
let localProblems = [];
let shortcuts = ['submit', 'test', 'description'];
const warnings = [];
const commands = [];
const vscode = {
    env: { appName: 'Visual Studio Code' },
    workspace: { openTextDocument: async () => document },
    window: {
        activeTextEditor: { document },
        showQuickPick: async items => picks.length ? picks.shift()(items) : undefined,
        showWarningMessage: async (message, signIn) => { warnings.push(message); return signIn; },
    },
    commands: { executeCommand: async command => commands.push(command) },
    EventEmitter: class { fire() {} },
    Range: class { constructor(line) { this.start = { line }; } },
    CodeLens: class { constructor(range, command) { this.range = range; this.command = command; } },
};
async function execute(file, input) {
    const code = await fs.readFile(file, 'utf8');
    calls.push({ file, code, input });
    if (executionError) throw executionError;
    if (failExecution) throw Error('network failed');
    return 'judge result';
}
const mocks = {
    vscode,
    '../utils/workspaceUtils': { getActiveFilePath: async () => { saved++; return uri.fsPath; } },
    './workspaceUtils': { getActiveFilePath: async () => { saved++; return uri.fsPath; } },
    './wslUtils': { useWsl: () => false },
    '../utils/wslUtils': { useWsl: () => false },
    '../utils/settingUtils': { getEditorShortcuts: () => shortcuts },
    '../studyPlans/studyPlanManager': { studyPlanManager: { getLocalProblems: () => localProblems } },
    '../explorer/explorerNodeManager': { explorerNodeManager: { getNodeById: () => undefined } },
    '../explorer/LeetCodeTreeDataProvider': { leetCodeTreeDataProvider: { refresh() {} } },
    '../leetCodeManager': { leetCodeManager: {
        getUser: () => userStatus === 1 ? 'user' : undefined, getStatus: () => userStatus,
        invalidateSession: () => { if (userStatus !== 2) invalidated++; userStatus = 2; },
        confirmSessionExpired: async () => {
            if (authenticationOutcome === 'expired') { if (userStatus !== 2) invalidated++; userStatus = 2; }
            return authenticationOutcome;
        },
    } },
    '../leetCodeExecutor': { leetCodeExecutor: { submitSolution: execute, testSolution: execute } },
    '../leetCodeChannel': { leetCodeChannel: { appendLine: e => errors.push(e) } },
    '../webview/leetCodeSubmissionProvider': { leetCodeSubmissionProvider: { show: s => results.push(s) } },
    '../utils/uiUtils': { DialogType: { error: 0 }, DialogOptions: { no: { title: '取消' } },
        promptForOpenOutputChannel: async s => errors.push(s), promptForSignIn: async () => commands.push('promptSignIn') },
    '../utils/osUtils': { isWindows: () => false, usingCmd: () => false },
};
const originalLoad = Module._load;
mocks['./uiUtils'] = mocks['../utils/uiUtils'];
Module._load = function(name, parent, isMain) {
    return mocks[name] || originalLoad.call(this, name, parent, isMain);
};
let submitSolution, testSolution, prepareSolutionFile, provider;
try {
    ({ submitSolution } = require('../out/src/commands/submit'));
    ({ testSolution } = require('../out/src/commands/test'));
    ({ prepareSolutionFile } = require('../out/src/utils/solutionFileUtils'));
    const { CustomCodeLensProvider } = require('../out/src/codelens/CustomCodeLensProvider');
    provider = new CustomCodeLensProvider();
} finally {
    Module._load = originalLoad;
}

test('every class gets its own submit/test lenses with a distinct target', () => {
    const lenses = provider.provideCodeLenses(document);
    const actions = lenses.filter(l => /leetcode\.(submit|test)Solution/.test(l.command.command));
    assert.equal(actions.length, 4);
    assert.deepEqual(actions.map(l => l.command.arguments[1].name), ['Solution', 'Solution', 'Solution2', 'Solution2']);
    assert.deepEqual(actions.map(l => l.range.start.line), [2, 2, 3, 3]);
    assert.equal(lenses.filter(l => l.command.command === 'leetcode.previewProblem').length, 1);
    assert.equal(lenses[0].command.command, 'leetcode.previewProblem');
    assert.equal(lenses[0].range.start.line, actions[0].range.start.line - 1);
});

test('nested Solution2 gets both lenses and description stays above the first matching class', () => {
    const nested = `// @lc app=leetcode.cn id=704 lang=java
class LeetCode704 {
    // @lc code=start
    class Solution {
        int search(int[] nums, int target) { return 1; }
        class Solution2 { int search(int[] nums, int target) { return 2; } }
    }
    // @lc code=end
}`;
    const nestedDocument = {
        ...document, getText: () => nested, lineCount: nested.split('\n').length,
        lineAt: i => ({ text: nested.split('\n')[i] }),
        positionAt: offset => ({ line: nested.slice(0, offset).split('\n').length - 1, character: 0 }),
    };
    const lenses = provider.provideCodeLenses(nestedDocument);
    assert.deepEqual(lenses.map(l => [l.command.command, l.range.start.line]), [
        ['leetcode.previewProblem', 2],
        ['leetcode.submitSolution', 3], ['leetcode.testSolution', 3],
        ['leetcode.submitSolution', 5], ['leetcode.testSolution', 5],
    ]);
});

test('associated local Java and Markdown offer description previews without remote submit actions', () => {
    const localSource = 'class OD123 {\n    // solve here\n    class Solution {}\n    class Solution2 {}\n}';
    const localDocument = { ...document, getText: () => localSource,
        positionAt: offset => ({ line: localSource.slice(0, offset).split('\n').length - 1 }) };
    try {
        localProblems = [{ file: 'C:/practice/problems/local.md', name: '本地题' }];
        const lenses = provider.provideCodeLenses(localDocument);
        assert.equal(lenses.length, 1);
        assert.equal(lenses[0].command.title, '题目描述');
        assert.equal(lenses[0].command.command, 'leetcode.previewLocalMarkdown');
        assert.deepEqual(lenses[0].command.arguments, [uri, true]);
        assert.equal(lenses[0].range.start.line, 1);
        const noSolution = provider.provideCodeLenses({ ...localDocument, getText: () => 'class Main {}' });
        assert.equal(noSolution[0].range.start.line, 0);
        const markdown = provider.provideCodeLenses({ ...localDocument, languageId: 'markdown', getText: () => '# 本地题' });
        assert.equal(markdown[0].range.start.line, 0);
        // Genuine LeetCode metadata keeps its online description and submit/test commands.
        assert.equal(provider.provideCodeLenses(document)[0].command.command, 'leetcode.previewProblem');
        shortcuts = ['submit', 'test'];
        assert.equal(provider.provideCodeLenses(localDocument), undefined);
        shortcuts = ['description']; localProblems = [];
        assert.equal(provider.provideCodeLenses(localDocument), undefined);
    } finally { localProblems = []; shortcuts = ['submit', 'test', 'description']; }
});

test('OD Java without statement comments keeps the local description above Solution', () => {
    const code = 'package com.haruhiro_lain.od.newsystem;\n\nclass ODP00513 {\n    public static void main(String[] args) {}\n\n    class Solution { long answer() { return 42; } }\n}';
    const odUri = { fsPath: 'C:/practice/newsystem/P00513.计算数列位置n的值.java' };
    const odDocument = { ...document, uri: odUri, getText: () => code,
        positionAt: offset => ({ line: code.slice(0, offset).split('\n').length - 1 }) };
    try {
        localProblems = [{ file: 'C:/practice/problems/P00513-计算数列位置N的值.md', name: '计算数列位置N的值' }];
        const lenses = provider.provideCodeLenses(odDocument);
        assert.equal(lenses.length, 1);
        assert.equal(lenses[0].range.start.line, 4);
        assert.deepEqual(lenses[0].command, { title: '题目描述', command: 'leetcode.previewLocalMarkdown', arguments: [odUri, true] });
        assert.doesNotMatch(code, /@lc|题目描述|hydro\.ac/);
    } finally { localProblems = []; }
});

test('submit/test use exactly the clicked solution and remove temporary files on success or error', async () => {
    const target = findJavaSolutions(source)[1];
    await submitSolution(uri, target);
    picks = [items => items.find(i => i.value === ':default')];
    await testSolution(uri, target);
    failExecution = true;
    await submitSolution(uri, target);
    picks = [items => items.find(i => i.value === ':default')];
    await testSolution(uri, target);
    failExecution = false;
    assert.equal(calls.length, 4);
    for (const call of calls) {
        assert.match(call.code, /return 2;/);
        assert.doesNotMatch(call.code, /return 1;|class Wrapper|class Solution2/);
        await assert.rejects(fs.stat(call.file), { code: 'ENOENT' });
    }
    assert.equal(results.length, 2);
    assert.ok(errors.some(e => e.includes('network failed')));
    assert.equal(saved, 4);
});

test('file commands offer an implementation picker, cancel cleanly, and custom tests keep the chosen code', async () => {
    calls = [];
    // Cancel at the solution picker: no executor call and no temporary file.
    picks = [];
    await submitSolution(uri);
    assert.equal(calls.length, 0);
    picks = [items => items.find(i => i.solution.name === 'Solution2'),
        items => items.find(i => i.value === ':direct')];
    vscode.window.showInputBox = async () => '[1,2,3]\\n4';
    await testSolution(uri);
    assert.equal(calls.length, 1);
    assert.match(calls[0].code, /return 2;/);
    assert.equal(calls[0].input, "'[1,2,3]\\n4'");
    await assert.rejects(fs.stat(calls[0].file), { code: 'ENOENT' });
});

test('single Java implementation works automatically and non-Java files keep the original path', async () => {
    document.getText = () => '// @lc app=leetcode.cn id=1 lang=java\nclass Solution { int f() { return 1; } }';
    const prepared = await prepareSolutionFile(uri);
    assert.match(await fs.readFile(prepared.filePath, 'utf8'), /class Solution/);
    await prepared.dispose();
    await assert.rejects(fs.stat(prepared.filePath), { code: 'ENOENT' });
    document.getText = () => 'class Solution { int f() { return 1; } }';
    const legacy = await prepareSolutionFile(uri);
    assert.equal(legacy.filePath, uri.fsPath);
    await legacy.dispose();
    document.getText = () => source;
    const previous = uri.fsPath;
    uri.fsPath = 'C:/practice/1.two-sum.py';
    const other = await prepareSolutionFile(uri);
    assert.equal(other.filePath, uri.fsPath);
    await other.dispose();
    uri.fsPath = previous;
});

test('expired sessions prompt re-login, do not show judge results, and still clean the selected code', async () => {
    const target = findJavaSolutions(source)[1];
    const before = results.length;
    executionError = commandResultError(0, '[ERROR] session expired, please login again [code=-1]', '');
    userStatus = 1;
    await submitSolution(uri, target);
    assert.equal(userStatus, 2);
    assert.equal(invalidated, 1);
    assert.match(warnings[0], /登录已过期/);
    assert.ok(commands.includes('leetcode.signin'));
    assert.equal(results.length, before);
    await assert.rejects(fs.stat(calls[calls.length - 1].file), { code: 'ENOENT' });
    // Test errors go through the same handler and are never mistaken for results.
    userStatus = 1;
    picks = [items => items.find(i => i.value === ':default')];
    await testSolution(uri, target);
    assert.equal(userStatus, 2);
    assert.equal(results.length, before);
    await assert.rejects(fs.stat(calls[calls.length - 1].file), { code: 'ENOENT' });
    await testSolution(uri, target);
    assert.ok(commands.includes('promptSignIn'));
    userStatus = 1;
    executionError = undefined;
});

test('concurrent authentication failures share one re-login prompt', async () => {
    const { handleCommandError } = require('../out/src/utils/commandErrorUtils');
    const previous = vscode.window.showWarningMessage;
    let closePrompt;
    let count = 0;
    vscode.window.showWarningMessage = () => { count++; return new Promise(resolve => { closePrompt = resolve; }); };
    const error = commandResultError(0, '[ERROR] session expired, please login again', '');
    try {
        const first = handleCommandError(error, 'template');
        const second = handleCommandError(error, 'description');
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(count, 1);
        closePrompt(undefined);
        await Promise.all([first, second]);
    } finally {
        vscode.window.showWarningMessage = previous;
        userStatus = 1;
    }
});

test('valid, unknown and stale CLI authentication errors never clear the user or prompt re-login', async () => {
    const { handleCommandError } = require('../out/src/utils/commandErrorUtils');
    const error = commandResultError(0, '[ERROR] session expired, please login again', '');
    const beforeInvalidated = invalidated, beforeCommands = commands.length, beforeWarnings = warnings.length;
    userStatus = 1;
    try {
        for (const outcome of ['valid', 'unknown', 'stale']) {
            authenticationOutcome = outcome;
            await handleCommandError(error, 'test');
        }
        assert.equal(invalidated, beforeInvalidated);
        assert.equal(userStatus, 1);
        assert.equal(commands.length, beforeCommands);
        assert.equal(warnings.length, beforeWarnings + 2);
        assert.match(warnings[beforeWarnings], /仍处于登录状态/);
        assert.match(warnings[beforeWarnings + 1], /已保留登录信息/);
    } finally { authenticationOutcome = 'expired'; }
});
