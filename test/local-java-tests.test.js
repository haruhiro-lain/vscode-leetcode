const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { parseLocalTestFile, executeLocalJavaTests, resolveLocalJavaTarget } = require('../out/src/utils/localJavaTestCore');
const { findJavaSolutions } = require('../out/src/utils/javaSolutionUtils');
const { resolveLocalTestPath } = require('../out/src/utils/localTestPathUtils');

function javaOptions(write = () => {}) {
    const homes = [process.env.JAVA_HOME, 'D:/Environment/java/java17', path.join(os.homedir(), '.jdks/openjdk-17.0.1')].filter(Boolean);
    const ext = process.platform === 'win32' ? '.exe' : '';
    const home = homes.find(value => require('node:fs').existsSync(path.join(value, 'bin/javac' + ext)));
    return { javac: home ? path.join(home, 'bin/javac' + ext) : 'javac', java: home ? path.join(home, 'bin/java' + ext) : 'java', cancelled: false, write };
}
async function fixture(t, source, data) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'local-java-test-'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const sourcePath = path.join(directory, '练习.java');
    const testPath = path.join(directory, '练习.txt');
    await fs.writeFile(sourcePath, source);
    await fs.writeFile(testPath, JSON.stringify(data));
    let log = '';
    return { sourcePath, testPath, target: findJavaSolutions(source)[0], options: javaOptions(text => { log += text; }), log: () => log };
}

test('test file validation requires explicit inputs and expected values', () => {
    for (const content of ['[1,2,3]', '{}', '{"cases":[]}', '{"cases":[{"input":[]}]}', '{"cases":[{"input":"x","expected":1}]}']) {
        assert.throws(() => parseLocalTestFile(content));
    }
    assert.equal(parseLocalTestFile('\uFEFF{"cases":[{"input":[null],"expected":null}]}').cases.length, 1);
    assert.throws(() => parseLocalTestFile('{"cases":[{"input":[1],"expected":1,"comparison":"magic"}]}'));
});

test('local target positions are resolved against the disk text after LF/CRLF and formatting changes', () => {
    const editor = 'class Wrapper {\n class Solution { public int f() { return 1; } }\n class Solution2 { public int f() { return 2; } }\n}';
    const target = findJavaSolutions(editor)[1];
    const disk = '\uFEFF// formatted\r\n' + editor.replace(/\n/g, '\r\n');
    const actual = resolveLocalJavaTarget(disk, target);
    assert.equal(actual.name, 'Solution2');
    assert.equal(actual.start, findJavaSolutions(disk)[1].start);
    assert.equal(resolveLocalJavaTarget(disk, actual).start, actual.start);
    assert.throws(() => resolveLocalJavaTarget(disk), /多个/);
    assert.throws(() => resolveLocalJavaTarget(disk, { name: 'Solution3', start: 0 }), /删除或重命名/);
    const duplicate = 'class A { class Solution {} } class B { class Solution {} }';
    assert.throws(() => resolveLocalJavaTarget(duplicate, { name: 'Solution', start: 0 }), /多个/);
});

test('editor LF target executes the correct solution from a CRLF file on disk', async t => {
    const editor = '// @lc app=leetcode.cn id=283 lang=java\nclass Wrapper {\n class Solution1 { public int f(int x) { return -1; } }\n class Solution2 { public int f(int x) { return x + 1; } }\n}';
    const f = await fixture(t, editor.replace(/\n/g, '\r\n'), { method: 'f', cases: [{ input: [2], expected: 3 }] });
    assert.equal(await executeLocalJavaTests(f.sourcePath, f.testPath, findJavaSolutions(editor)[1], f.options), 0);
    assert.match(f.log(), /解法：Solution2/);
    assert.match(f.log(), /通过 1，失败 0/);
});

