const assert = require('node:assert/strict');
const { test } = require('node:test');
const { localHydroSubmissionUrl } = require('../out/src/webview/localHydroSubmission');

test('Hydro submission preserves the exact problem ID and leading zeroes from matching metadata', () => {
    const content = '# 本地题\n\n- 题目编号：[P00001](https://hydro.ac/d/hwod_oj/p/P00001)\n- 在线练习：[P00001](https://hydro.ac/d/hwod_oj/p/P00001)';
    assert.equal(localHydroSubmissionUrl(content, '/od/problems/P00001-对称美学.md'), 'https://hydro.ac/d/hwod_oj/p/P00001/submit');
    assert.equal(localHydroSubmissionUrl('- 在线练习：[P000010](https://hydro.ac/d/hwod_oj/p/P000010/submit)', '/od/P000010-test.md'), 'https://hydro.ac/d/hwod_oj/p/P000010/submit');
});

test('only matching HydroOJ metadata exposes submission; code examples, indexes and conflicting IDs do not', () => {
    const link = '- 题目编号：[P00001](https://hydro.ac/d/hwod_oj/p/P00001)';
    assert.equal(localHydroSubmissionUrl(link, '/od/problems/P00002-other.md'), undefined);
    assert.equal(localHydroSubmissionUrl(link, '/od/problems/README.md'), undefined);
    assert.equal(localHydroSubmissionUrl('```md\n' + link + '\n```', '/od/P00001-one.md'), undefined);
    assert.equal(localHydroSubmissionUrl('[示例链接](https://hydro.ac/d/hwod_oj/p/P00001)', '/od/P00001-one.md'), undefined);
    assert.equal(localHydroSubmissionUrl(link + '\n- 在线练习：[P00002](https://hydro.ac/d/hwod_oj/p/P00002)', '/od/P00001-one.md'), undefined);
});

test('submission rejects credentials, other domains, protocols and routes', () => {
    for (const url of ['http://hydro.ac/d/hwod_oj/p/P00001', 'https://hydro.ac.evil.test/d/hwod_oj/p/P00001',
        'https://user:secret@hydro.ac/d/hwod_oj/p/P00001', 'https://hydro.ac:444/d/hwod_oj/p/P00001',
        'https://hydro.ac/d/other/p/P00001', 'https://hydro.ac/d/hwod_oj/p/P00001/files', 'command:evil']) {
        assert.equal(localHydroSubmissionUrl(`- 题目编号：[题目](${url})`, '/od/P00001-one.md'), undefined, url);
    }
});
