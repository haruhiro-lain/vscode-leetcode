import * as fse from "fs-extra";
import * as path from "path";
import { formatJavaExercise } from "./javaTemplateUtils";

export async function ensureExerciseFile(filePath: string, language: string, id: string, fetchTemplate: () => Promise<string>): Promise<void> {
    if (await fse.pathExists(filePath)) return;
    const template: string = await fetchTemplate();
    const content: string = language === "java" ? formatJavaExercise(template, filePath, id) : template;
    await fse.ensureDir(path.dirname(filePath));
    try {
        await fse.writeFile(filePath, content, { encoding: "utf8", flag: "wx" });
    } catch (error) {
        // Another request or the user may have created the file during fetching.
        if (error.code !== "EEXIST") throw error;
    }
}
