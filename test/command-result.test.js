const assert = require('node:assert/strict');
const test = require('node:test');
const { commandResultError, isAuthenticationError } = require('../out/src/utils/commandResultUtils');

test('Node warnings and ERROR inside source or HTML do not turn exit zero into failure', () => {
    const stdout = 'class Solution { String text = "ERROR"; }\n<p>[ERROR] is example input</p>\n';
    const warnings = '(node:29340) [DEP0040] DeprecationWarning: The punycode module is deprecated.\n' +
        '(node:29340) Warning: Accessing non-existent property padLevels inside circular dependency\n';
    assert.equal(commandResultError(0, stdout, warnings), undefined);
});

test('an expired session reported with exit zero becomes a specific authentication error', () => {
    const output = '[ERROR] session expired, please login again [code=-1]\n';
    const error = commandResultError(0, output, '');
    assert.equal(isAuthenticationError(error), true);
    assert.match(error.message, /登录校验失败/);
    assert.doesNotMatch(error.message, /exit code|退出码 0/);
    assert.equal(error.exitCode, 0);
    assert.equal(error.result, output);
});

test('authentication errors on stderr with ANSI colors are also recognized', () => {
    const error = commandResultError(0, '', '\x1b[31m[ERROR]\x1b[0m session expired, please login again [code=-1]\r\n');
    assert.equal(isAuthenticationError(error), true);
    assert.equal(error.result, undefined);
});

test('other CLI errors remain failures even if the CLI exits zero', () => {
    const error = commandResultError(0, '[ERROR] request timed out\n', '');
    assert.equal(isAuthenticationError(error), false);
    assert.match(error.message, /request timed out/);
    assert.doesNotMatch(error.message, /退出码 0/);
});

test('nonzero exits and killed processes remain failures and retain useful output', () => {
    const error = commandResultError(3, 'judge output', 'network details');
    assert.equal(error.exitCode, 3);
    assert.equal(error.result, 'judge output');
    assert.equal(error.stderr, 'network details');
    assert.match(error.message, /退出码 3/);
    assert.match(commandResultError(null, '', '').message, /进程已被终止/);
    assert.equal(isAuthenticationError(undefined), false);
});
