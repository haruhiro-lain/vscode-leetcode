const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { resolveConfiguredWorkspacePath } = require('../out/src/utils/workspacePathUtils');
const manifest = require('../package.json');

test('path and description shortcut settings accept workspace overrides', () => {
    const properties = Object.assign({}, ...[].concat(manifest.contributes.configuration).map(c => c.properties));
    for (const key of ['leetcode.workspaceFolder', 'leetcode.filePath', 'leetcode.editor.shortcuts', 'leetcode.defaultLanguage']) {
        assert.equal(properties[key].scope, 'window', key);
    }
});

test('the same shared path follows the checkout on another PC', () => {
    const template = '${workspaceFolder}/algo/code';
    for (const root of [path.resolve('pc-one', 'repo'), path.resolve('pc-two', 'another-checkout')]) {
        assert.equal(resolveConfiguredWorkspacePath(template, root), path.join(root, 'algo', 'code'));
    }
});

test('relative paths resolve from the opened repository', () => {
    const root = path.resolve('repo');
    assert.equal(resolveConfiguredWorkspacePath(' algo/code ', root), path.join(root, 'algo', 'code'));
});

test('existing absolute user paths still work without an opened repository', () => {
    const root = path.resolve('existing', 'leetcode');
    assert.equal(resolveConfiguredWorkspacePath(root), root);
});

test('workspace paths without an opened folder fail before any directory is created', () => {
    assert.throws(() => resolveConfiguredWorkspacePath('${workspaceFolder}/algo/code'), /打开仓库文件夹/);
    assert.throws(() => resolveConfiguredWorkspacePath('algo/code'), /打开仓库文件夹/);
});

test('unknown variables and empty paths never create literal placeholder folders', () => {
    assert.throws(() => resolveConfiguredWorkspacePath('${unknown}/algo', path.resolve('repo')), /仅支持/);
    assert.throws(() => resolveConfiguredWorkspacePath('   ', path.resolve('repo')), /设置/);
});
