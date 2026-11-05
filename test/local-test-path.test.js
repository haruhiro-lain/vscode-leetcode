const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { resolveLocalTestPath } = require('../out/src/utils/localTestPathUtils');

test('test files mirror the full source path under workspace .vscode/LeetCode-CN', () => {
    const root = path.resolve('workspace');
    const relative = path.join('algo', 'code', 'src', 'main', 'java', '专题', '283.移动零.java');
    assert.equal(resolveLocalTestPath(root, path.join(root, relative)), path.join(root, '.vscode', 'LeetCode-CN', relative.replace(/\.java$/, '.txt')));
    assert.equal(resolveLocalTestPath(root, path.join(root, 'Main.JAVA')), path.join(root, '.vscode', 'LeetCode-CN', 'Main.txt'));
});

test('same source names in different folders use distinct test files', () => {
    const root = path.resolve('workspace');
    assert.notEqual(resolveLocalTestPath(root, path.join(root, 'algo', 'a', 'Answer.java')), resolveLocalTestPath(root, path.join(root, 'algo', 'b', 'Answer.java')));
});

test('each workspace root controls its own test tree and nested paths stay relative', () => {
    const rootA = path.resolve('workspaceA');
    const rootB = path.resolve('workspaceB');
    assert.equal(resolveLocalTestPath(rootA, path.join(rootA, 'algo', 'Answer.java')), path.join(rootA, '.vscode', 'LeetCode-CN', 'algo', 'Answer.txt'));
    assert.equal(resolveLocalTestPath(rootB, path.join(rootB, 'algo', 'Answer.java')), path.join(rootB, '.vscode', 'LeetCode-CN', 'algo', 'Answer.txt'));
});

test('outside files are rejected while valid dotted directory names remain supported', () => {
    const root = path.resolve('workspace');
    assert.throws(() => resolveLocalTestPath(root, path.resolve('other', 'Answer.java')), /工作区/);
    assert.throws(() => resolveLocalTestPath(root, root), /工作区/);
    assert.throws(() => resolveLocalTestPath(root, path.join(root, 'Answer.py')), /Java/);
    assert.equal(resolveLocalTestPath(root, path.join(root, '..notes', 'a.b.java')), path.join(root, '.vscode', 'LeetCode-CN', '..notes', 'a.b.txt'));
});
