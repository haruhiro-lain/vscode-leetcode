// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import * as hljs from "highlight.js";
import * as MarkdownIt from "markdown-it";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { leetCodeChannel } from "../leetCodeChannel";
import { isWindows } from "../utils/osUtils";
import { completionInline } from "../studyPlans/localCompletion";

class MarkdownEngine implements vscode.Disposable {

    private engine: MarkdownIt;
    private config: MarkdownConfiguration;
    private listener: vscode.Disposable;

    public constructor() {
        this.reload();
        this.listener = vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
            if (event.affectsConfiguration("markdown")) {
                this.reload();
            }
        }, this);
    }

    public get localResourceRoots(): vscode.Uri[] {
        return [vscode.Uri.file(path.join(this.config.extRoot, "media"))];
    }

    public dispose(): void {
        this.listener.dispose();
    }

    public reload(): void {
        this.engine = this.initEngine();
        this.config = new MarkdownConfiguration();
    }

    public render(md: string, env?: any): string {
        return this.engine.render(md, env);
    }

    public getStyles(resourceUri?: (uri: vscode.Uri) => vscode.Uri): string {
        return [
            this.getBuiltinStyles(resourceUri),
            this.getSettingsStyles(),
        ].join(os.EOL);
    }

    private getBuiltinStyles(resourceUri?: (uri: vscode.Uri) => vscode.Uri): string {
        let styles: vscode.Uri[] = [];
        try {
            const stylePaths: string[] = require(path.join(this.config.extRoot, "package.json"))["contributes"]["markdown.previewStyles"];
            styles = stylePaths.map((p: string) => {
                const uri = vscode.Uri.file(path.join(this.config.extRoot, p));
                return resourceUri ? resourceUri(uri) : uri.with({ scheme: "vscode-resource" });
            });
        } catch (error) {
            leetCodeChannel.appendLine("[Error] Fail to load built-in markdown style file.");
        }
        return styles.map((style: vscode.Uri) => `<link rel="stylesheet" type="text/css" href="${style.toString()}">`).join(os.EOL);
    }

    private getSettingsStyles(): string {
        return [
            `<style>`,
            `body {`,
            `    ${this.config.fontFamily ? `font-family: ${this.config.fontFamily};` : ``}`,
            `    ${isNaN(this.config.fontSize) ? `` : `font-size: ${this.config.fontSize}px;`}`,
            `    ${isNaN(this.config.lineHeight) ? `` : `line-height: ${this.config.lineHeight};`}`,
            `}`,
            `</style>`,
        ].join(os.EOL);
    }

    private initEngine(): MarkdownIt {
        const md: MarkdownIt = new MarkdownIt({
            linkify: true,
            typographer: true,
            highlight: (code: string, lang?: string): string => {
                switch (lang && lang.toLowerCase()) {
                    case "mysql":
                        lang = "sql"; break;
                    case "json5":
                        lang = "json"; break;
                    case "python3":
                        lang = "python"; break;
                }
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(lang, code, true).value;
                    } catch (error) { /* do not highlight */ }
                }
                return ""; // use external default escaping
            },
        });

        this.addCodeBlockHighlight(md);
        this.addImageUrlCompletion(md);
        this.addLinkValidator(md);
        this.addLocalLinkCompletion(md);
        md.core.ruler.after("inline", "leetcode_local_completion", (state: any) => {
            if (!state.env.localCompletionHtml) return;
            for (const token of state.tokens) {
                if (token.type === "inline" && token.map && token.map[0] === state.env.localCompletionLine && completionInline.test(token.content)) {
                    const checkbox = new state.Token("html_inline", "", 0);
                    checkbox.content = state.env.localCompletionHtml;
                    token.children = [checkbox];
                }
            }
        });
        return md;
    }

    private addCodeBlockHighlight(md: MarkdownIt): void {
        const codeBlock: MarkdownIt.TokenRender = md.renderer.rules["code_block"];
        // tslint:disable-next-line:typedef
        md.renderer.rules["code_block"] = (tokens, idx, options, env, self) => {
            // if any token uses lang-specified code fence, then do not highlight code block
            if (tokens.some((token: any) => token.type === "fence")) {
                return codeBlock(tokens, idx, options, env, self);
            }
            // otherwise, highlight with default lang in env object.
            const highlighted: string = options.highlight(tokens[idx].content, env.lang);
            return [
                `<pre><code ${self.renderAttrs(tokens[idx])} >`,
                highlighted || md.utils.escapeHtml(tokens[idx].content),
                "</code></pre>",
            ].join(os.EOL);
        };
    }

    private addImageUrlCompletion(md: MarkdownIt): void {
        const image: MarkdownIt.TokenRender = md.renderer.rules["image"];
        // tslint:disable-next-line:typedef
        md.renderer.rules["image"] = (tokens, idx, options, env, self) => {
            const imageSrc: string[] | undefined = tokens[idx].attrs.find((value: string[]) => value[0] === "src");
            if (env.resolveImage && imageSrc) imageSrc[1] = env.resolveImage(imageSrc[1]);
            if (env.host && imageSrc && imageSrc[1].startsWith("/")) {
                imageSrc[1] = `${env.host}${imageSrc[1]}`;
            }
            return image(tokens, idx, options, env, self);
        };
    }

    private addLinkValidator(md: MarkdownIt): void {
        const validateLink: (link: string) => boolean = md.validateLink;
        md.validateLink = (link: string): boolean => {
            // support file:// protocal link
            return validateLink(link) || link.startsWith("file:");
        };
    }

    private addLocalLinkCompletion(md: MarkdownIt): void {
        const link = md.renderer.rules["link_open"];
        md.renderer.rules["link_open"] = (tokens, idx, options, env, self) => {
            if (env.resolveLink) tokens[idx].attrSet("href", env.resolveLink(tokens[idx].attrGet("href") || ""));
            return link ? link(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
        };
        const heading = md.renderer.rules["heading_open"];
        md.renderer.rules["heading_open"] = (tokens, idx, options, env, self) => {
            if (env.localMarkdown) {
                const title = tokens[idx + 1].content;
                const slug = title.trim().toLowerCase().replace(/\s+/g, "-").replace(/[!"#$%&'()*+,./:;<=>?@[\]\\^`{|}~]/g, "");
                const ids: Set<string> = env.headingIds || (env.headingIds = new Set<string>());
                let id = slug;
                for (let suffix = 1; ids.has(id); suffix++) id = slug + "-" + suffix;
                ids.add(id);
                tokens[idx].attrSet("id", id);
            }
            return heading ? heading(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
        };
    }
}

// tslint:disable-next-line: max-classes-per-file
class MarkdownConfiguration {

    public readonly extRoot: string; // root path of vscode built-in markdown extension
    public readonly lineHeight: number;
    public readonly fontSize: number;
    public readonly fontFamily: string;

    public constructor() {
        const markdownConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("markdown", null);
        this.extRoot = path.join(vscode.env.appRoot, "extensions", "markdown-language-features");
        this.lineHeight = Math.max(0.6, +markdownConfig.get<number>("preview.lineHeight", NaN));
        this.fontSize = Math.max(8, +markdownConfig.get<number>("preview.fontSize", NaN));
        this.fontFamily = this.resolveFontFamily(markdownConfig);
    }

    private resolveFontFamily(config: vscode.WorkspaceConfiguration): string {
        let fontFamily: string = config.get<string>("preview.fontFamily", "");
        if (isWindows() && fontFamily === config.inspect<string>("preview.fontFamily")!.defaultValue) {
            fontFamily = `${fontFamily}, 'Microsoft Yahei UI'`;
        }
        return fontFamily;
    }
}

export const markdownEngine: MarkdownEngine = new MarkdownEngine();