test('local method tests select Solution2, compare void mutations, and keep sources unchanged', async t => {
    const source = `class Wrapper {
      class Solution { public void moveZeroes(int[] a) { throw new Error("wrong solution"); } }
      class Solution2 { public void moveZeroes(int[] a) { int i=0; for(int n:a) if(n!=0) a[i++]=n; while(i<a.length) a[i++]=0; } }
    }`;
    const f = await fixture(t, source, { method: 'moveZeroes', cases: [
        { input: [[0, 1, 0, 3, 12]], expected: [1, 3, 12, 0, 0] },
        { input: [[0, -2147483648, 0, 2147483647]], expected: [-2147483648, 2147483647, 0, 0] },
    ] });
    assert.equal(await executeLocalJavaTests(f.sourcePath, f.testPath, findJavaSolutions(source)[1], f.options), 0);
    assert.match(f.log(), /通过 2，失败 0/);
    assert.equal(await fs.readFile(f.sourcePath, 'utf8'), source);
});

test('wrong answers and solution exceptions fail and later file cases still execute', async t => {
    const f = await fixture(t, 'class OD { class Solution { public String solve(String s) { if(s.equals("throw")) throw new IllegalStateException("unfinished"); return s; } } }', {
        method: 'solve', cases: [
            { input: ['中文\n"quoted" $() ;'], expected: '中文\n"quoted" $() ;' },
            { input: ['wrong'], expected: 'expected' },
            { input: ['throw'], expected: '' },
            { input: ['last'], expected: 'last' },
        ],
    });
    assert.equal(await executeLocalJavaTests(f.sourcePath, f.testPath, f.target, f.options), 1);
    assert.match(f.log(), /期望："expected"/);
    assert.match(f.log(), /实际："wrong"/);
    assert.match(f.log(), /IllegalStateException: unfinished/);
    assert.match(f.log(), /通过 2，失败 2/);
});

test('unordered nested outputs work and duplicates remain significant', async t => {
    const f = await fixture(t, 'class Wrapper { class Solution { public java.util.List<java.util.List<Integer>> f(int[][] x) { java.util.List<java.util.List<Integer>> out=new java.util.ArrayList<>(); for(int[] a:x){java.util.List<Integer> b=new java.util.ArrayList<>(); for(int n:a)b.add(n);out.add(b);}return out; } } }', {
        method: 'f', cases: [
            { input: [[[2, 1], [4, 3]]], expected: [[3, 4], [1, 2]], comparison: 'unorderedNested' },
            { input: [[[1], [1]]], expected: [[1]], comparison: 'unorderedNested' },
        ],
    });
    assert.equal(await executeLocalJavaTests(f.sourcePath, f.testPath, f.target, f.options), 1);
    assert.match(f.log(), /通过 1，失败 1/);
});

test('stdin mode runs the complete main separately for each file case', async t => {
    const f = await fixture(t, 'package demo; public class Main { public static void main(String[] a) { java.util.Scanner s=new java.util.Scanner(System.in); System.out.println(s.nextLine()); } }', {
        mode: 'stdin', cases: [{ input: '你好\n', expected: '你好' }, { input: 'again\n', expected: 'again\n' }],
    });
    assert.equal(await executeLocalJavaTests(f.sourcePath, f.testPath, undefined, f.options), 0);
    assert.match(f.log(), /通过 2，失败 0/);
});

test('local timeout terminates a stuck solution and continues with the next case', async t => {
    const f = await fixture(t, 'class Wrapper { class Solution { public int f(boolean loop) { while(loop){} return 1; } } }', {
        method: 'f', timeoutMs: 1500,
        cases: [{ input: [true], expected: 1 }, { input: [false], expected: 1 }],
    });
    assert.equal(await executeLocalJavaTests(f.sourcePath, f.testPath, f.target, f.options), 1);
    assert.match(f.log(), /运行超时/);
    assert.match(f.log(), /通过 1，失败 1/);
});

test('file command delegates locally without login, online executor or submission extraction', async () => {
    const calls = [];
    const mocks = {
        vscode: { window: { showQuickPick: async items => items.find(i => i.value === ':file') } },
        '../utils/localJavaTests': { runLocalJavaTests: async (...args) => calls.push(args) },
        '../leetCodeExecutor': {}, '../leetCodeManager': {}, '../shared': {}, '../utils/osUtils': {},
        '../utils/uiUtils': {}, '../utils/solutionFileUtils': {}, '../utils/commandErrorUtils': {},
        '../utils/wslUtils': {}, '../webview/leetCodeSubmissionProvider': {},
    };
    const module = { exports: {} };
    const code = await fs.readFile(path.join(__dirname, '../out/src/commands/test.js'), 'utf8');
    new Function('require', 'module', 'exports', code)(name => mocks[name], module, module.exports);
    const uri = { fsPath: 'C:/题目.java' }, target = { name: 'Solution2', start: 10 };
    await module.exports.testSolution(uri, target);
    assert.deepEqual(calls, [[uri, target]]);
});

