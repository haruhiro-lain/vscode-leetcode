const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { stageLegacyState, extensionId, legacyExtensionId, migrationKey, handoffName } = require('../scripts/migrate-legacy-state.cjs');
const { importLegacyState, migrateLegacyState } = require('../out/src/utils/legacyStateMigration');
const manifest = require('../package.json');

function fixture(oldState, newState = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'leetcode-identity-test-'));
    const database = path.join(root, 'state.vscdb');
    const db = new DatabaseSync(database);
    db.exec('CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value BLOB)');
    const write = db.prepare('INSERT INTO ItemTable VALUES (?, ?)');
    write.run(legacyExtensionId, JSON.stringify(oldState));
    write.run(extensionId, JSON.stringify(newState));
    write.run('unrelated.extension', JSON.stringify({ privateValue: 'must-not-copy' }));
    db.close();
    const values = new Map(Object.entries(newState));
    const context = {
        globalStorageUri: { fsPath: path.join(root, extensionId) },
        globalState: { get: key => values.get(key), update: async (key, value) => { values.set(key, value); } },
        asAbsolutePath: relative => path.resolve(__dirname, '..', relative),
    };
    return { root, database, values, context, handoff: path.join(root, extensionId, handoffName) };
}
const oldState = { 'leetcode-cookie': 'fixture-cookie', 'leetcode-user-status': {
    isSignedIn: true, isPremium: false, username: 'fixture-user', avatar: '',
}, 'leetcode.hasInited': true, unrelatedSetting: 'must-not-copy' };

test('independent identity is consistent with the manifest and lockfile', () => {
    const lock = require('../package-lock.json');
    assert.equal(manifest.publisher + '.' + manifest.name, extensionId);
    assert.equal(manifest.displayName, 'LeetCode-CN');
    assert.equal(lock.name, manifest.name);
    assert.equal(lock.packages[''].name, manifest.name);
    assert.equal(lock.version, manifest.version);
    assert.ok(manifest.activationEvents.includes('onUri'));
});

test('migration reads the old database without changing it and copies only allowed keys', async () => {
    const f = fixture(oldState);
    try {
        const before = crypto.createHash('sha256').update(fs.readFileSync(f.database)).digest('hex');
        assert.deepEqual(stageLegacyState(f.root), { status: 'staged', keys: 3 });
        const payload = JSON.parse(fs.readFileSync(f.handoff, 'utf8'));
        assert.deepEqual(Object.keys(payload.state).sort(), ['leetcode-cookie', 'leetcode-user-status', 'leetcode.hasInited'].sort());
        assert.equal(crypto.createHash('sha256').update(fs.readFileSync(f.database)).digest('hex'), before);
        assert.equal(await importLegacyState(f.context), 3);
        assert.equal(f.values.get('leetcode-cookie'), 'fixture-cookie');
        assert.equal(f.values.get('leetcode-user-status').username, 'fixture-user');
        assert.equal(f.values.get('leetcode.hasInited'), true);
        assert.equal(f.values.get(migrationKey), true);
        assert.equal(fs.existsSync(f.handoff), false);
        assert.equal(f.values.has('unrelatedSetting'), false);
        // A later logout must not restore the legacy cookie on restart.
        f.values.delete('leetcode-cookie');
        assert.equal(await importLegacyState(f.context), 0);
        assert.equal(f.values.has('leetcode-cookie'), false);
    } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('migration preserves a newer login as one pair instead of mixing accounts', async () => {
    const f = fixture(oldState, { 'leetcode-cookie': 'new-login-cookie' });
    try {
        stageLegacyState(f.root);
        assert.equal(await importLegacyState(f.context), 1);
        assert.equal(f.values.get('leetcode-cookie'), 'new-login-cookie');
        assert.equal(f.values.get('leetcode-user-status'), undefined);
        assert.equal(f.values.get('leetcode.hasInited'), true);
    } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('the activation fallback runs the packaged helper and consumes its handoff', async () => {
    const f = fixture(oldState);
    try {
        assert.equal(await migrateLegacyState(f.context, process.execPath), 3);
        assert.equal(f.values.get('leetcode-cookie'), 'fixture-cookie');
        assert.equal(fs.existsSync(f.handoff), false);
    } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('completed migrations do not stage old credentials again and invalid handoffs are rejected', async () => {
    const f = fixture(oldState, { [migrationKey]: true });
    try {
        assert.equal(stageLegacyState(f.root).status, 'already-migrated');
        assert.equal(fs.existsSync(f.handoff), false);
        f.values.delete(migrationKey);
        fs.mkdirSync(path.dirname(f.handoff), { recursive: true });
        fs.writeFileSync(f.handoff, JSON.stringify({ schemaVersion: 1, sourceId: 'unrelated.extension', targetId: extensionId, state: oldState }));
        await assert.rejects(importLegacyState(f.context), /迁移文件无效/);
        assert.equal(f.values.get('leetcode-cookie'), undefined);
    } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});
