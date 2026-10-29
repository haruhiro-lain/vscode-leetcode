import { Command, Uri } from "vscode";
import { LeetCodeNode } from "../explorer/LeetCodeNode";
import { defaultProblem, ProblemState } from "../shared";
import { IStudyPlanEntry } from "./studyPlanLoader";

export class StudyPlanNode extends LeetCodeNode {
    public constructor(public readonly entry: IStudyPlanEntry) {
        super(Object.assign({}, defaultProblem, { id: entry.id, name: entry.name }), false);
    }

    public get previewCommand(): Command {
        return { title: "预览本地题目", command: "leetcode.previewLocalMarkdown", arguments: [this] };
    }

    public get state(): ProblemState {
        return this.entry.kind === "markdown" && this.entry.completed ? ProblemState.AC : ProblemState.Unknown;
    }

    public get uri(): Uri {
        return this.entry.file ? Uri.file(this.entry.file) : super.uri;
    }
}
