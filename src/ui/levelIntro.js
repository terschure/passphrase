export function createLevelIntroController({
    levelIntro,
    levelIntroTitle,
    levelIntroSubtitle,
    introDurationMs = 3200,
    exitDurationMs = 600,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    onRender = () => {},
    onComplete = () => {},
}) {
    let timer = null;
    let activeCards = [];
    let activeIndex = 0;
    let stableBackdrop = false;

    function clearPendingTimer() {
        if (timer) {
            clearTimer(timer);
            timer = null;
        }
    }

    function showCard(card) {
        levelIntroTitle.textContent = card.title || "";
        levelIntroSubtitle.textContent = card.subtitle || "";
        if (card.message) {
            levelIntro.classList.add("level-intro--message");
        } else {
            levelIntro.classList.remove("level-intro--message");
        }
        levelIntro.classList.remove("leaving", "level-intro--card-switching");
        levelIntro.classList.add("visible");
        levelIntro.setAttribute("aria-hidden", "false");
        onRender();

        const cardDurationMs = card.durationMs || introDurationMs;
        const cardExitMs = card.exitDurationMs || exitDurationMs;

        timer = setTimer(() => {
            const hasNextCard = activeIndex + 1 < activeCards.length;

            if (stableBackdrop && hasNextCard) {
                levelIntro.classList.add("level-intro--card-switching");
                timer = setTimer(() => {
                    timer = null;
                    activeIndex += 1;
                    showCard(activeCards[activeIndex]);
                }, cardExitMs);
                return;
            }

            levelIntro.classList.add("leaving");
            timer = setTimer(() => {
                levelIntro.classList.remove("visible", "leaving");
                timer = null;
                activeIndex += 1;

                if (activeIndex < activeCards.length) {
                    showCard(activeCards[activeIndex]);
                    return;
                }

                levelIntro.classList.remove("level-intro--message");
                levelIntro.setAttribute("aria-hidden", "true");
                onComplete();
            }, cardExitMs);
        }, Math.max(1, cardDurationMs - cardExitMs));
    }

    return {
        show(
            level,
            { cards = null, stableBackdrop: nextStableBackdrop = false } = {},
        ) {
            clearPendingTimer();
            stableBackdrop = Boolean(nextStableBackdrop);
            activeCards =
                cards ||
                [
                    {
                        title: level.name.toUpperCase(),
                        subtitle: "",
                        message: false,
                        durationMs: 1900,
                    },
                    {
                        title: level.subtitle || "",
                        subtitle: "",
                        message: true,
                        durationMs: 3300,
                    },
                ];
            activeIndex = 0;
            showCard(activeCards[activeIndex]);
        },
        clear() {
            clearPendingTimer();
            activeCards = [];
            activeIndex = 0;
            stableBackdrop = false;
            levelIntro.classList.remove(
                "visible",
                "leaving",
                "level-intro--message",
                "level-intro--card-switching",
            );
            levelIntro.setAttribute("aria-hidden", "true");
        },
    };
}
