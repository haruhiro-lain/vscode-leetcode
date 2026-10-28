export class LeetCodeCommandError extends Error {
    public sessionRevision?: number;
    public readonly result: string | undefined;
    public readonly isAuthenticationError: boolean;

    constructor(message: string, public readonly exitCode: number | null, stdout: string,
                public readonly stderr: string, authenticationExpired: boolean) {
        super(message);
        this.name = "LeetCodeCommandError";
        this.result = stdout || undefined;
        this.isAuthenticationError = authenticationExpired;
    }
}

export function isAuthenticationError(error: any): boolean {
    return error?.isAuthenticationError === true;
}

export function commandResultError(code: number | null, stdout: string, stderr: string): LeetCodeCommandError | undefined {
    // CLI logging can report an error and still exit with zero. Only recognize
    // actual logger lines, not the word ERROR inside a problem or source code.
    const output: string = (stdout + "\n" + stderr).replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
    const errors: string[] = output.match(/^[ \t]*\[ERROR\][^\r\n]*/gim) || [];
    if (code === 0 && errors.length === 0) return undefined;
    const authenticationExpired: boolean = errors.some((line) =>
        /session expired|please (?:re-?)?login|not logged in|login (?:required|first)|authentication (?:required|failed)/i.test(line));
    let message: string;
    if (authenticationExpired) {
        message = "力扣命令报告登录校验失败，需要核实会话状态。";
    } else if (errors.length > 0) {
        message = "力扣命令失败：" + errors.map((line) => line.replace(/^[ \t]*\[ERROR\][ \t]*/i, "")).join("\n");
    } else {
        message = code === null ? "命令进程已被终止，请打开输出面板查看详情。" : `命令执行失败（退出码 ${code}），请打开输出面板查看详情。`;
    }
    return new LeetCodeCommandError(message, code, stdout, stderr, authenticationExpired);
}
