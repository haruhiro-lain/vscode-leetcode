
// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import { customCodeLensProvider } from "../codelens/CustomCodeLensProvider";
import { LeetCodeNode } from "../explorer/LeetCodeNode";
import { leetCodeTreeDataProvider } from "../explorer/LeetCodeTreeDataProvider";
import { leetCodeExecutor } from "../leetCodeExecutor";
import { hasStarShortcut } from "../utils/settingUtils";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";

export async function addFavorite(node: LeetCodeNode): Promise<void> {
    try {
        await leetCodeExecutor.toggleFavorite(node, true);
        await leetCodeTreeDataProvider.refresh();
        if (hasStarShortcut()) {
            customCodeLensProvider.refresh();
        }
    } catch (error) {
        await promptForOpenOutputChannel("收藏题目失败，请打开输出面板查看详情。", DialogType.error);
    }
}

export async function removeFavorite(node: LeetCodeNode): Promise<void> {
    try {
        await leetCodeExecutor.toggleFavorite(node, false);
        await leetCodeTreeDataProvider.refresh();
        if (hasStarShortcut()) {
            customCodeLensProvider.refresh();
        }
    } catch (error) {
        await promptForOpenOutputChannel("取消收藏失败，请打开输出面板查看详情。", DialogType.error);
    }
}
