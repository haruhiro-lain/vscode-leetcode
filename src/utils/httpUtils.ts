import axios, { AxiosRequestConfig, AxiosPromise } from "axios";
import { omit } from "lodash";
import { globalState } from "../globalState";
import { DialogType, promptForOpenOutputChannel } from "./uiUtils";

const referer = "vscode-lc-extension";

export function LcAxios<T = any>(path: string, settings?: AxiosRequestConfig): AxiosPromise<T> {
    const cookie = globalState.getCookie();
    if (!cookie) {
        promptForOpenOutputChannel(
            `未能获取 Cookie，请重新登录。`,
            DialogType.error
        );
        return Promise.reject("未能获取 Cookie。");
    }
    return axios(path, {
        headers: {
            referer,
            "content-type": "application/json",
            cookie,
            ...(settings && settings.headers),
        },
        xsrfCookieName: "csrftoken",
        xsrfHeaderName: "X-CSRFToken",
        ...(settings && omit(settings, "headers")),
    });
}
