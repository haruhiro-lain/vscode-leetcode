const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const { commandResultError } = require('../out/src/utils/commandResultUtils');
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {
    if (name === 'vscode') return { env: { appName: 'Visual Studio Code' }, workspace: {
        getConfiguration: () => ({ get: (_key, fallback) => fallback }),
        onDidChangeConfiguration: () => ({ dispose() {} }),
    } };
    if (name === './utils/uiUtils') return {};
    if (name === './utils/wslUtils') return { useWsl: () => false };
    if (name === './utils/cpUtils') return {};
    return originalLoad.call(this, name, parent, isMain);
};
let executor;
try {
    executor = require('../out/src/leetCodeExecutor').leetCodeExecutor;
} finally {
    Module._load = originalLoad;
}

test('submit never converts an authentication failure with stdout into a judge result', async () => {
    const error = commandResultError(0, '[ERROR] session expired, please login again [code=-1]', '');
    executor.executeCommandWithProgressEx = async () => { throw error; };
    await assert.rejects(executor.submitSolution('1.java'), e => e === error);
});

test('ordinary failed judge output remains available to the result view', async () => {
    const error = commandResultError(1, 'Wrong Answer\ninput: [1,2]', '');
    executor.executeCommandWithProgressEx = async () => { throw error; };
    assert.equal(await executor.submitSolution('1.java'), error.result);
});
