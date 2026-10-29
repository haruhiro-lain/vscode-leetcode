// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import { ConfigurationChangeEvent, Disposable, languages, workspace } from "vscode";
import { customCodeLensProvider, CustomCodeLensProvider } from "./CustomCodeLensProvider";
import { studyPlanManager } from "../studyPlans/studyPlanManager";

class CodeLensController implements Disposable {
    private internalProvider: CustomCodeLensProvider;
    private registeredProvider: Disposable | undefined;
    private configurationChangeListener: Disposable;
    private studyPlanChangeListener: Disposable;

    constructor() {
        this.internalProvider = customCodeLensProvider;
        this.studyPlanChangeListener = studyPlanManager.onDidChange(() => this.internalProvider.refresh());

        this.configurationChangeListener = workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
            if (event.affectsConfiguration("leetcode.editor.shortcuts")) {
                this.internalProvider.refresh();
            }
        }, this);

        this.registeredProvider = languages.registerCodeLensProvider({ scheme: "file" }, this.internalProvider);
    }

    public dispose(): void {
        if (this.registeredProvider) {
            this.registeredProvider.dispose();
        }
        this.configurationChangeListener.dispose();
        this.studyPlanChangeListener.dispose();
    }
}

export const codeLensController: CodeLensController = new CodeLensController();
