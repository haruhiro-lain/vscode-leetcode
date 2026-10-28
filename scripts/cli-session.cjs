// Bridge to the CLI's own cache layout. Credentials travel only over stdio.
const fs = require('fs');
const path = require('path');
const config = require('vsc-leetcode-cli/lib/config');
const file = require('vsc-leetcode-cli/lib/file');
config.app = process.argv[3] === 'leetcode-cn' ? 'leetcode.cn' : 'leetcode';
const target = file.cacheFile('../user');
const read = () => fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, 'utf8')) : {};

async function main() {
    if (process.argv[2] === 'read') {
        const user = read();
        process.stdout.write(JSON.stringify({ cookie: user.sessionId
            ? `LEETCODE_SESSION=${user.sessionId}; csrftoken=${user.sessionCSRF || ''};` : undefined }));
        return;
    }
    if (process.argv[2] !== 'write') throw Error('Invalid operation');
    let input = '';
    for await (const chunk of process.stdin) {
        input += chunk;
        if (input.length > 65536) throw Error('Invalid input');
    }
    const { cookie, name, paid } = JSON.parse(input);
    const session = /(?:^|;\s*)LEETCODE_SESSION=([^;]+)/.exec(cookie || '');
    const csrf = /(?:^|;\s*)csrftoken=([^;]+)/.exec(cookie || '');
    if (!session || !csrf || typeof name !== 'string' || !name || /[\r\n]/.test(cookie)) throw Error('Invalid credentials');
    let old;
    try { old = read(); } catch (_) { old = {}; }
    const user = { ...(old.name === name && old.hash ? { hash: old.hash } : {}),
        name, paid: paid === true, sessionId: session[1], sessionCSRF: csrf[1] };
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temporary = target + '.' + process.pid + '.tmp';
    try {
        fs.writeFileSync(temporary, JSON.stringify(user), { mode: 0o600, flag: 'wx' });
        fs.renameSync(temporary, target);
    } finally {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
    process.stdout.write('{}');
}
main().catch(() => { process.stderr.write('CLI session synchronization failed.'); process.exitCode = 1; });
