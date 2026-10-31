const assert = require('node:assert/strict');
const test = require('node:test');
const { parseProblemLanguages } = require('../out/src/utils/problemLanguages');
const Module = require('node:module');

test('real CLI language headers support Java, SQL and Pandas, ANSI colors and Windows line endings', () => {
    const sql = '[1] Find Loyal Customers\r\n\r\nTags: database\r\n\r\nLangs: \x1b[33mmssql\x1b[0m mysql oraclesql postgresql pythondata\r\n\r\n* database\r\n<p>body</p>';
    assert.deepEqual(parseProblemLanguages(sql), ['mssql', 'mysql', 'oraclesql', 'postgresql', 'pythondata']);
    assert.deepEqual(parseProblemLanguages('Langs: java cpp java python3\n* algorithms'), ['java', 'cpp', 'python3']);
});

test('missing, malformed or body-only language lines are never mistaken for support', () => {
    for (const text of ['', 'Langs:  \n', 'Langs: java <script>\n', '* algorithms\nLangs: java\n', '[ERROR] session expired']) {
        assert.equal(parseProblemLanguages(text), undefined, text);
    }
});

test('executor queries language metadata without requesting a Java template and preserves request failures', async () => {
    let failure, requests = [];
    const mocks = {
        vscode: { env: { uriScheme: 'vscode', appName: 'VS Code' }, workspace: {
            getConfiguration: () => ({ get: (_key, fallback) => fallback }), onDidChangeConfiguration: () => ({ dispose() {} }),
        } },
        './utils/uiUtils': {},
        './utils/wslUtils': { useWsl: () => false },
        './utils/cpUtils': { executeCommandWithProgress: async (_message, _node, args) => {
            requests.push(args); if (failure) throw failure;
            return 'Langs: mysql pythondata\n* database\n';
        } },
    };
    const originalLoad = Module._load;
    Module._load = function(name, parent, isMain) { return mocks[name] || originalLoad.call(this, name, parent, isMain); };
    let executor;
    try { ({ leetCodeExecutor: executor } = require('../out/src/leetCodeExecutor')); }
    finally { Module._load = originalLoad; }
    assert.deepEqual(await executor.getProblemLanguages('9000', true), ['mysql', 'pythondata']);
    assert.deepEqual(requests[0].slice(1), ['show', '9000', '-x']);
    failure = Error('session expired');
    await assert.rejects(executor.getProblemLanguages('9000', true), error => error === failure);
    executor.dispose();
});
