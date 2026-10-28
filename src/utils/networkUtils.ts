import * as vscode from "vscode";
import { AxiosProxyConfig } from "axios";

export function useDirectChinaConnection(): boolean {
    return vscode.workspace.getConfiguration("leetcode").get<string>("cnConnectionMode", "direct") !== "proxy";
}

export function isChinaEndpoint(url: string): boolean {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "leetcode.cn";
}

function configuredProxy(): string | undefined {
    return vscode.workspace.getConfiguration("http").get<string>("proxy");
}

export function getRequestProxy(url: string): AxiosProxyConfig | false | undefined {
    if (isChinaEndpoint(url) && useDirectChinaConnection()) return false;
    const value = configuredProxy();
    if (!value) return undefined; // Axios honors the inherited proxy environment.
    const proxy = new URL(value);
    if (proxy.protocol !== "http:" && proxy.protocol !== "https:") return undefined;
    return {
        protocol: proxy.protocol.slice(0, -1),
        host: proxy.hostname,
        port: Number(proxy.port || (proxy.protocol === "https:" ? 443 : 80)),
        ...(proxy.username ? { auth: { username: decodeURIComponent(proxy.username), password: decodeURIComponent(proxy.password) } } : {}),
    };
}

export function createNetworkEnvironment(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
    const env = { ...source };
    const proxy = configuredProxy();
    if (proxy) {
        env.http_proxy = env.HTTP_PROXY = proxy;
        env.https_proxy = env.HTTPS_PROXY = proxy;
    }
    if (useDirectChinaConnection()) {
        // request (CLI) prefers NO_PROXY; Axios prefers no_proxy. Set both and
        // preserve existing exclusions. Other hosts still use their proxy.
        const exclusions = [env.NO_PROXY, env.no_proxy, "leetcode.cn", ".leetcode.cn"].filter(Boolean).join(",");
        env.NO_PROXY = env.no_proxy = exclusions;
    }
    return env;
}
