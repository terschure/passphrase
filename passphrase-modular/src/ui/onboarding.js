export function showOnboardingStep({
    refs,
    step,
    speechRecognitionSupported,
    onApplied,
}) {
    refs.onboardingCard.classList.add("switching");

    setTimeout(() => {
        if (step === 1) {
            refs.onboardingTitle.textContent = "Passphrase";
            refs.onboardingCopy.innerHTML = [
                "<p>Your voice has entered the system.</p>",
                '<p class="onboarding-small">Speak carefully. The system is listening.</p>',
            ].join("");
            refs.onboardingAction.textContent = "Continue";
        } else {
            refs.onboardingTitle.textContent = "How to play";
            const finalInstruction = speechRecognitionSupported
                ? "Say START or press Start to begin."
                : "Press Start to begin.";
            refs.onboardingCopy.innerHTML = [
                "<p>Say the word on the wall to pass through.</p>",
                "<p>Each level tests how your voice is heard, judged, and accepted.</p>",
                `<p class="onboarding-small">${finalInstruction}</p>`,
            ].join("");
            refs.onboardingAction.textContent = "Start";
        }

        refs.onboardingCard.classList.remove("switching");
        refs.onboardingAction.focus();
        onApplied?.();
    }, 160);
}

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
