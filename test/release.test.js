const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const test = require('node:test');
const { getReleaseInfo, publishRelease } = require('../scripts/publish-release.cjs');

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'leetcode-cn-release-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const manifest = { name: 'leetcode-cn', publisher: 'haruhiro-lain', displayName: 'LeetCode-CN', version: '0.22.9' };
    const lock = { version: '0.22.9', packages: { '': { version: '0.22.9' } } };
    const save = (name, value) => fs.writeFileSync(path.join(root, name), JSON.stringify(value));
    save('package.json', manifest); save('package-lock.json', lock);
    fs.writeFileSync(path.join(root, 'CHANGELOG.md'), '# Changes\r\n\r\n## [0.22.9] 自动发布\r\n- 上传安装包。\r\n\r\n## [0.22.8] Old\r\n- Old changes.\r\n');
    fs.mkdirSync(path.join(root, 'dist'));
    const filename = 'LeetCode-CN-0.22.9.vsix';
    const data = Buffer.from('tested VSIX package');
    fs.writeFileSync(path.join(root, 'dist', filename), data);
    const context = { repo: { owner: 'haruhiro-lain', repo: 'vscode-leetcode' }, sha: 'a'.repeat(40),
        ref: 'refs/heads/feat/personalization', eventName: 'push' };
    const calls = [], state = { release: undefined, tagged: undefined, failUpload: false };
    const missing = () => { throw Object.assign(Error('Not Found'), { status: 404 }); };
    const api = {
        getReleaseByTag: async () => state.release && !state.release.draft ? { data: state.release } : missing(),
        listReleases: async () => ({ data: state.release ? [state.release] : [] }),
        getCommit: async () => { if (state.tagged) return { data: { sha: state.tagged } }; throw Object.assign(Error('No commit found for SHA: v0.22.9'), { status: 422 }); },
        createRelease: async args => { calls.push(['create', args]); state.release = { id: 1, tag_name: args.tag_name, target_commitish: args.target_commitish, draft: true, assets: [], html_url: 'https://example.test/release' }; return { data: state.release }; },
        deleteReleaseAsset: async args => { calls.push(['delete', args]); },
        uploadReleaseAsset: async args => { calls.push(['upload', args]); if (state.failUpload) throw Error('Upload failed'); },
        updateRelease: async args => { calls.push(['publish', args]); return { data: { html_url: state.release.html_url } }; },
    };
    const options = { root, github: { rest: { repos: api, git: {
        getRef: async args => { assert.equal(args.ref, 'tags/v0.22.9'); return state.tagged ? { data: { object: { sha: state.tagged } } } : missing(); },
    } }, paginate: async (request, args) => (await request(args)).data }, context, core: { info: () => {} } };
    return { root, manifest, lock, save, filename, data, calls, state, api, options };
}

test('release metadata matches manifest, lockfile, stable tag and only the current changelog section', t => {
    const f = fixture(t), info = getReleaseInfo(f.root);
    assert.equal(info.tag, 'v0.22.9'); assert.equal(info.filename, f.filename);
    assert.match(info.notes, /上传安装包/); assert.doesNotMatch(info.notes, /Old/);
});

test('incorrect extension identity, unsafe versions and inconsistent lockfiles fail before publication', t => {
    const f = fixture(t);
    for (const change of [{ publisher: 'other' }, { name: 'leetcode' }, { version: '0.22.9\nfilename=bad' }, { version: '0.22.9-beta' }]) {
        f.save('package.json', { ...f.manifest, ...change }); assert.throws(() => getReleaseInfo(f.root));
    }
    f.save('package.json', f.manifest);
    for (const lock of [{ ...f.lock, version: '0.22.8' }, { ...f.lock, packages: { '': { version: '0.22.8' } } }]) {
        f.save('package-lock.json', lock); assert.throws(() => getReleaseInfo(f.root), /versions must match/);
    }
});

test('missing or empty version changelogs stop a release', t => {
    const f = fixture(t);
    for (const text of ['## [0.22.8]\n- Old', '## [0.22.9]\n\n## [0.22.8]\n- Old']) {
        fs.writeFileSync(path.join(f.root, 'CHANGELOG.md'), text); assert.throws(() => getReleaseInfo(f.root));
    }
});

