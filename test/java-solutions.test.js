const assert = require('node:assert/strict');
const test = require('node:test');
const { findJavaSolutions, buildJavaSubmission } = require('../out/src/utils/javaSolutionUtils');
const cliFile = require('vsc-leetcode-cli/lib/file');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const header = '// @lc app=leetcode.cn id=541 lang=java\n';
const source = header + `
package local.practice;
import java.util.*;
class Exercise {
    public static void main(String[] args) { System.out.println("local test"); }
    // class Solution99 { fake }
    class Solution1 {
        Solution1() {}
        public String solve() {
            String text = "Solution1 } class Solution88 {";
            char brace = '}';
            return new Helper().value() + text + brace;
        }
    }
    // @lc code=start
    class Solution { public String solve() { return "default"; } }
    // @lc code=end
    public static class Solution2_1 {
        public String solve() { return "selected"; }
    }
    static class Helper { String value() { return new Other().value(); } }
    static class Other { String value() { return "shared"; } }
    static class ListNode { int val; }
}
`;

test('find every implementation, including variants outside the lc markers', () => {
    assert.deepEqual(findJavaSolutions(source).map(s => s.name), ['Solution1', 'Solution', 'Solution2_1']);
    for (const target of findJavaSolutions(source)) assert.equal(source.slice(target.start, target.start + 5), 'class');
});

test('ignore commented, quoted and local declarations but discover nested implementations', () => {
    const java = header + `class Outer {
        String s = "class SolutionFake { }";
        String block = """class SolutionTextBlock { } }""";
        /* class SolutionComment {} */
        void f() { class SolutionLocal {} }
        class Solution1 { class SolutionNested {} }
        class Solution2 { int f() { return 2; } }
    }`;
    assert.deepEqual(findJavaSolutions(java).map(s => s.name), ['Solution1', 'SolutionNested', 'Solution2']);
});

test('a nested implementation can be submitted separately and is excluded from its outer solution', () => {
    const java = header + `class LeetCode704 {
        class Solution {
            public int search(int[] nums, int target) { return 1; }
            // Another implementation can be nested at any class depth.
            @Deprecated
            public static class Solution2 {
                Solution2() {}
                public int search(int[] nums, int target) { return 2; }
                class Solution3 { public int search(int[] nums, int target) { return 3; } }
            }
        }
    }`;
    const targets = findJavaSolutions(java);
    assert.deepEqual(targets.map(s => s.name), ['Solution', 'Solution2', 'Solution3']);
    for (const [i, target] of targets.entries()) {
        const code = buildJavaSubmission(java, target);
        assert.deepEqual(findJavaSolutions(code).map(s => s.name), ['Solution']);
        assert.match(code, new RegExp('return ' + (i + 1) + ';'));
        for (const other of [1, 2, 3].filter(n => n !== i + 1)) assert.doesNotMatch(code, new RegExp('return ' + other + ';'));
        assert.doesNotMatch(code, /@Deprecated|public static class|class LeetCode704/);
        if (i === 1) assert.match(code, /Solution\(\)/);
    }
});

test('extract the selected body and rename its constructor without altering literals or source', () => {
    const original = source;
    const code = buildJavaSubmission(source, findJavaSolutions(source)[0]);
    assert.match(code, /class Solution\s*\{\s*Solution\(\)/);
    assert.match(code, /String text = "Solution1 } class Solution88 \{"/);
    assert.match(code, /import java.util.\*;/);
    assert.match(code, /class Helper/);
    assert.match(code, /class Other/);
    assert.doesNotMatch(code, /package local|class Exercise|static void main|class Solution2_1|class ListNode/);
    assert.equal(source, original);
});

test('select each sibling separately and remove top-level static/public modifiers', () => {
    for (const target of findJavaSolutions(source)) {
        const code = buildJavaSubmission(source, target);
        assert.deepEqual(findJavaSolutions(code).map(s => s.name), ['Solution']);
        assert.doesNotMatch(code, /public static class/);
        if (target.name === 'Solution2_1') {
            assert.match(code, /return "selected"/);
            assert.doesNotMatch(code, /return "default"|class Helper/);
        }
    }
});

test('preserve nested helpers but omit local judge node stubs', () => {
    const java = header + `class Outer {
        class Solution2 {
            class Pair { int value; }
            ListNode reverse(ListNode node) { Pair p = new Pair(); return node; }
        }
        static class ListNode { int val; }
    }`;
    const code = buildJavaSubmission(java, findJavaSolutions(java)[0]);
    assert.match(code, /class Pair/);
    assert.match(code, /ListNode reverse/);
    assert.doesNotMatch(code, /class ListNode/);
});

test('reject stale targets and missing problem metadata before submitting', () => {
    assert.throws(() => buildJavaSubmission(source, { name: 'Solution1', start: 0 }), /所选解法已变化/);
    assert.throws(() => buildJavaSubmission('class Solution {}', { name: 'Solution', start: 0 }), /题目标记/);
});

test('unwrap a design problem container and keep the judge class and constructor names', () => {
    const java = header.replace('id=541', 'id=225') + `class Outer {
        class Solution1 { class MyStack { MyStack() {} public void push(int x) {} } }
        class Solution2 { public class MyStack { MyStack() {} public int pop() { return 2; } } }
    }`;
    for (const target of findJavaSolutions(java)) {
        const code = buildJavaSubmission(java, target);
        assert.match(code, /class MyStack \{ MyStack\(\)/);
        assert.doesNotMatch(code, /class Solution|class Outer/);
    }
});

test('CLI sees the correct problem and only the selected normalized solution', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leetcode-extraction-test-'));
    try {
        const file = path.join(dir, '541.test.java');
        fs.writeFileSync(file, buildJavaSubmission(source, findJavaSolutions(source)[2]));
        assert.deepEqual(cliFile.meta(file), { app: 'leetcode.cn', id: '541', lang: 'java' });
        const code = cliFile.codeData(file);
        assert.match(code, /class Solution \{/);
        assert.match(code, /return "selected"/);
        assert.doesNotMatch(code, /@lc|Solution2_1|class Exercise/);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
