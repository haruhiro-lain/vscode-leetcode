const assert = require('node:assert/strict');
const { test, beforeEach } = require('node:test');
const Module = require('node:module');
const { globalState } = require('../out/src/globalState');
const { getSessionRevision } = require('../out/src/utils/sessionRevision');
const { extensionId } = require('../out/src/utils/extensionIdentity');
const oldCookie = 'LEETCODE_SESSION=old; csrftoken=oldcsrf;';
const newCookie = 'LEETCODE_SESSION=new; csrftoken=newcsrf;';
const signedIn = { isSignedIn: true, username: 'fixture', isPremium: false, avatar: '' };
let query, manager, errors, writes, messages;
let bridgeEnv;
let signouts;
let contexts;
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {
    const mocks = {
        vscode: { env: { uriScheme: 'vscode', appName: 'VS Code' },
            commands: { executeCommand: async (command, key, value) => { if (command === 'setContext') contexts.set(key, value); } },
            window: { withProgress: async (_, fn) => fn({ report() {} }),
                showInformationMessage: msg => messages.push(msg) }, ProgressLocation: { Notification: 1 } },
        './leetCodeExecutor': { leetCodeExecutor: { node: process.execPath, signOut: async () => { signouts++; } } },
        './leetCodeChannel': { leetCodeChannel: { appendLine() {} } },
        './utils/cpUtils': { createEnvOption: () => bridgeEnv }, './utils/wslUtils': { useWsl: () => false },
        './utils/uiUtils': { DialogType: { error: 1 }, promptForOpenOutputChannel: async msg => errors.push(msg) },
        './commands/plugin': { getLeetCodeEndpoint: () => 'leetcode-cn' },
        './request/query-user-data': { queryUserData: (...args) => query(...args) },
    };
    return mocks[name] || originalLoad.call(this, name, parent, isMain);
};
let Manager;
try { Manager = require('../out/src/leetCodeManager').leetCodeManager.constructor; }
finally { Module._load = originalLoad; }

beforeEach(() => {
    const state = new Map();
    globalState.initialize({ globalState: { get: key => state.get(key), update: async (key, value) => state.set(key, value) } });
    globalState.removeAll();
    globalState.setCookie(oldCookie);
    globalState.setUserStatus(signedIn);
    errors = []; writes = []; messages = []; signouts = 0; contexts = new Map();
    query = async () => signedIn;
    manager = new Manager();
    manager.setCookieToCli = async (...args) => writes.push(args);
    manager.runCliSession = async () => ({});
});
const callback = cookie => ({ authority: extensionId, query: 'cookie=' + encodeURIComponent(cookie) });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('login UI context follows restored login, temporary network failures and explicit logout', async () => {
    await manager.getLoginStatus();
    assert.equal(contexts.get('leetcode.signedIn'), true);
    query = async () => { throw Error('network'); };
    assert.equal(await manager.confirmSessionExpired(), 'unknown');
    assert.equal(contexts.get('leetcode.signedIn'), true);
    await manager.getLoginStatus();
    assert.equal(contexts.get('leetcode.signedIn'), true);
    await manager.signOut();
    assert.equal(contexts.get('leetcode.signedIn'), false);
});

test('sign-in visibility is gated in the toolbar and command palette, with inverse sign-out visibility', () => {
    const manifest = require('../package.json');
    const toolbar = manifest.contributes.menus['view/title'];
    const palette = manifest.contributes.menus.commandPalette;
    for (const entries of [toolbar, palette]) {
        assert.match(entries.find(item => item.command === 'leetcode.signin').when, /!leetcode\.signedIn/);
        assert.match(entries.find(item => item.command === 'leetcode.signout').when, /(?:^|&&\s*)leetcode\.signedIn$/);
    }
});

test('authorization validates candidate without replacing old state, then synchronizes both stores and UI', async () => {
    query = async candidate => {
        assert.equal(candidate, newCookie);
        assert.equal(globalState.getCookie(), oldCookie);
        return signedIn;
    };
    await manager.handleUriSignIn(callback(newCookie));
    assert.equal(errors.length, 0);
    assert.equal(manager.getUser(), 'fixture');
    assert.equal(globalState.getCookie(), newCookie);
    assert.deepEqual(writes, [[newCookie, 'fixture', false]]);
    assert.equal(messages.length, 1);
    assert.equal(contexts.get('leetcode.signedIn'), true);
});

