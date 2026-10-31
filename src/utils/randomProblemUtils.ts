import * as path from "path";
import * as _ from "lodash";
import { Category, IProblem, ProblemState } from "../shared";
import { IStudyPlanEntry } from "../studyPlans/studyPlanLoader";
import { defaultBuiltinStudyPlans } from "../studyPlans/builtinStudyPlans";
import { localizeLabel } from "./labelUtils";

export interface IRandomScope {
    label: string;
    description?: string;
    all?: boolean;
    builtin?: string;
    value?: string;
    plan?: IStudyPlanEntry;
}

export type RandomCandidate = { kind: "leetcode"; problem: IProblem } | { kind: "markdown"; entry: IStudyPlanEntry };

export function randomScopes(roots: ReadonlyArray<{ id: string; name: string; entry?: IStudyPlanEntry }>): IRandomScope[] {
    const scopes: IRandomScope[] = [{ label: "全部题目", description: "力扣与所有自定义题单", all: true }];
    const added = new Set<string>();
    const addBuiltin = (builtin: string, name: string): void => {
        if (added.has(builtin)) return;
        added.add(builtin);
        scopes.push({ label: "力扣 / " + localizeLabel(name), builtin });
    };
    for (const root of roots) {
        if (root.entry?.kind === "group") scopes.push({ label: root.name, description: "自定义题单", plan: root.entry });
        else if (defaultBuiltinStudyPlans.some((item) => item.builtin === root.id)) addBuiltin(root.id, root.name);
    }
    // Built-in ranges remain available even if hidden in the sidebar configuration.
    for (const item of defaultBuiltinStudyPlans) addBuiltin(item.builtin, item.name);
    return scopes;
}

export function planProblems(plan: IStudyPlanEntry): IStudyPlanEntry[] {
    if (plan.kind === "group") return plan.children.reduce<IStudyPlanEntry[]>((entries, child) => entries.concat(planProblems(child)), []);
    return plan.kind === "leetcode" || plan.kind === "markdown" ? [plan] : [];
}

export function selectedPlans(scope: IRandomScope, plans: readonly IStudyPlanEntry[]): IStudyPlanEntry[] {
    return (scope.all ? plans : scope.plan ? [scope.plan] : []).reduce<IStudyPlanEntry[]>((entries, plan) => entries.concat(planProblems(plan)), []);
}

export function nativeScopeValues(category: string, problems: readonly IProblem[]): Array<{ label: string; description: string; value: string }> {
    const counts = new Map<string, number>();
    for (const problem of problems) {
        const values = category === Category.Difficulty ? [problem.difficulty] : category === Category.Tag ? problem.tags : problem.companies;
        for (const value of new Set(values)) counts.set(value, (counts.get(value) || 0) + 1);
    }
    const rank = (value: string): number => { const index = ["Easy", "Medium", "Hard"].indexOf(value); return index < 0 ? Number.MAX_SAFE_INTEGER : index; };
    return Array.from(counts).sort(([a], [b]) => category === Category.Difficulty ? rank(a) - rank(b) : a.localeCompare(b))
        .map(([value, count]) => ({ label: localizeLabel(category === Category.Difficulty ? value : _.startCase(value)), description: `${value} · ${count} 题`, value }));
}

export function randomCandidates(scope: IRandomScope, plans: readonly IStudyPlanEntry[], problems: readonly IProblem[], hideSolved: boolean, premium: boolean): RandomCandidate[] {
    const byId = new Map(problems.map((problem) => [problem.id, problem] as [string, IProblem]));
    const candidates: RandomCandidate[] = [];
    if (scope.all || scope.builtin) for (const problem of problems) {
        if (scope.builtin === Category.Favorite && !problem.isFavorite) continue;
        if (scope.value !== undefined) {
            if (scope.builtin === Category.Difficulty && problem.difficulty !== scope.value) continue;
            if (scope.builtin === Category.Tag && problem.tags.indexOf(scope.value) < 0) continue;
            if (scope.builtin === Category.Company && problem.companies.indexOf(scope.value) < 0) continue;
        }
        candidates.push({ kind: "leetcode", problem });
    }
    for (const entry of selectedPlans(scope, plans)) {
        if (entry.kind === "markdown" && entry.file) candidates.push({ kind: "markdown", entry });
        else if (entry.problemId && byId.has(entry.problemId)) candidates.push({ kind: "leetcode", problem: byId.get(entry.problemId)! });
    }
    const unique = new Map<string, RandomCandidate>();
    for (const candidate of candidates) {
        if (candidate.kind === "leetcode") {
            if (candidate.problem.locked && !premium || hideSolved && candidate.problem.state === ProblemState.AC) continue;
            unique.set("leetcode:" + candidate.problem.id, candidate);
        } else {
            if (hideSolved && candidate.entry.completed) continue;
            const file = path.resolve(candidate.entry.file!);
            const key = "markdown:" + (process.platform === "win32" ? file.toLowerCase() : file);
            const previous = unique.get(key);
            const entry = previous?.kind === "markdown" ? { ...candidate.entry,
                javaFiles: Array.from(new Set([...(previous.entry.javaFiles || []), ...(candidate.entry.javaFiles || [])])) } : candidate.entry;
            unique.set(key, { kind: "markdown", entry });
        }
    }
    return Array.from(unique.values());
}
