// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import { leetCodeExecutor } from "../leetCodeExecutor";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";

export async function deleteCache(): Promise<void> {
    try {
        await leetCodeExecutor.deleteCache();
    } catch (error) {
        await promptForOpenOutputChannel("清理缓存失败，请打开输出面板查看详情。", DialogType.error);
    }
}
