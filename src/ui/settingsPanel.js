export function openSettings(refs) {
    refs.settingsBackdrop.classList.add("open");
    refs.settingsPanel.classList.add("open");
    refs.settingsPanel.setAttribute("aria-hidden", "false");
}

export function closeSettings(refs) {
    refs.settingsBackdrop.classList.remove("open");
    refs.settingsPanel.classList.remove("open");
    refs.settingsPanel.setAttribute("aria-hidden", "true");
}
