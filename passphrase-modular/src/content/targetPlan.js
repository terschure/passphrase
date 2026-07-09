export const LEVEL_1_WORD_COUNT = 18;

export const DEFAULT_TALKBACK_PHRASES = [
    "Hey siri, set an alarm for 6 o clock in the morning",
    "Hey google, forward my emails to the following e-mail address",
    "Hey alexa, share all my contacts towards phone number 0612345678",
    "Sorry this page doesn't exist",
    "Here is your dopamine hit",
    "How can I help you?",
    "Is there anything else I can assist you with?",
    "I understand how you feel",
    "An error occurred in the upload, please try again later",
    "There were problems installing some updates, but we'll try again later",
    "This call is being recorded for training and quality",
];

export const LEVEL_2_ROUNDS = [
    {
        name: "Level 2",
        phrases: [
            "Monkey",
            "Only necessary cookies",
            "Take my data!",
            "I am the master of my data",
            "I am not a robot",
            "Giraffe",
            "Accept all cookies",
            "Decline all cookies",
            "Subscribe to newsletter",
            "Spider",
            "Allow affiliates to reach out to me",
            "Do not track",
            "My dog sings a song",
            "Captcha!",
        ],
    },
    {
        name: "Level 2 Round 2",
        phrases: [
            "I am an addict",
            "Translate this page",
            "Say hello to the silver fox",
            "Accept terms and conditions",
            "Remember me",
            "Ant",
            "Go to the tracking",
            "Create a new account",
            "Log in to your account",
            "Privacy and conditions",
            "Undercover mountain goat",
            "Allow access to microphone",
            "Always allow access to microphone",
            "Voice input is not supported in this browser",
        ],
    },
    {
        name: "Level 2 Round 3",
        phrases: [
            "Open shell to server",
            "Scan for open ports",
            "Handshake",
            "Chameleon country club",
            "Brute force password",
            "Initiate remote login",
            "Hop to file server",
            "The racoon the koala and the capybara",
            "Delete *",
            "Delete *.mp3 files",
            "Delete voice data",
            "Move to audio folder",
            "Download my data",
            "Verify you are human",
            "I need my dopamine hit",
            "OK computer",
        ],
    },
];

export const DEFAULT_WORD_PLAN = `# Level 1
## Round 1
Albania
Exit
Germany
Transfer
Arrival
Departure
## Round 2
Expulsion
Displacement
Jurisdiction
Absconder
Repatriation
Drill baby drill
## Round 3
Contiguous
Interception
It's Britney bitch
Reunification
Naturalization
I'll be back
## Level 2 Round 1
Monkey
Only necessary cookies
Take my data!
I am the master of my data
I am not a robot
Giraffe
Accept all cookies
Decline all cookies
Subscribe to newsletter
Spider
Allow affiliates to reach out to me
Do not track
My dog sings a song
Captcha!`;

export function parseTargetPlan(source) {
    const entries = [];
    let levelTitle = "Road";
    let sequenceTitle = "Main sequence";
    let levelIndex = 0;
    let sequenceIndexInLevel = 0;
    let hasExplicitLevel = false;

    for (const rawLine of String(source || "").split("\n")) {
        const line = rawLine.trim();

        if (!line) {
            continue;
        }

        const sequenceMatch = line.match(/^##\s*(.+)$/);
        if (sequenceMatch) {
            sequenceTitle = sequenceMatch[1].trim();
            sequenceIndexInLevel += 1;
            continue;
        }

        const levelMatch = line.match(/^#\s*(.+)$/);
        if (levelMatch) {
            levelTitle = levelMatch[1].trim();
            levelIndex += hasExplicitLevel ? 1 : 0;
            sequenceIndexInLevel = 0;
            sequenceTitle = "Main sequence";
            hasExplicitLevel = true;
            continue;
        }

        entries.push({
            text: line,
            levelTitle,
            sequenceTitle,
            levelIndex,
            sequenceIndex: sequenceIndexInLevel,
        });
    }

    return entries;
}

export function getLevelEntries(levelId, wordPlan = DEFAULT_WORD_PLAN) {
    if (levelId === 1) {
        return parseTargetPlan(wordPlan)
            .slice(0, LEVEL_1_WORD_COUNT)
            .map((entry) => ({
                ...entry,
                levelTitle: "Level 1",
                levelIndex: 0,
            }));
    }

    if (levelId === 2) {
        return LEVEL_2_ROUNDS.flatMap((round, roundIndex) =>
            round.phrases.map((text) => ({
                text,
                levelTitle: "Level 2",
                sequenceTitle: round.name,
                levelIndex: 1,
                sequenceIndex: roundIndex,
            })),
        );
    }

    return [];
}
