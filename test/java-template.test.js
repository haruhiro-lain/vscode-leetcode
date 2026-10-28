const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { formatJavaExercise, isUnansweredJavaExercise, javaIdentifier } = require('../out/src/utils/javaTemplateUtils');
const { analyzeJavaSource, findJavaSolutions, buildJavaSubmission } = require('../out/src/utils/javaSolutionUtils');
const { ensureExerciseFile } = require('../out/src/utils/exerciseFileUtils');

const template = `/*
 * @lc app=leetcode.cn id=1 lang=java
 * [1] 两数之和
 */
// @lc code=start
class Solution {
    public int[] twoSum(int[] nums, int target) {
    }
}
// @lc code=end
`;
const filePath = 'D:/Code/repo/algo/code/src/main/java/com/haruhiro_lain/LeetCode/array/1.two-sum.java';

test('fresh Java template matches the workspace package, outer class, empty main and inner Solution', () => {
    const output = formatJavaExercise(template, filePath, '1');
    assert.match(output, /^package com\.haruhiro_lain\.LeetCode\.array;/);
    assert.match(output, /import java\.util\.\*;/);
    assert.match(output, /class LeetCode1 \{\n    public static void main\(String\[\] args\) \{\n    }/);
    assert.match(output, /    \/\/ @lc code=start\n    class Solution/);
    assert.doesNotMatch(output, /TODO|UnsupportedOperationException/);
    assert.match(output, /public int\[\] twoSum\(int\[\] nums, int target\) \{\n        \}/);
    assert.equal(formatJavaExercise(output, filePath, '1'), output);
    const submitted = buildJavaSubmission(output, findJavaSolutions(output)[0]);
    assert.doesNotMatch(submitted, /class LeetCode1|void main|package /);
    assert.equal(isUnansweredJavaExercise(output), true);
});

test('the default Solution contents match the original LeetCode snippet after nesting', () => {
    const official = `class Solution {
    public int[][] merge(int[][] intervals) {

    }
}`;
    const input = `// @lc app=leetcode.cn id=56 lang=java\n// @lc code=start\n${official}\n// @lc code=end\n`;
    const output = formatJavaExercise(input, filePath, '56');
    const submitted = buildJavaSubmission(output, findJavaSolutions(output)[0]);
    const body = submitted.slice(submitted.indexOf('class Solution'), submitted.lastIndexOf('// @lc code=end')).trimEnd();
    const normalize = text => text.split('\n').map(line => line.trim()).join('\n');
    assert.equal(normalize(body), normalize(official));
    assert.doesNotMatch(output, /TODO|UnsupportedOperationException/);
});

test('existing unanswered wrappers only gain an empty main, keeping metadata, methods and local nodes', () => {
    const old = `package local.practice;
// @lc app=leetcode.cn id=2 lang=java
class LeetCode2 {
    // @lc code=start
    class Solution { ListNode f(ListNode n) { throw new UnsupportedOperationException("TODO"); } }
    // @lc code=end
    static class ListNode { int val; ListNode next; }
}
`;
    const output = formatJavaExercise(old, '2.java', '2');
    assert.equal(output.replace('    public static void main(String[] args) {\n    }\n\n', ''), old);
    assert.equal(formatJavaExercise(output, '2.java', '2'), output);
    assert.match(output, /static class ListNode/);
});

test('fresh template keeps implemented code and existing main test contents intact', () => {
    const solved = template.replace('public int[] twoSum(int[] nums, int target) {\n    }', 'public int[] twoSum(int[] nums, int target) { return new int[] {0, 1}; }');
    const formatted = formatJavaExercise(solved, filePath, '1');
    assert.match(formatted, /return new int\[\] \{0, 1};/);
    assert.equal(isUnansweredJavaExercise(formatted), false);
    const withTests = formatted.replace('public static void main(String[] args) {\n    }', 'public static void main(String[] args) { System.out.println("keep"); }');
    assert.equal(formatJavaExercise(withTests, filePath, '1'), withTests);
});

test('nodes from LeetCode comments become local stubs outside the submitted region', () => {
    const input = template.replace('id=1', 'id=2').replace('class Solution', `/**
 * Definition for singly-linked list.
 * public class ListNode {
 *     int val;
 *     ListNode next;
 *     ListNode(int x) { val = x; }
 * }
 */
class Solution`).replace('int[] twoSum(int[] nums, int target)', 'ListNode addTwoNumbers(ListNode first, ListNode second)');
    const output = formatJavaExercise(input, filePath, '2');
    const { types } = analyzeJavaSource(output);
    const node = types.find(t => t.name === 'ListNode');
    assert.ok(node.start > output.indexOf('@lc code=end'));
    assert.match(output, /static class ListNode/);
    assert.match(output, /ListNode\(int x\) \{ val = x; }/);
    assert.doesNotMatch(buildJavaSubmission(output, findJavaSolutions(output)[0]), /static class ListNode/);
});

test('ListNode and TreeNode have fallbacks when the code snippet omits definitions', () => {
    for (const name of ['ListNode', 'TreeNode']) {
        const input = template.replace('int[] twoSum(int[] nums, int target)', `${name} solve(${name} node)`);
        const output = formatJavaExercise(input, filePath, '1');
        assert.match(output, new RegExp('static class ' + name));
        assert.ok(output.indexOf('static class ' + name) > output.indexOf('@lc code=end'));
    }
});

test('a non-public Node definition in comments supplies the graph node locally', () => {
    const input = template.replace('id=1', 'id=133').replace('class Solution', `/**
 * Definition for a Node.
 * class Node {
 *     public int val;
 *     public List<Node> neighbors;
 *     public Node() { neighbors = new ArrayList<Node>(); }
 * }
 */
class Solution`).replace('int[] twoSum(int[] nums, int target)', 'Node cloneGraph(Node node)');
    const output = formatJavaExercise(input, filePath, '133');
    assert.match(output, /static class Node/);
    assert.match(output, /public List<Node> neighbors/);
    assert.ok(output.indexOf('static class Node') > output.indexOf('@lc code=end'));
});

test('design problems get a Solution container and keep their judge class name', () => {
    const input = template.replace('id=1', 'id=146').replace(/class Solution[\s\S]*\/\/ @lc code=end/, `class LRUCache {
    public LRUCache(int capacity) {}
    public int get(int key) {}
    public void put(int key, int value) {}
}
// @lc code=end`);
    const output = formatJavaExercise(input, filePath, '146');
    assert.match(output, /class LeetCode146/);
    assert.match(output, /    class Solution \{\n        class LRUCache/);
    assert.equal(isUnansweredJavaExercise(output), true);
    const code = buildJavaSubmission(output, findJavaSolutions(output)[0]);
    assert.match(code, /class LRUCache/);
    assert.doesNotMatch(code, /class Solution|main\(/);
    assert.equal(formatJavaExercise(output, filePath, '146'), output);
});

test('an existing design skeleton gains both empty main and a Solution container', () => {
    const input = `// @lc app=leetcode.cn id=146 lang=java
class LeetCode146 {
    // @lc code=start
    class LRUCache { int get(int key) { throw new UnsupportedOperationException("TODO"); } }
    // @lc code=end
}`;
    const output = formatJavaExercise(input, filePath, '146');
    assert.match(output, /void main\(String\[\] args\) \{\n    }/);
    assert.equal(findJavaSolutions(output).length, 1);
    assert.match(buildJavaSubmission(output, findJavaSolutions(output)[0]), /class LRUCache/);
    assert.equal(formatJavaExercise(output, filePath, '146'), output);
});

test('partial or completed implementations are not mistaken for TODO-only skeletons', () => {
    const partial = template.replace('    public int[] twoSum', '    int done() { return 1; }\n    public int[] twoSum');
    assert.equal(isUnansweredJavaExercise(partial), false);
    assert.equal(isUnansweredJavaExercise(template.replace('    }', '        // TODO later\n        return null;\n    }')), false);
    assert.equal(isUnansweredJavaExercise(template), true);
    assert.equal(isUnansweredJavaExercise('class Solution { int f() {} }'), false);
});

test('package paths follow Windows or POSIX source roots and Java tags form valid identifiers', () => {
    assert.equal(javaIdentifier('binary-search'), 'binary_search');
    assert.equal(javaIdentifier('2-pointers'), '_2_pointers');
    assert.equal(javaIdentifier('class'), '_class');
    assert.equal(javaIdentifier('数组'), '数组');
    assert.match(formatJavaExercise(template, filePath.replace(/\//g, '\\'), '1'), /^package com\.haruhiro_lain/);
    assert.doesNotMatch(formatJavaExercise(template, '/home/user/.leetcode/1.java', '1'), /^package /);
    assert.throws(() => formatJavaExercise(template, filePath.replace('/array/', '/binary-search/'), '1'), /Java 包目录/);
    const crlf = formatJavaExercise(template.replace(/\n/g, '\r\n'), filePath, '1');
    assert.doesNotMatch(crlf.replace(/\r\n/g, ''), /\n/);
});

test('file generation leaves existing work untouched and never leaves a file on download failure', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'leetcode-create-test-'));
    try {
        const file = path.join(root, 'new', '1.java');
        await assert.rejects(ensureExerciseFile(file, 'java', '1', async () => { throw Error('download failed'); }), /download failed/);
        await assert.rejects(fs.stat(file), { code: 'ENOENT' });
        await ensureExerciseFile(file, 'java', '1', async () => template);
        const content = await fs.readFile(file, 'utf8');
        assert.match(content, /class LeetCode1/);
        await ensureExerciseFile(file, 'java', '1', async () => { throw Error('must not fetch'); });
        assert.equal(await fs.readFile(file, 'utf8'), content);
        const python = path.join(root, '1.py');
        await ensureExerciseFile(python, 'python3', '1', async () => 'class Solution:\n    pass\n');
        assert.equal(await fs.readFile(python, 'utf8'), 'class Solution:\n    pass\n');
        const concurrent = path.join(root, 'concurrent.java');
        await ensureExerciseFile(concurrent, 'java', '1', async () => {
            await fs.writeFile(concurrent, 'user draft');
            return template;
        });
        assert.equal(await fs.readFile(concurrent, 'utf8'), 'user draft');
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});
