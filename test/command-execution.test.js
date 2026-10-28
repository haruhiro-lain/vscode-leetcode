const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
let log = '';
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {
    if (name === 'vscode') return {
        workspace: { getConfiguration: () => ({ get: () => undefined }) },
        window: { withProgress: async (_options, task) => task({ report() {} }) },
        ProgressLocation: { Notification: 1 },
    };
    if (name === '../leetCodeChannel') return { leetCodeChannel: { append: text => { log += text; } } };
    return originalLoad.call(this, name, parent, isMain);
};
let executeCommand, executeCommandWithProgress;
const { getSessionRevision, advanceSessionRevision } = require('../out/src/utils/sessionRevision');
try {
    ({ executeCommand, executeCommandWithProgress } = require('../out/src/utils/cpUtils'));
} finally {
    Module._load = originalLoad;
}

test('successful templates keep stdout clean while stderr warnings stay in the output channel', async () => {
    const code = 'class Solution { String s = "ERROR"; }';
    const script = 'process.stderr.write("(node:29340) [DEP0040] DeprecationWarning: punycode\\n"); process.stdout.write(' + JSON.stringify(code) + ')';
    assert.equal(await executeCommand(process.execPath, ['-e', script], { shell: false }), code);
    assert.match(log, /DeprecationWarning/);
});

test('streamed CLI errors with exit zero reject instead of becoming generated code', async () => {
    const script = 'process.stdout.write("[ER"); setImmediate(() => process.stdout.write("ROR] session expired, please login again [code=-1]\\n"))';
    await assert.rejects(executeCommandWithProgress('fetch template', process.execPath, ['-e', script], { shell: false }),
        error => error.isAuthenticationError && error.exitCode === 0 && /session expired/.test(error.result));
});

test('stderr CLI errors and real process failures are not swallowed', async () => {
    await assert.rejects(executeCommand(process.execPath, ['-e', 'process.stderr.write("[ERROR] session expired, please login again\\n")'], { shell: false }),
        error => error.isAuthenticationError && error.exitCode === 0);
    await assert.rejects(executeCommand(process.execPath, ['-e', 'process.stdout.write("judge output");process.exit(3)'], { shell: false }),
        error => error.exitCode === 3 && error.result === 'judge output');
});

test('command errors retain the session generation from when the command started', async () => {
    const revision = getSessionRevision();
    const pending = executeCommand(process.execPath, ['-e', 'setTimeout(() => process.stdout.write("[ERROR] session expired\\n"), 25)'], { shell: false });
    advanceSessionRevision();
    await assert.rejects(pending, error => error.isAuthenticationError && error.sessionRevision === revision);
});
