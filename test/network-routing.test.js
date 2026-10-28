const assert = require('node:assert/strict');
const { test, beforeEach } = require('node:test');
const Module = require('node:module');
const { spawnSync } = require('node:child_process');
let mode, proxy;
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {
    if (name === 'vscode') return { workspace: { getConfiguration: section => ({
        get: (key, fallback) => section === 'http' && key === 'proxy' ? proxy : key === 'cnConnectionMode' ? mode ?? fallback : fallback,
    }) } };
    return originalLoad.call(this, name, parent, isMain);
};
let network;
try { network = require('../out/src/utils/networkUtils'); }
finally { Module._load = originalLoad; }
beforeEach(() => { mode = undefined; proxy = 'http://127.0.0.1:7897'; });

test('China login and API URLs default to direct while international and unrelated domains retain the proxy', () => {
    for (const url of ['https://leetcode.cn/graphql/', 'https://leetcode.cn/graphql']) {
        assert.equal(network.getRequestProxy(url), false);
    }
    for (const url of ['https://leetcode.com/graphql/', 'https://leetcode.cn.evil.test/', 'https://notleetcode.cn/']) {
        assert.deepEqual(network.getRequestProxy(url), { protocol: 'http', host: '127.0.0.1', port: 7897 });
    }
});

test('proxy mode honors explicit VS Code proxy settings, authentication and inherited proxies', () => {
    mode = 'proxy';
    assert.deepEqual(network.getRequestProxy('https://leetcode.cn/graphql'), { protocol: 'http', host: '127.0.0.1', port: 7897 });
    proxy = 'https://fixture%40user:fixture%20password@proxy.example';
    assert.deepEqual(network.getRequestProxy('https://leetcode.cn/graphql'), {
        protocol: 'https', host: 'proxy.example', port: 443, auth: { username: 'fixture@user', password: 'fixture password' },
    });
    proxy = undefined;
    assert.equal(network.getRequestProxy('https://leetcode.cn/graphql'), undefined);
});

test('CLI routing preserves existing exclusions, fixes conflicting proxy casing, and never mutates process environment', () => {
    const source = { HTTPS_PROXY: 'http://old-proxy:8000', http_proxy: 'http://other-proxy:9000',
        NO_PROXY: 'localhost', no_proxy: 'example.internal', OTHER: 'keep' };
    const snapshot = { ...source };
    const env = network.createNetworkEnvironment(source);
    assert.equal(env.HTTPS_PROXY, proxy);
    assert.equal(env.https_proxy, proxy);
    assert.equal(env.HTTP_PROXY, proxy);
    assert.equal(env.http_proxy, proxy);
    assert.equal(env.NO_PROXY, env.no_proxy);
    assert.match(env.NO_PROXY, /localhost,example.internal,leetcode.cn,.leetcode.cn/);
    assert.equal(env.OTHER, 'keep');
    assert.deepEqual(source, snapshot);
});

test('actual legacy request and Axios proxy resolvers agree on China direct and international proxy routes', () => {
    const source = { ...process.env, NO_PROXY: 'localhost', no_proxy: 'example.internal' };
    const env = network.createNetworkEnvironment(source);
    const script = `
      const getLegacy = require('request/lib/getProxyFromURI');
      const getAxios = require('proxy-from-env').getProxyForUrl;
      const urls = ['https://leetcode.cn/graphql', 'https://leetcode.cn/session/', 'https://api.leetcode.cn/', 'https://leetcode.com/graphql', 'https://leetcode.cn.evil.test/'];
      console.log(JSON.stringify(urls.map(url => ({ legacy: getLegacy(require('url').parse(url)), axios: getAxios(url) }))));`;
    const result = spawnSync(process.execPath, ['-e', script], { cwd: require('path').resolve(__dirname, '..'), env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const routes = JSON.parse(result.stdout);
    assert.deepEqual(routes.slice(0, 3), Array(3).fill({ legacy: null, axios: '' }));
    assert.deepEqual(routes.slice(3), Array(2).fill({ legacy: proxy, axios: proxy }));
});

test('proxy mode leaves existing NO_PROXY choices intact and setting can be shared in the workspace', () => {
    mode = 'proxy';
    const source = { HTTPS_PROXY: 'http://system:8080', NO_PROXY: 'localhost' };
    assert.equal(network.createNetworkEnvironment(source).NO_PROXY, 'localhost');
    proxy = undefined;
    assert.deepEqual(network.createNetworkEnvironment(source), source);
    const setting = require('../package.json').contributes.configuration[0].properties['leetcode.cnConnectionMode'];
    assert.equal(setting.default, 'direct');
    assert.equal(setting.scope, 'window');
    assert.deepEqual(setting.enum, ['direct', 'proxy']);
});
