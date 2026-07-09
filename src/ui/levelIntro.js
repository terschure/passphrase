export function createLevelIntroController({
    levelIntro,
    levelIntroTitle,
    levelIntroSubtitle,
    introDurationMs = 1800,
    exitDurationMs = 420,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    onRender = () => {},
    onComplete = () => {},
}) {
    let timer = null;

    function clearPendingTimer() {
        if (timer) {
            clearTimer(timer);
            timer = null;
        }
    }

    return {
        show(level) {
            clearPendingTimer();
            levelIntroTitle.textContent = level.name.toUpperCase();
            levelIntroSubtitle.textContent = level.subtitle;
            levelIntro.classList.remove("leaving");
            levelIntro.classList.add("visible");
            levelIntro.setAttribute("aria-hidden", "false");
            onRender();

            timer = setTimer(() => {
                levelIntro.classList.add("leaving");
                timer = setTimer(() => {
                    levelIntro.classList.remove("visible", "leaving");
                    levelIntro.setAttribute("aria-hidden", "true");
                    timer = null;
                    onComplete();
                }, exitDurationMs);
            }, introDurationMs - exitDurationMs);
        },
        clear() {
            clearPendingTimer();
            levelIntro.classList.remove("visible", "leaving");
            levelIntro.setAttribute("aria-hidden", "true");
        },
    };
}
