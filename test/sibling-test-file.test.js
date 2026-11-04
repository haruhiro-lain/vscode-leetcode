const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

function load(relative, mocks) {
    const module = { exports: {} };
    const code = require('node:fs').readFileSync(path.join(__dirname, '../out/src', relative), 'utf8');
    new Function('require', 'module', 'exports', code)(name => {
        if (Object.hasOwn(mocks, name)) return mocks[name];
        return require(name);
    }, module, module.exports);
    return module.exports;
}

test('file dialog selects the sibling txt, falls back to the source directory, and permits cancellation', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'leetcode-sibling-'));
    try {
        const source = path.join(directory, '11.盛最多水的容器.java');
        const txt = path.join(directory, '11.盛最多水的容器.txt');
        await fs.writeFile(txt, '[1,1]\n');
        const dialogs = [];
        const { showFileSelectDialog } = load('utils/uiUtils.js', {
            vscode: { Uri: { file: fsPath => ({ fsPath }) }, window: {
                showOpenDialog: async options => { dialogs.push(options); return undefined; },
            } },
            '../commands/plugin': {}, '../leetCodeChannel': {}, './settingUtils': {},
        });
        assert.equal(await showFileSelectDialog(source), undefined);
        assert.equal(dialogs[0].defaultUri.fsPath, txt);
        assert.equal(dialogs[0].canSelectMany, false);
        await fs.unlink(txt);
        await showFileSelectDialog(source);
        assert.equal(dialogs[1].defaultUri.fsPath, directory);
        await showFileSelectDialog();
        assert.equal(dialogs[2].defaultUri, undefined);
    } finally {
        await fs.rm(directory, { recursive: true, force: true });
    }
});
