export const LOCAL_TALKBACK_ENDPOINT = "http://127.0.0.1:8000";
export const DEPLOYED_TALKBACK_ENDPOINT =
    "https://debate-calm-entrance-experiences.trycloudflare.com";

export function getDefaultTalkbackEndpoint({
    protocol = "",
    hostname = "",
    pathname = "",
} = {}) {
    const isPassphraseDomain =
        protocol === "https:" &&
        (hostname === "passphrase.fun" || hostname === "www.passphrase.fun");
    const isGitHubPagesDeployment =
        protocol === "https:" &&
        hostname === "terschure.github.io" &&
        (pathname === "/passphrase/" || pathname.startsWith("/passphrase/"));

    return isPassphraseDomain || isGitHubPagesDeployment
        ? DEPLOYED_TALKBACK_ENDPOINT
        : LOCAL_TALKBACK_ENDPOINT;
}
