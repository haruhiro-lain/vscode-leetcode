const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function getReleaseInfo(root) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    const version = manifest.version;
    if (manifest.name !== 'leetcode-cn' || manifest.publisher !== 'haruhiro-lain' || manifest.displayName !== 'LeetCode-CN') {
        throw Error('Only haruhiro-lain.leetcode-cn can be released by this workflow.');
    }
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw Error('A stable numeric package version is required.');
    if (lock.version !== version || lock.packages?.['']?.version !== version) throw Error('package.json and package-lock.json versions must match.');
    const lines = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8').split(/\r?\n/);
    const start = lines.findIndex(line => line.startsWith(`## [${version}]`));
    if (start < 0) throw Error(`Missing CHANGELOG.md entry for ${version}.`);
    let end = start + 1;
    while (end < lines.length && !/^## /.test(lines[end])) end++;
    const notes = lines.slice(start, end).join('\n').trim();
    if (!notes.includes('\n')) throw Error(`The ${version} changelog entry is empty.`);
    return { version, tag: `v${version}`, filename: `LeetCode-CN-${version}.vsix`, notes };
}

async function findOrMissing(request) {
    try { return (await request()).data; }
    catch (error) { if (error.status === 404) return undefined; throw error; }
}

async function publishRelease({ github, context, core, root = path.resolve(__dirname, '..') }) {
    if (context.repo.owner !== 'haruhiro-lain' || context.repo.repo !== 'vscode-leetcode' ||
        context.ref !== 'refs/heads/feat/personalization' || !['push', 'workflow_dispatch'].includes(context.eventName)) {
        throw Error('Releases are only published from haruhiro-lain/vscode-leetcode feat/personalization.');
    }
    const info = getReleaseInfo(root);
    const repo = context.repo;
    const api = github.rest.repos;
    let release = await findOrMissing(() => api.getReleaseByTag({ ...repo, tag: info.tag }));
    // The tag endpoint only guarantees published releases; list releases also exposes our drafts.
    if (!release) release = (await github.paginate(api.listReleases, { ...repo, per_page: 100 })).find(item => item.tag_name === info.tag);
    const checksumName = info.filename + '.sha256';
    if (release && !release.draft) {
        if (![info.filename, checksumName].every(name => release.assets.some(asset => asset.name === name && asset.state === 'uploaded'))) {
            throw Error(`Published release ${info.tag} is incomplete; inspect its assets before retrying.`);
        }
        core.info(`${info.tag} is already published; keeping the existing installer. ${release.html_url}`);
        return { skipped: true, url: release.html_url };
    }
    // Existing tags must keep their original commit, including when retrying a draft.
    const tagRef = await findOrMissing(() => github.rest.git.getRef({ ...repo, ref: `tags/${info.tag}` }));
    // getCommit reports an unknown tag as 422, while the dedicated ref endpoint returns 404.
    // Resolve through getCommit only after finding the tag, so annotated tags work too.
    if (tagRef) {
        const tagged = (await api.getCommit({ ...repo, ref: info.tag })).data;
        if (tagged.sha !== context.sha) throw Error(`${info.tag} already points to another commit; increase the package version.`);
    }
    if (release && release.target_commitish !== context.sha) throw Error(`${info.tag} draft belongs to another commit; increase the package version.`);
    const data = fs.readFileSync(path.join(root, 'dist', info.filename));
    if (!data.length) throw Error('The VSIX installer is empty.');
    const checksum = Buffer.from(`${crypto.createHash('sha256').update(data).digest('hex')}  ${info.filename}\n`);
    const body = `${info.notes}\n\n### 安装\n\n下载附件中的 \`${info.filename}\`，在 VS Code 扩展页面选择“从 VSIX 安装…”，或执行：\n\n\`\`\`powershell\ncode --install-extension ${info.filename} --force\n\`\`\`\n\n安装后执行“开发人员: 重新加载窗口”。运行需要 Node.js 22.13 或以上；首次从原版切换时，请卸载 \`LeetCode.vscode-leetcode\`，避免重复入口。\n`;
    if (!release) release = (await api.createRelease({ ...repo, tag_name: info.tag, target_commitish: context.sha,
        name: `LeetCode-CN ${info.version}`, body, draft: true, prerelease: false })).data;
    // Only replace our two assets while the release is still a draft. Published installers remain unchanged.
    for (const asset of release.assets) if ([info.filename, checksumName].includes(asset.name)) {
        await api.deleteReleaseAsset({ ...repo, asset_id: asset.id });
    }
    for (const [name, content] of [[info.filename, data], [checksumName, checksum]]) {
        await api.uploadReleaseAsset({ ...repo, release_id: release.id, name, data: content,
            headers: { 'content-type': 'application/octet-stream', 'content-length': content.length } });
    }
    const published = (await api.updateRelease({ ...repo, release_id: release.id, body, draft: false, make_latest: 'legacy' })).data;
    core.info(`Published ${info.tag}: ${published.html_url}`);
    return { skipped: false, url: published.html_url };
}

module.exports = { getReleaseInfo, publishRelease };

if (require.main === module) {
    try {
        if (process.argv[2] !== 'metadata') throw Error('Usage: node scripts/publish-release.cjs metadata');
        const info = getReleaseInfo(path.resolve(__dirname, '..'));
        if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,
            `version=${info.version}\ntag=${info.tag}\nfilename=${info.filename}\n`);
        console.log(`${info.tag}: ${info.filename}`);
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}
