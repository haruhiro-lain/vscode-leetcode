const assert = require('node:assert/strict');
const test = require('node:test');
const { findLocalProblemId, formatLocalProblemLabel } = require('../out/src/studyPlans/localProblemId');

test('local problem numbers use heading, explicit metadata then filename without guessing CSDN indices', () => {
    assert.equal(findLocalProblemId('# [P00513] 计算数列位置N的值', 'P99999-other.md'), 'P00513');
    assert.equal(findLocalProblemId('# 标题\n- 题目编号：[P00511](https://hydro.ac/d/hwod_oj/p/P00511)', '题目.md'), 'P00511');
    assert.equal(findLocalProblemId('# 标题', 'P00512-勇攀数字高峰.md'), 'P00512');
    assert.equal(findLocalProblemId('# 标题', 'p00513.计算数列.md'), 'P00513');
    assert.equal(findLocalProblemId('# 标题', '49.字母异位词分组.md'), '49');
    assert.equal(findLocalProblemId('# 普通题\n- CSDN 原文序号：[7](https://renjie.blog.csdn.net/article/details/123456789)', '普通题.md'), undefined);
});

test('code examples and unrelated file numbers are not mistaken for problem IDs', () => {
    assert.equal(findLocalProblemId('```md\n# [P99999] 示例\n题目编号：[P88888]\n```\n# 真正题目\n- 题目编号：[P00513](x)', '普通题.md'), 'P00513');
    assert.equal(findLocalProblemId('# 普通题', 'chapter12.md'), undefined);
});

test('display labels preserve the original ID and do not duplicate a prefix', () => {
    assert.equal(formatLocalProblemLabel('计算数列位置N的值', 'P00513'), '[P00513] 计算数列位置N的值');
    assert.equal(formatLocalProblemLabel('[P00513] 计算数列位置N的值', 'P00513'), '[P00513] 计算数列位置N的值');
    assert.equal(formatLocalProblemLabel('[p00513] 标题', 'P00513'), '[P00513] 标题');
    assert.equal(formatLocalProblemLabel('没有编号的本地题'), '没有编号的本地题');
});
