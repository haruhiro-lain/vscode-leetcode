import * as cp from "child_process";
import * as path from "path";
import * as vscode from "vscode";
import { AxiosRequestConfig, AxiosResponse } from "axios";
import { createNetworkEnvironment } from "./networkUtils";

export function requestDirect<T>(url: string, settings: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    // VS Code's proxySupport=override patches HTTP even when Axios proxy=false.
    // Use the same standalone Node runtime as the CLI to keep routing local to
    // this extension instead of changing global proxy settings.
    const node = vscode.workspace.getConfiguration("leetcode").get<string>("nodePath", "node").replace(/^"(.*)"$/, "$1");
    const worker = path.join(__dirname, "..", "..", "..", "scripts", "direct-http.cjs");
    return new Promise((resolve, reject) => {
        const child = cp.execFile(node, [worker], {
            windowsHide: true, env: createNetworkEnvironment(), timeout: 20000, maxBuffer: 1024 * 1024,
        }, (error, stdout) => {
            if (error) {
                reject(Object.assign(new Error("中国站直连请求未完成，请检查网络及 Node.js 配置。"), { isAxiosError: true }));
                return;
            }
            try {
                const result = JSON.parse(stdout);
                if (result.error || result.status < 200 || result.status >= 300) {
                    reject(Object.assign(new Error("力扣请求未成功。"), { isAxiosError: true, response: { status: result.status } }));
                    return;
                }
                resolve(result as AxiosResponse<T>);
            } catch (_) {
                reject(Object.assign(new Error("力扣直连返回了无效响应。"), { isAxiosError: true }));
            }
        });
        child.stdin?.on("error", () => { /* execFile callback settles the request. */ });
        // Credentials are never command-line arguments or log output.
        child.stdin?.end(JSON.stringify({ url, method: settings.method, headers: settings.headers, data: settings.data }));
    });
}