test('publishing binds the tag to the tested commit, uploads exact bytes and checksum before making it public', async t => {
    const f = fixture(t), result = await publishRelease(f.options);
    assert.equal(result.skipped, false);
    assert.deepEqual(f.calls.map(([kind]) => kind), ['create', 'upload', 'upload', 'publish']);
    assert.equal(f.calls[0][1].target_commitish, f.options.context.sha); assert.equal(f.calls[0][1].draft, true);
    assert.equal(f.calls[1][1].name, f.filename); assert.deepEqual(f.calls[1][1].data, f.data);
    assert.equal(f.calls[2][1].data.toString(), `${crypto.createHash('sha256').update(f.data).digest('hex')}  ${f.filename}\n`);
    assert.equal(f.calls[3][1].draft, false); assert.match(f.calls[3][1].body, /从 VSIX 安装/);
});

test('a published version is skipped without replacing assets even after another commit', async t => {
    const f = fixture(t);
    f.state.release = { draft: false, html_url: 'https://example.test/v0.22.9', assets: [f.filename, f.filename + '.sha256'].map(name => ({ name, state: 'uploaded' })) };
    f.state.tagged = 'b'.repeat(40);
    assert.equal((await publishRelease(f.options)).skipped, true); assert.equal(f.calls.length, 0);
});

test('an incomplete published version is reported without changing existing installers', async t => {
    const f = fixture(t); f.state.release = { draft: false, assets: [] };
    await assert.rejects(publishRelease(f.options), /incomplete/); assert.equal(f.calls.length, 0);
});

test('a failed upload remains a draft and a retry can replace only its own incomplete assets', async t => {
    const f = fixture(t); f.state.failUpload = true;
    await assert.rejects(publishRelease(f.options), /Upload failed/);
    assert.equal(f.state.release.draft, true); assert.ok(!f.calls.some(([kind]) => kind === 'publish'));
    f.state.failUpload = false; f.state.tagged = f.options.context.sha;
    f.state.release.assets = [{ id: 2, name: f.filename }, { id: 3, name: 'unrelated.txt' }]; f.calls.length = 0;
    await publishRelease(f.options);
    assert.deepEqual(f.calls.map(([kind]) => kind), ['delete', 'upload', 'upload', 'publish']);
    assert.equal(f.calls[0][1].asset_id, 2);
});

test('an existing tag on another commit cannot be moved or released', async t => {
    const f = fixture(t); f.state.tagged = 'b'.repeat(40);
    await assert.rejects(publishRelease(f.options), /another commit/); assert.equal(f.calls.length, 0);
});

test('a new version with no tag is published without treating the commit endpoint 422 as a failure', async t => {
    const f = fixture(t);
    f.api.getCommit = async () => { assert.fail('Unknown tags must not be sent to the commit endpoint.'); };
    assert.equal((await publishRelease(f.options)).skipped, false);
});

test('a draft from another commit cannot be replaced even before its tag exists', async t => {
    const f = fixture(t);
    f.state.release = { id: 1, tag_name: 'v0.22.9', draft: true, target_commitish: 'b'.repeat(40), assets: [] };
    await assert.rejects(publishRelease(f.options), /draft belongs to another commit/); assert.equal(f.calls.length, 0);
});

test('forks, pull requests and other branches cannot publish, and API failures are preserved', async t => {
    const f = fixture(t);
    for (const change of [{ eventName: 'pull_request' }, { ref: 'refs/heads/master' }, { repo: { owner: 'other', repo: 'vscode-leetcode' } }]) {
        await assert.rejects(publishRelease({ ...f.options, context: { ...f.options.context, ...change } }), /only published from/);
    }
    f.api.getReleaseByTag = async () => { throw Object.assign(Error('Forbidden'), { status: 403 }); };
    await assert.rejects(publishRelease(f.options), /Forbidden/); assert.equal(f.calls.length, 0);
});

test('missing or empty installers fail before creating a draft', async t => {
    const f = fixture(t), file = path.join(f.root, 'dist', f.filename);
    fs.writeFileSync(file, ''); await assert.rejects(publishRelease(f.options), /empty/);
    fs.unlinkSync(file); await assert.rejects(publishRelease(f.options), /ENOENT/); assert.equal(f.calls.length, 0);
});