test('local terminal uses original paths and configured JDK and keeps completed output visible', async () => {
    const calls = [], writes = [];
    const uri = { fsPath: 'D:/题目/283.移动零.java' }, file = { fsPath: path.join('D:/题目', '.vscode', 'LeetCode-CN', '283.移动零.txt') };
    const target = { name: 'Solution2', start: 22 };
    let terminalOptions;
    const mocks = {
        path: require('node:path'), 'fs-extra': {
            pathExists: async testPath => { assert.equal(testPath, file.fsPath); return true; },
            readFile: async () => '{"cases":[{"input":[[0,1]],"expected":[1,0]}]}' },
        './javaSolutionUtils': { findJavaSolutions },
        './localTestPathUtils': { resolveLocalTestPath },
        './uiUtils': { showFileSelectDialog: () => { throw Error('Must not open a file picker'); } },
        './localJavaTestCore': {
            parseLocalTestFile,
            executeLocalJavaTests: async (...args) => { calls.push(args); args[3].write('PASS\n'); return 0; },
        },
        vscode: {
            Uri: { file: fsPath => ({ fsPath }) },
            EventEmitter: class { constructor() { this.event = () => {}; } fire(text) { writes.push(text); } dispose() {} },
            workspace: {
                getWorkspaceFolder: () => ({ uri: { fsPath: 'D:/题目' } }),
                openTextDocument: async () => ({ isDirty: false, getText: () => '' }),
                getConfiguration: () => ({ get: key => key === 'configuration.runtimes' ? [{ path: 'D:/JDK', default: true }] : undefined }),
            },
            window: { createTerminal: options => { terminalOptions = options; return { show: () => options.pty.open() }; } },
        },
    };
    const module = { exports: {} };
    const code = await fs.readFile(path.join(__dirname, '../out/src/utils/localJavaTests.js'), 'utf8');
    new Function('require', 'module', 'exports', code)(name => mocks[name], module, module.exports);
    await module.exports.runLocalJavaTests(uri, target);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].slice(0, 3), [uri.fsPath, file.fsPath, target]);
    assert.match(calls[0][3].javac.replace(/\\/g, '/'), /D:\/JDK\/bin\/javac/);
    assert.match(writes.join(''), /本地测试结束/);
    assert.equal(terminalOptions.pty.onDidClose, undefined);
    terminalOptions.pty.close();
    assert.equal(calls[0][3].cancelled, true);
});

test('missing mirrored txt reports the full path without opening a file picker or terminal', async () => {
    const sourceUri = { fsPath: path.join('D:/题目', '283.移动零.java') };
    const expectedPath = path.join('D:/题目', '.vscode', 'LeetCode-CN', '283.移动零.txt');
    const mocks = {
        path, 'fs-extra': { pathExists: async value => { assert.equal(value, expectedPath); return false; } },
        './javaSolutionUtils': {}, './localJavaTestCore': {}, './localTestPathUtils': { resolveLocalTestPath },
        vscode: {
            workspace: { getWorkspaceFolder: () => ({ uri: { fsPath: 'D:/题目' } }), openTextDocument: async () => ({ isDirty: false }) },
            window: { showOpenDialog: () => { throw Error('Unexpected file picker'); }, createTerminal: () => { throw Error('Unexpected terminal'); } },
        },
    };
    const module = { exports: {} };
    const code = await fs.readFile(path.join(__dirname, '../out/src/utils/localJavaTests.js'), 'utf8');
    new Function('require', 'module', 'exports', code)(name => mocks[name], module, module.exports);
    await assert.rejects(module.exports.runLocalJavaTests(sourceUri), error => error.message.includes('未找到测试文件') && error.message.includes(expectedPath));
});
