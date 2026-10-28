const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const { extensionId, buildAuthLoginUrl, isOwnLoginCallback } = require('../out/src/utils/extensionIdentity');
const opened = [], errors = [], cookies = [];
let endpoint = 'leetcode-cn';
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {
    const mocks = {
        vscode: { env: { uriScheme: 'vscode', appName: 'Visual Studio Code' },
            workspace: { getConfiguration: () => ({ get: () => endpoint }) },
            window: {
                withProgress: async (_opts, task) => task({ report() {} }),
                showInformationMessage() {}, showInputBox: async () => undefined,
            }, ProgressLocation: { Notification: 1 } },
        './leetCodeExecutor': { leetCodeExecutor: {} },
        './leetCodeChannel': { leetCodeChannel: { append() {} } },
        './utils/cpUtils': {}, './utils/wslUtils': {},
        './utils/uiUtils': { DialogType: { error: 1 }, openUrl: url => opened.push(url), promptForOpenOutputChannel: async e => errors.push(e) },
        './commands/plugin': { getLeetCodeEndpoint: () => endpoint },
        './globalState': { globalState: { setCookie: cookie => cookies.push(cookie), setUserStatus() {} } },
        './request/query-user-data': { queryUserData: async () => ({ isSignedIn: true, username: 'fixture', isPremium: false, avatar: '' }) },
    };
    return mocks[name] || originalLoad.call(this, name, parent, isMain);
};
let manager;
try { manager = require('../out/src/leetCodeManager').leetCodeManager; }
finally { Module._load = originalLoad; }
manager.setCookieToCli = async () => undefined;

test('CN, international and Insiders login URLs route back to the independent extension', () => {
    for (const base of ['https://leetcode.cn', 'https://leetcode.com']) {
        for (const scheme of ['vscode', 'vscode-insiders']) {
            const url = new URL(buildAuthLoginUrl(base, scheme));
            assert.equal(url.searchParams.get('path'), extensionId);
            assert.equal(url.pathname, '/authorize-login/' + scheme + '/');
        }
    }
    assert.equal(new URL(manager.getAuthLoginUrl()).searchParams.get('path'), extensionId);
    endpoint = 'leetcode';
    assert.equal(new URL(manager.getAuthLoginUrl()).hostname, 'leetcode.com');
    endpoint = 'leetcode-cn';
});

test('only the new extension authority accepts login callbacks and canceled input preserves state', async () => {
    assert.equal(isOwnLoginCallback('HARUHIRO-LAIN.LEETCODE-CN'), true);
    await manager.handleUriSignIn({ authority: 'leetcode.vscode-leetcode', query: 'cookie=wrong-fixture' });
    assert.equal(cookies.length, 0);
    assert.equal(errors.length, 1);
    const cookie = 'LEETCODE_SESSION=fixture; csrftoken=fixture;';
    await manager.handleUriSignIn({ authority: extensionId, query: 'cookie=' + encodeURIComponent(cookie) });
    assert.deepEqual(cookies, [cookie]);
    assert.equal(manager.getUser(), 'fixture');
    await manager.handleInputCookieSignIn();
    assert.equal(cookies.length, 1);
});
