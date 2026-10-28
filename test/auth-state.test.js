const assert = require('node:assert/strict');
const test = require('node:test');
const { globalState } = require('../out/src/globalState');

test('invalidating credentials clears both persisted values and the in-memory login cache', () => {
    const values = new Map();
    globalState.initialize({ globalState: {
        get: key => values.get(key),
        update: (key, value) => { values.set(key, value); return Promise.resolve(); },
    } });
    globalState.setCookie('test-cookie');
    globalState.setUserStatus({ isSignedIn: true, isPremium: true, username: 'test', avatar: '' });
    globalState.removeAll();
    assert.equal(globalState.getCookie(), undefined);
    assert.equal(globalState.getUserStatus(), undefined);
    globalState.setCookie('another-test-cookie');
    globalState.removeCookie();
    assert.equal(globalState.getCookie(), undefined);
});
