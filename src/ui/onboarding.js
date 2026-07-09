export function hideOnboarding(refs) {
    refs.onboardingScreen.classList.add("hidden");
    refs.onboardingScreen.setAttribute("aria-hidden", "true");
}

export function normalizeVoiceCommand(text) {
    return text.toLowerCase().trim().replace(/[.,!?]/g, "");
}

export function isStartCommand(text) {
    const command = normalizeVoiceCommand(text);
    return command === "start" || command.includes("start game");
}
