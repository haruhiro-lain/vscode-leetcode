const assert = require('node:assert/strict');
const { test, beforeEach } = require('node:test');
const Module = require('node:module');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
let call, payload, output, failure;
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {
    if (name === 'vscode') return { workspace: { getConfiguration: section => ({
        get: (key, fallback) => key === 'nodePath' ? '"C:/Program Files/nodejs/node.exe"' : section === 'http' ? undefined : fallback,
    }) } };
    if (name === 'child_process') return { execFile: (node, args, options, callback) => {
        call = { node, args, options };
        queueMicrotask(() => callback(failure, output));
        return { stdin: { on() {}, end: input => { payload = JSON.parse(input); } } };
    } };
    return originalLoad.call(this, name, parent, isMain);
};
let requestDirect;
try { ({ requestDirect } = require('../out/src/utils/directHttpUtils')); }
finally { Module._load = originalLoad; }
beforeEach(() => { output = JSON.stringify({ status: 200, data: { data: { userStatus: { isSignedIn: true } } } }); failure = undefined; });
const settings = { method: 'POST', headers: { cookie: 'LEETCODE_SESSION=fixture-secret; csrftoken=csrf;' }, data: { query: 'fixture query' } };

test('direct requests run outside the IDE proxy hook with credentials only on stdin', async () => {
    const result = await requestDirect('https://leetcode.cn/graphql/', settings);
    assert.equal(result.data.data.userStatus.isSignedIn, true);
    assert.equal(call.node, 'C:/Program Files/nodejs/node.exe');
    assert.equal(call.args.length, 1);
    assert.equal(call.args[0], path.resolve(__dirname, '../scripts/direct-http.cjs'));
    assert.doesNotMatch(JSON.stringify(call.args), /fixture-secret|csrftoken/);
    assert.equal(payload.headers.cookie, settings.headers.cookie);
    assert.equal(payload.url, 'https://leetcode.cn/graphql/');
    assert.equal(call.options.windowsHide, true);
    assert.match(call.options.env.NO_PROXY, /leetcode.cn/);
});

test('HTTP and worker failures retain classification without leaking credential-bearing errors', async () => {
    output = JSON.stringify({ status: 403, data: '<html>challenge</html>' });
    await assert.rejects(requestDirect('https://leetcode.cn/graphql/', settings), error => error.isAxiosError && error.response.status === 403);
    failure = Error('fixture-secret in unsafe child error');
    await assert.rejects(requestDirect('https://leetcode.cn/graphql/', settings), error => error.isAxiosError && !error.message.includes('fixture-secret'));
    failure = undefined; output = 'invalid JSON';
    await assert.rejects(requestDirect('https://leetcode.cn/graphql/', settings), /无效响应/);
    output = JSON.stringify({ error: 'Direct request failed' });
    await assert.rejects(requestDirect('https://leetcode.cn/graphql/', settings), error => error.isAxiosError);
});

test('packaged direct worker refuses non-China, insecure and credential-bearing URL targets', () => {
    const worker = path.resolve(__dirname, '../scripts/direct-http.cjs');
    for (const url of ['https://example.invalid/graphql', 'http://leetcode.cn/graphql', 'https://fixture@leetcode.cn/graphql', 'https://leetcode.cn:8443/graphql']) {
        const result = spawnSync(process.execPath, [worker], { input: JSON.stringify({ url, ...settings }), encoding: 'utf8', timeout: 10000 });
        assert.equal(result.status, 0, result.stderr);
        assert.deepEqual(JSON.parse(result.stdout), { error: 'Direct request failed' });
        assert.doesNotMatch(result.stdout + result.stderr, /fixture-secret/);
    }
});
