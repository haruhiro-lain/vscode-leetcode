const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { findExistingProblemFiles } = require('../out/src/utils/existingProblemUtils');
let root;
const extensions = ['java', 'py', 'cpp'];
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'leetcode-existing-')); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });
async function write(relative, content = '') {
    const file = path.join(root, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
    return file;
}
const search = (id, name = '两数之和') => findExistingProblemFiles(root, id, name, extensions);

test('searches across categories and languages, with exact IDs instead of substrings', async () => {
    const hot = await write('src/LeetCodeHot100/hash/1.两数之和.java', '// @lc app=leetcode.cn id=1 lang=java');
    const carl = await write('src/programmercarl/array/my-answer.py', '# @lc app=leetcode id=1 lang=python3');
    const cpp = await write('src/LeetCode/1.two-sum.cpp');
    await write('src/LeetCode/11.盛最多水的容器.java');
    await write('src/LeetCode/101.对称二叉树.java');
    await write('src/docs/1.题目.md');
    assert.deepEqual(new Set(await search('1')), new Set([hot, carl, cpp]));
});

test('metadata wins over the filename and other-platform metadata never matches', async () => {
    const renamed = await write('src/custom/Solution.java', '/*\n * @lc app=leetcode.cn id=0001 lang=java\n */');
    await write('src/1.wrong.java', '// @lc app=leetcode.cn id=11 lang=java');
    await write('src/1.other.java', '// @lc app=kamacoder id=1 lang=java');
    assert.deepEqual(await search('1'), [renamed]);
    const interview = await write('src/custom/interview.java', '// @lc app=leetcode.cn id=面试题02.07 lang=java');
    assert.deepEqual(await search('面试题02.07'), [interview]);
    const codeOnly = await write('src/2.answer.java', '// @lc code=start\nclass Solution {}\n// @lc code=end');
    assert.deepEqual(await search('2'), [codeOnly]);
});

test('legacy IDs work without treating a different platform exercise as LeetCode 54', async () => {
    const old = await write('src/LeetCode/Others/leetcode_169.java', '// 169. 多数元素');
    assert.deepEqual(await search('169', '多数元素'), [old]);
    const zero = await write('src/LeetCode/Algorithm/twoPointers_1_283.java', '// 283. 移动零');
    assert.deepEqual(await search('283', '移动零'), [zero]);
    await write('src/LeetCode/String/String_3_54.java', '// 54. 替换数字');
    await write('src/od/task_54.java');
    await write('src/od/54.其他平台.java');
    assert.deepEqual(await search('54', '螺旋矩阵'), []);
    const intersection = await write('src/LeetCode/listnode_6_160.java', '// 面试题 02.07. 链表相交\n' + '\n'.repeat(50) + '// 1. swap pointers');
    assert.deepEqual(await search('160', '相交链表'), [intersection]);
});

test('build output, caches and files outside the root do not become candidates', async () => {
    for (const directory of ['target', 'node_modules', '.git', '.backups', 'out', 'tmp', 'build', 'bin']) {
        await write(directory + '/1.answer.java', '// @lc app=leetcode.cn id=1 lang=java');
    }
    const source = await write('src/0001.answer.java');
    assert.deepEqual(await search('1'), [source]);
    assert.deepEqual(await findExistingProblemFiles(path.join(root, 'missing'), '1', '', extensions), []);
});
