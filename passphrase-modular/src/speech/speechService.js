export function createSpeechService({
    windowRef = window,
    navigatorRef = navigator,
    callbacks = {},
} = {}) {
    const SpeechRecognition =
        windowRef.SpeechRecognition || windowRef.webkitSpeechRecognition;
    let recognition = null;
    let starting = false;
    let listening = false;

    function isSupported() {
        return Boolean(SpeechRecognition);
    }

    function isStarting() {
        return starting;
    }

    function isListening() {
        return listening;
    }

    function ensureRecognition() {
        if (recognition || !SpeechRecognition) {
            return recognition;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = navigatorRef.language || "en-US";

        recognition.onstart = () => {
            starting = false;
            listening = true;
            callbacks.onStart?.();
        };

        recognition.onend = () => {
            starting = false;
            listening = false;
            callbacks.onEnd?.();
        };

        recognition.onerror = (event) => {
            starting = false;
            callbacks.onError?.(event);
        };

        recognition.onresult = (event) => {
            callbacks.onResult?.(event);
        };

        return recognition;
    }

    function start() {
        const instance = ensureRecognition();

        if (!instance || starting || listening) {
            return false;
        }

        starting = true;
        try {
            instance.start();
            return true;
        } catch (error) {
            starting = false;
            callbacks.onStartError?.(error);
            return false;
        }
    }

    function stop() {
        if (!recognition) {
            return;
        }

        recognition.stop();
    }

    return {
        ensureRecognition,
        isSupported,
        isStarting,
        isListening,
        start,
        stop,
    };
}