test('incomplete cookies and explicitly anonymous authorizations preserve existing credentials', async () => {
    await manager.handleUriSignIn(callback('LEETCODE_SESSION=incomplete'));
    query = async () => ({ isSignedIn: false, username: null });
    await manager.handleUriSignIn(callback(newCookie));
    assert.equal(globalState.getCookie(), oldCookie);
    assert.equal(writes.length, 0);
    assert.equal(errors.length, 2);
});

test('403 challenge, 502, timeout and malformed responses do not invalidate or overwrite login', async () => {
    for (const error of [{ response: { status: 403 }, isAxiosError: true },
        { response: { status: 502 }, isAxiosError: true }, { isAxiosError: true, code: 'ETIMEDOUT' }, Error('invalid response')]) {
        query = async () => { throw error; };
        assert.equal(await manager.confirmSessionExpired(), 'unknown');
        await manager.handleUriSignIn(callback(newCookie));
        assert.equal(globalState.getCookie(), oldCookie);
        assert.equal(globalState.getUserStatus().isSignedIn, true);
    }
    assert.match(errors[0], /网站验证|访问限制/);
    assert.equal(writes.length, 0);
});

test('CLI session-expired output is corrected when authoritative userStatus remains signed in', async () => {
    assert.equal(await manager.confirmSessionExpired(), 'valid');
    assert.equal(manager.getUser(), 'fixture');
    assert.equal(globalState.getCookie(), oldCookie);
    assert.equal(writes.length, 1);
    assert.equal(contexts.get('leetcode.signedIn'), true);
});

test('only an explicit signed-out response clears persisted and in-memory credentials', async () => {
    query = async () => ({ isSignedIn: false, username: null });
    assert.equal(await manager.confirmSessionExpired(), 'expired');
    assert.equal(globalState.getCookie(), undefined);
    assert.equal(globalState.getUserStatus(), undefined);
    assert.equal(manager.getUser(), undefined);
    assert.equal(contexts.get('leetcode.signedIn'), false);
});

test('concurrent expiration reports share one remote check', async () => {
    const wait = deferred(); let calls = 0;
    query = () => { calls++; return wait.promise; };
    const a = manager.confirmSessionExpired(), b = manager.confirmSessionExpired();
    wait.resolve(signedIn);
    assert.deepEqual(await Promise.all([a, b]), ['valid', 'valid']);
    assert.equal(calls, 1);
});

test('a command failure from before reauthorization cannot clear the new login', async () => {
    const oldRevision = getSessionRevision();
    await manager.handleUriSignIn(callback(newCookie));
    query = () => { throw Error('must not query stale request'); };
    assert.equal(await manager.confirmSessionExpired(oldRevision), 'stale');
    assert.equal(globalState.getCookie(), newCookie);
});

test('an old verification finishing after reauthorization cannot log out the new account', async () => {
    const wait = deferred();
    query = candidate => candidate === oldCookie ? wait.promise : Promise.resolve(signedIn);
    const verification = manager.confirmSessionExpired();
    await manager.handleUriSignIn(callback(newCookie));
    wait.resolve({ isSignedIn: false, username: null });
    assert.equal(await verification, 'stale');
    assert.equal(globalState.getCookie(), newCookie);
    assert.equal(manager.getUser(), 'fixture');
});

test('startup never treats a local CLI account record as proof of a valid remote session', async () => {
    query = async () => ({ isSignedIn: false, username: null });
    await manager.getLoginStatus();
    assert.equal(manager.getUser(), undefined);
    assert.equal(globalState.getCookie(), undefined);
});

test('startup network failure retains saved state rather than pretending the session expired', async () => {
    query = async () => { throw Error('network'); };
    await manager.getLoginStatus();
    assert.equal(globalState.getCookie(), oldCookie);
    assert.equal(manager.getUser(), 'fixture');
});

test('startup verification cannot overwrite a new callback and legacy CLI credentials are checked remotely', async () => {
    const wait = deferred();
    query = candidate => candidate === oldCookie ? wait.promise : Promise.resolve(signedIn);
    const startup = manager.getLoginStatus();
    await manager.handleUriSignIn(callback(newCookie));
    wait.resolve({ isSignedIn: false, username: null });
    await startup;
    assert.equal(globalState.getCookie(), newCookie);
    globalState.removeAll();
    manager.runCliSession = async () => ({ cookie: newCookie });
    await manager.getLoginStatus();
    assert.equal(globalState.getCookie(), newCookie);
    assert.equal(manager.getUser(), 'fixture');
});

