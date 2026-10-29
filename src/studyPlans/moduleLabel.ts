export function arabicModuleName(name: string): string {
    return name.replace(/^(?:第)?([零〇一二两三四五六七八九十百千]+)[、.．]\s*/, (_match, number: string) => {
        const digits: { [key: string]: number } = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
        const units: { [key: string]: number } = { 十: 10, 百: 100, 千: 1000 };
        let total = 0;
        let current = 0;
        for (const character of number) {
            if (units[character]) { total += (current || 1) * units[character]; current = 0; } else current = digits[character];
        }
        return `${total + current}、`;
    }).replace(/\s*[（(]\s*\d+\s*题\s*[）)]\s*$/, "").trim();
}
