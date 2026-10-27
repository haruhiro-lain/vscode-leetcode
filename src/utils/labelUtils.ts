// Licensed under the MIT license.

const labels: { [key: string]: string } = {
    "All": "全部题目", "Difficulty": "难度", "Tag": "标签", "Company": "公司", "Favorite": "收藏",
    "Easy": "简单", "Medium": "中等", "Hard": "困难", "Unknown": "未知",
    "Algorithms": "算法", "Database": "数据库", "None": "默认顺序",
    "Acceptance Rate (Ascending)": "通过率升序",
    "Acceptance Rate (Descending)": "通过率降序",
    "Frequency (Ascending)": "频率升序", "Frequency (Descending)": "频率降序",
    "Array": "数组", "String": "字符串", "Hash Table": "哈希表", "Math": "数学",
    "Dynamic Programming": "动态规划", "Sorting": "排序", "Greedy": "贪心",
    "Depth First Search": "深度优先搜索", "Breadth First Search": "广度优先搜索",
    "Binary Search": "二分查找", "Tree": "树", "Binary Tree": "二叉树",
    "Matrix": "矩阵", "Two Pointers": "双指针", "Linked List": "链表",
    "Stack": "栈", "Queue": "队列", "Heap": "堆", "Graph": "图论", "Backtracking": "回溯",
    "Sliding Window": "滑动窗口", "Bit Manipulation": "位运算", "Trie": "前缀树",
    "Union Find": "并查集", "Prefix Sum": "前缀和", "Design": "设计",
    "Recursion": "递归", "Simulation": "模拟", "Monotonic Stack": "单调栈",
    "Binary Search Tree": "二叉搜索树", "Counting": "计数", "DivideAndConquer": "分治",
    "Divide And Conquer": "分治", "Topological Sort": "拓扑排序",
    "Segment Tree": "线段树", "Binary Indexed Tree": "树状数组",
    "Bitmask": "状态压缩", "Geometry": "几何", "Enumeration": "枚举",
};

/** Translate display labels only; CLI values, identifiers and sorting keys stay unchanged. */
export function localizeLabel(value: string): string {
    return Object.prototype.hasOwnProperty.call(labels, value) ? labels[value] : value;
}

const statuses: { [key: string]: string } = {
    "Accepted": "通过",
    "Wrong Answer": "答案错误",
    "Time Limit Exceeded": "超出时间限制",
    "Memory Limit Exceeded": "超出内存限制",
    "Output Limit Exceeded": "超出输出限制",
    "Runtime Error": "运行错误",
    "Compile Error": "编译错误",
    "Compilation Error": "编译错误",
    "Internal Error": "判题服务内部错误",
    "Unknown Error": "未知错误",
    "Unknown": "未知状态",
    "Finished": "测试运行完成",
    "Pending": "等待判题",
    "Judging": "正在判题",
};

const headings: { [key: string]: string } = {
    "Error": "错误信息",
    "Testcase": "测试用例",
    "Your Input": "测试输入",
    "Input": "输入",
    "Answer": "实际答案",
    "Your Answer": "实际答案",
    "Output": "实际输出",
    "Expected Answer": "预期答案",
    "Expected": "预期答案",
    "Stdout": "标准输出",
    "Runtime": "运行时间",
    "Memory": "内存使用",
};

export function translateMessage(message: string = ""): string {
    if (Object.prototype.hasOwnProperty.call(statuses, message)) {
        return statuses[message];
    }
    return message
        .replace(/^(\d+)\/(\d+) cases passed \(([^]*)\)$/, "通过用例：$1/$2，运行时间：$3")
        .replace(/^Your runtime beats ([\d.]+) % of (.+) submissions$/, "运行速度超过 $1% 的 $2 提交")
        .replace(/^Your memory usage beats ([\d.]+) % of (.+) submissions \((.+)\)$/, "内存表现超过 $1% 的 $2 提交（$3）");
}

export function translateHeading(heading: string): string {
    const match: RegExpMatchArray | null = heading.match(/^(.+?)( \([^]*\))?$/);
    if (!match) {
        return heading;
    }
    const label: string = Object.prototype.hasOwnProperty.call(headings, match[1]) ? headings[match[1]] : match[1];
    return label + (match[2] || "");
}
