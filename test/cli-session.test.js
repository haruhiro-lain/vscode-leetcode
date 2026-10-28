const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const helper = path.resolve(__dirname, '../scripts/cli-session.cjs');

test('CLI bridge uses endpoint-specific CLI cache, stdin credentials and silent atomic writes', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'leetcode-session-'));
    const run = (operation, endpoint, input) => spawnSync(process.execPath, [helper, operation, endpoint], {
        env: { ...process.env, HOME: home, USERPROFILE: home }, encoding: 'utf8', input: input && JSON.stringify(input), timeout: 10000,
    });
    const data = { cookie: 'LEETCODE_SESSION=fixture; csrftoken=csrf;', name: 'fixture', paid: true };
    try {
        const dir = path.join(home, '.lc/leetcode.cn');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'user.json'), JSON.stringify({ name: 'fixture', hash: 'keep-favorite-id' }));
        const result = run('write', 'leetcode-cn', data);
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout, '{}');
        assert.doesNotMatch(result.stderr, /fixture|csrf/);
        const saved = JSON.parse(fs.readFileSync(path.join(dir, 'user.json')));
        assert.deepEqual(saved, { hash: 'keep-favorite-id', name: 'fixture', paid: true, sessionId: 'fixture', sessionCSRF: 'csrf' });
        assert.equal(JSON.parse(run('read', 'leetcode-cn').stdout).cookie, 'LEETCODE_SESSION=fixture; csrftoken=csrf;');
        assert.equal(run('write', 'leetcode', data).status, 0);
        assert.equal(fs.existsSync(path.join(home, '.lc/leetcode/user.json')), true);
        assert.equal(run('write', 'leetcode-cn', { ...data, cookie: 'incomplete' }).status, 1);
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'user.json'))), saved);
        assert.equal(fs.readdirSync(dir).some(n => n.endsWith('.tmp')), false);
        assert.equal(run('write', 'leetcode-cn', { ...data, name: 'another' }).status, 0);
        assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'user.json'))).hash, undefined);
    } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
