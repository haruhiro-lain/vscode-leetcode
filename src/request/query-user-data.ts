import { UserDataType } from "../globalState";
import { getUrl } from "../shared";
import { LcAxios } from "../utils/httpUtils";

const graphqlStr = `
    query globalData {
        userStatus {
            isPremium
            isVerified
            username
            avatar
            isSignedIn
        }
    }
`;

export const queryUserData = async (cookie?: string): Promise<UserDataType> => {
    return LcAxios(getUrl("userGraphql"), {
        method: "POST",
        data: {
            query: graphqlStr,
            variables: {},
        },
    }, cookie).then((res) => {
        const data = res.data?.data?.userStatus;
        if (res.data?.errors?.length || !data || typeof data.isSignedIn !== "boolean" ||
            (data.isSignedIn && !data.username)) {
            throw new Error("力扣未返回有效的登录状态，请稍后重试。");
        }
        return data;
    });
};
