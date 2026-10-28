// Copy only this extension's legacy memento into its new storage directory.
// Read VS Code's live database without modifying it; the new extension imports
// through its own globalState API on activation and removes the handoff file.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const extensionId = 'haruhiro-lain.leetcode-cn';
const legacyExtensionId = 'leetcode.vscode-leetcode';
const migrationKey = 'leetcode-cn.legacyStateMigratedV1';
const handoffName = 'legacy-login-migration.json';

function allowedState(state) {
    const result = {};
    if (!state || typeof state !== 'object' || Array.isArray(state)) return result;
    if (typeof state['leetcode-cookie'] === 'string' && state['leetcode-cookie'].trim()) result['leetcode-cookie'] = state['leetcode-cookie'];
    const user = state['leetcode-user-status'];
    if (user && typeof user === 'object' && typeof user.isSignedIn === 'boolean' && typeof user.username === 'string') {
        result['leetcode-user-status'] = {
            isSignedIn: user.isSignedIn, isPremium: user.isPremium === true,
            username: user.username, avatar: typeof user.avatar === 'string' ? user.avatar : '',
            ...(typeof user.isVerified === 'boolean' ? { isVerified: user.isVerified } : {}),
        };
    }
    if (typeof state['leetcode.hasInited'] === 'boolean') result['leetcode.hasInited'] = state['leetcode.hasInited'];
    return result;
}

function stageLegacyState(storageRoot) {
    const root = path.resolve(storageRoot);
    const database = path.join(root, 'state.vscdb');
    if (!fs.existsSync(database)) return { status: 'no-database', keys: 0 };
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(database, { readOnly: true });
    let legacy, current;
    try {
        db.exec('PRAGMA busy_timeout = 5000');
        const read = id => {
            const row = db.prepare('SELECT value FROM ItemTable WHERE key = ? COLLATE NOCASE').get(id);
            return row ? JSON.parse(Buffer.isBuffer(row.value) ? row.value.toString('utf8') : row.value) : {};
        };
        current = read(extensionId);
        legacy = read(legacyExtensionId);
    } finally { db.close(); }
    if (current[migrationKey] === true) return { status: 'already-migrated', keys: 0 };
    const state = allowedState(legacy);
    if (!Object.keys(state).length) return { status: 'no-legacy-state', keys: 0 };
    const directory = path.join(root, extensionId);
    const file = path.join(directory, handoffName);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    try {
        fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, sourceId: legacyExtensionId, targetId: extensionId, state }), { flag: 'wx', mode: 0o600 });
    } catch (error) {
        if (error.code === 'EEXIST') return { status: 'pending', keys: Object.keys(state).length };
        throw error;
    }
    return { status: 'staged', keys: Object.keys(state).length };
}

function defaultUserDataDir() {
    if (process.env.VSCODE_PORTABLE) return path.join(process.env.VSCODE_PORTABLE, 'user-data');
    if (process.platform === 'win32') return path.join(process.env.APPDATA, 'Code');
    if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Code');
    return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'Code');
}

function storageRoots(userDataDir) {
    const user = path.join(path.resolve(userDataDir), 'User');
    const roots = [path.join(user, 'globalStorage')];
    const profiles = path.join(user, 'profiles');
    if (fs.existsSync(profiles)) {
        for (const entry of fs.readdirSync(profiles, { withFileTypes: true })) {
            if (entry.isDirectory()) roots.push(path.join(profiles, entry.name, 'globalStorage'));
        }
    }
    return roots.filter(root => fs.existsSync(path.join(root, 'state.vscdb')));
}

module.exports = { stageLegacyState, storageRoots, defaultUserDataDir, allowedState, extensionId, legacyExtensionId, migrationKey, handoffName };
if (require.main === module) {
    try {
        const args = process.argv.slice(2);
        let roots;
        if (args.length === 2 && args[0] === '--storage-root') roots = [args[1]];
        else if (!args.length || args.length === 2 && args[0] === '--user-data-dir') roots = storageRoots(args[1] || defaultUserDataDir());
        else throw Error('Invalid migration arguments');
        const summaries = roots.map(stageLegacyState);
        // Never print credential values, user details, or serialized mementos.
        process.stdout.write(JSON.stringify({ profilesChecked: roots.length, staged: summaries.filter(s => s.status === 'staged').length, pending: summaries.filter(s => s.status === 'pending').length }));
    } catch (_) {
        process.stderr.write('Unable to prepare legacy login migration. Use Node.js 22.13 or newer and retry the installer.\n');
        process.exitCode = 1;
    }
}
