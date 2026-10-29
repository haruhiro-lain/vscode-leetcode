const assert = require('node:assert/strict');
const { test } = require('node:test');
const { findLocalCompletion, completionEdit, withLocalCompletion } = require('../out/src/studyPlans/localCompletion');
const { arabicModuleName } = require('../out/src/studyPlans/moduleLabel');
const marker = '<!-- leetcode-cn:passed -->';

test('one completion checkbox is inserted below the title and toggled without touching the problem body', () => {
    const original = '# 预订酒店\n\n题面\n\n- [x] 普通任务\n';
    const unchecked = withLocalCompletion(original, false);
    assert.equal(unchecked, '# 预订酒店\n\n- [ ] 已通过 ' + marker + '\n\n题面\n\n- [x] 普通任务\n');
    assert.equal(findLocalCompletion(unchecked).checked, false);
    const checked = withLocalCompletion(unchecked, true);
    assert.equal(findLocalCompletion(checked).checked, true);
    assert.equal(checked.split(marker).length - 1, 1);
    assert.equal(withLocalCompletion(checked, true), checked);
    assert.equal(withLocalCompletion(checked, false), unchecked);
    const change = completionEdit(checked, false);
    assert.equal(change.end - change.start, 1);
    assert.equal(original.includes(marker), false);
});

test('Windows line endings, BOM, missing final newline and front matter survive marker insertion', () => {
    const windows = '\uFEFF# 标题\r\n\r\n题面\r\n';
    const result = withLocalCompletion(windows, false);
    assert.equal(result.replace(/\r\n/g, '').includes('\n'), false);
    assert.ok(result.startsWith('\uFEFF# 标题\r\n\r\n- [ ]'));
    assert.equal(withLocalCompletion('# 标题', false), '# 标题\n\n- [ ] 已通过 ' + marker + '\n\n');
    const front = '---\ntitle: Problem\n---\n正文';
    assert.ok(withLocalCompletion(front, false).startsWith('---\ntitle: Problem\n---\n- [ ]'));
    assert.ok(withLocalCompletion('---\ntitle: Problem\n---', false).startsWith('---\ntitle: Problem\n---\n\n- [ ]'));
    assert.match(withLocalCompletion('# 标题\n正文', false), /-->\n\n正文$/);
    const examples = '```md\n# 示例标题\n```\n\n# 实际题目\n\n题面';
    const exampleResult = withLocalCompletion(examples, false);
    assert.ok(exampleResult.includes('# 实际题目\n\n- [ ]'));
    assert.equal(findLocalCompletion(exampleResult).checked, false);
});

test('ordinary task lists and code examples do not mark a problem as passed; duplicates are rejected', () => {
    assert.equal(findLocalCompletion('- [x] 已通过'), undefined);
    assert.equal(findLocalCompletion('```md\n- [x] 已通过 ' + marker + '\n```'), undefined);
    assert.equal(findLocalCompletion('    - [x] 已通过 ' + marker), undefined);
    const real = '# 题目\n\n- [X] 已通过 ' + marker + '\n';
    assert.equal(findLocalCompletion(real).checked, true);
    assert.throws(() => findLocalCompletion(real + '- [ ] 已通过 ' + marker), /多个通过标记/);
});

test('only Chinese ordinal prefixes are converted; module names stay Chinese and redundant counts are removed', () => {
    assert.equal(arabicModuleName('一、数组（5题）'), '1、数组');
    assert.equal(arabicModuleName('十二、栈（5 题）'), '12、栈');
    assert.equal(arabicModuleName('一百零三、模块'), '103、模块');
    assert.equal(arabicModuleName('17、技巧（5 题）'), '17、技巧');
    assert.equal(arabicModuleName('二叉树'), '二叉树');
    assert.equal(arabicModuleName('华为 OD'), '华为 OD');
});
