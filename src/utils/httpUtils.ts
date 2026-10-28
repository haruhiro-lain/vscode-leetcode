import axios, { AxiosRequestConfig, AxiosPromise } from "axios";
import { omit } from "lodash";
import { globalState } from "../globalState";
import { getRequestProxy } from "./networkUtils";
import { requestDirect } from "./directHttpUtils";

export function LcAxios<T = any>(path: string, settings?: AxiosRequestConfig, candidateCookie?: string): AxiosPromise<T> {
    const cookie = candidateCookie ?? globalState.getCookie();
    if (!cookie) {
        return Promise.reject(new Error("未能获取 Cookie，请重新登录。"));
    }
    const origin = new URL(path).origin;
    const csrf = /(?:^|;\s*)csrftoken=([^;]+)/.exec(cookie)?.[1];
    const options: AxiosRequestConfig = {
        timeout: 15000,
        headers: {
            "referer": origin + "/",
            "origin": origin,
            "content-type": "application/json",
            "cookie": cookie,
            ...(csrf ? { "X-CSRFToken": csrf } : {}),
            ...(settings && settings.headers),
        },
        xsrfCookieName: "csrftoken",
        xsrfHeaderName: "X-CSRFToken",
        ...(settings && omit(settings, "headers")),
        proxy: getRequestProxy(path),
    };
    return options.proxy === false ? requestDirect<T>(path, options) : axios(path, options);
}
