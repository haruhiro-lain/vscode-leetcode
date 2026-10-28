const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const { globalState } = require('../out/src/globalState');
let response, request, hostRequests = 0;
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {
    if (name === 'axios') return { default: async (url, settings) => { hostRequests++; request = { url, settings }; return response; } };
    if (name === './directHttpUtils') return { requestDirect: async (url, settings) => { request = { url, settings }; return response; } };
    if (name === '../shared') return { getUrl: () => 'https://leetcode.cn/graphql/' };
    if (name === 'vscode') return { workspace: { getConfiguration: () => ({ get: (_key, fallback) => fallback }) } };
    return originalLoad.call(this, name, parent, isMain);
};
let queryUserData;
try { ({ queryUserData } = require('../out/src/request/query-user-data')); }
finally { Module._load = originalLoad; }

test('candidate Cookie uses matching CSRF and website headers without persisting before validation', async () => {
    globalState.initialize({ globalState: { get: () => 'old-cookie', update: async () => {} } });
    response = { data: { data: { userStatus: { isSignedIn: true, username: 'fixture' } } } };
    assert.equal((await queryUserData('LEETCODE_SESSION=new; csrftoken=csrf;')).isSignedIn, true);
    assert.equal(globalState.getCookie(), 'old-cookie');
    assert.equal(request.settings.headers.cookie, 'LEETCODE_SESSION=new; csrftoken=csrf;');
    assert.equal(request.settings.headers['X-CSRFToken'], 'csrf');
    assert.equal(request.settings.headers.referer, 'https://leetcode.cn/');
    assert.equal(request.settings.headers.origin, 'https://leetcode.cn');
    assert.equal(request.settings.timeout, 15000);
    assert.equal(request.settings.proxy, false);
    assert.equal(hostRequests, 0, 'China direct must avoid IDE-patched HTTP even with proxySupport=override');
});

test('HTML challenges, GraphQL errors, missing and partial data are not treated as signed out', async () => {
    for (const data of ['<html>challenge</html>', {}, { errors: [{ message: 'upstream failed' }] },
        { data: { userStatus: null } }, { data: { userStatus: { username: 'fixture' } } },
        { data: { userStatus: { isSignedIn: true, username: null } } }]) {
        response = { data };
        await assert.rejects(queryUserData('fixture'), /有效的登录状态/);
    }
    response = { data: { data: { userStatus: { isSignedIn: false, username: null } } } };
    assert.equal((await queryUserData('fixture')).isSignedIn, false);
});