test('failed local synchronization does not report success or save a half-completed authorization', async () => {
    manager.setCookieToCli = async () => { throw Error('local sync failed'); };
    await manager.handleUriSignIn(callback(newCookie));
    assert.equal(globalState.getCookie(), oldCookie);
    assert.equal(messages.length, 0);
    assert.match(errors[0], /local sync failed/);
});

test('overlapping callbacks finish with the latest authorization', async () => {
    const wait = deferred();
    query = candidate => candidate === newCookie ? wait.promise : Promise.resolve({ ...signedIn, username: 'latest' });
    const first = manager.handleUriSignIn(callback(newCookie));
    await new Promise(r => setImmediate(r));
    const latestCookie = 'LEETCODE_SESSION=latest; csrftoken=latest;';
    const last = manager.handleUriSignIn(callback(latestCookie));
    wait.resolve(signedIn);
    await Promise.all([first, last]);
    assert.equal(globalState.getCookie(), latestCookie);
    assert.equal(manager.getUser(), 'latest');
    assert.equal(writes.length, 1);
});

test('production manager waits for CLI bridge process completion and synchronizes real isolated cache', async () => {
    const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'leetcode-bridge-process-'));
    bridgeEnv = { ...process.env, HOME: home, USERPROFILE: home };
    manager.setCookieToCli = Manager.prototype.setCookieToCli;
    manager.runCliSession = Manager.prototype.runCliSession;
    try {
        await manager.handleUriSignIn(callback(newCookie));
        assert.deepEqual(errors, []);
        assert.equal(globalState.getCookie(), newCookie);
        const saved = JSON.parse(fs.readFileSync(path.join(home, '.lc/leetcode.cn/user.json'), 'utf8'));
        assert.equal(saved.sessionId, 'new');
        assert.equal(saved.sessionCSRF, 'newcsrf');
        assert.equal(manager.getUser(), 'fixture');
    } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('a valid CLI session recovers an expired or challenged extension cache', async () => {
    manager.runCliSession = async () => ({ cookie: newCookie });
    query = async candidate => candidate === oldCookie ? { isSignedIn: false, username: null } : signedIn;
    assert.equal(await manager.confirmSessionExpired(), 'valid');
    assert.equal(globalState.getCookie(), newCookie);
    globalState.setCookie(oldCookie);
    query = async candidate => { if (candidate === oldCookie) throw Error('403 challenge'); return signedIn; };
    await manager.getLoginStatus();
    assert.equal(globalState.getCookie(), newCookie);
    assert.equal(manager.getUser(), 'fixture');
});

test('one signed-out cache and another unverifiable cache do not prove expiration', async () => {
    manager.runCliSession = async () => ({ cookie: newCookie });
    query = async candidate => { if (candidate === newCookie) throw Error('403'); return { isSignedIn: false, username: null }; };
    assert.equal(await manager.confirmSessionExpired(), 'unknown');
    assert.equal(globalState.getCookie(), oldCookie);
});

test('both stored cookies must be explicitly signed out before invalidation', async () => {
    const checked = [];
    manager.runCliSession = async () => ({ cookie: newCookie });
    query = async candidate => { checked.push(candidate); return { isSignedIn: false, username: null }; };
    assert.equal(await manager.confirmSessionExpired(), 'expired');
    assert.deepEqual(checked, [oldCookie, newCookie]);
    assert.equal(globalState.getCookie(), undefined);
});

test('old command errors during an in-flight authorization cannot cancel the new login', async () => {
    const wait = deferred();
    query = () => wait.promise;
    const login = manager.handleUriSignIn(callback(newCookie));
    assert.equal(await manager.confirmSessionExpired(getSessionRevision()), 'stale');
    wait.resolve(signedIn);
    await login;
    assert.equal(globalState.getCookie(), newCookie);
    assert.equal(manager.getUser(), 'fixture');
});

test('logout waits for an already-started CLI write so old credentials cannot reappear afterward', async () => {
    const wait = deferred();
    manager.setCookieToCli = Manager.prototype.setCookieToCli;
    manager.runCliSession = () => wait.promise;
    const write = manager.setCookieToCli(newCookie, 'fixture');
    await new Promise(resolve => setImmediate(resolve));
    const logout = manager.signOut();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(signouts, 0);
    wait.resolve({});
    await Promise.all([write, logout]);
    assert.equal(signouts, 1);
    assert.equal(globalState.getCookie(), undefined);
    assert.equal(manager.getUser(), undefined);
});
