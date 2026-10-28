export const extensionId: string = "haruhiro-lain.leetcode-cn";
export const legacyExtensionId: string = "leetcode.vscode-leetcode";
export const legacyMigrationKey: string = "leetcode-cn.legacyStateMigratedV1";

export function buildAuthLoginUrl(baseUrl: string, uriScheme: string): string {
    return `${baseUrl}/authorize-login/${encodeURIComponent(uriScheme)}/?path=${encodeURIComponent(extensionId)}`;
}

export function isOwnLoginCallback(authority: string): boolean {
    return authority.toLowerCase() === extensionId;
}
