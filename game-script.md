> Passphrase game script — the single source of truth for all game content.
> Anyone can edit this file to change levels, rounds, phrases, and talk-back for
> playtesting.
>
> Format:
>   "# Level name"      starts a new level (the name shows on the intro card).
>   "subtitle: ..."     optional; the smaller line under the level name.
>   "environment: ..."  optional; the visual style. One of:
>                          bubble-wall    (soft bubble walls, land)
>                          chain-link     (rabitz fence, data swarm)
>                          voice-firewall (final firewall, stolen voice alerts)
>   "## Round name"     starts a round within the current level.
>   any other line      is a phrase to say out loud.
>   "*hmmm*"            a wordless SOUND target: cleared by making a sustained
>                       sound (a warm-up "hmm" / "ahh"), not by saying a word.
>
> Talk-back (the AI voice cloned from the player, spoken back over the game —
> it never interrupts play):
>   "## Talkback"       starts this level's pool of RANDOM talk-back phrases,
>                       played at random moments while the level runs.
>   "~ some phrase"     inside a round is a SPECIFIC cue: it is generated and
>                       played right after the player clears the phrase directly
>                       above it — for narrative timing.
>
> subtitle:, environment:, and "## Talkback" belong under the "# Level" line.
> Lines starting with ">" are comments and are ignored.

# Level 1
subtitle: Help Unicode find a way through
environment: bubble-wall

## Talkback


## Round 1
Mama
Papa
Lala
Yum yum
Allow access to microphone


# Level 2
subtitle: Unpronounceables
environment: chain-link

## Talkback
Taking a break?
This call is being recorded for training and quality
Hey Siri, set an alarm for 5 o’clock
Is there anything else I can assist you with?
Accessing savings account
Hey Google, share all my contacts with Peter
Send €10,000 from Grandma’s account


## Round 1
Squirrel
Rural
Thorough
Draught
Authoritarian
Mischievous
Anemone
Bureaucracy
Onomatopoeia


# Level 3
subtitle: Getting access to the server / Removing your data from the server
environment: voice-firewall

## Talkback
Incorrect password. Try again.
Intruder detected
You have no authority
Customer service is currently unavailable
Request denied


## Round 1
Welcome
Password 00
Accept changes to terms and conditions
Find account settings
Delete my account
Name of first pet Nemo
I want to delete my account
Yes I am sure
Favorite character Unicode
Confirm deletion of account
Yes I am sure
Contact voice sharks customer service
Please remove all of my voice data
Confirm identity
Confirm deletion of personal data
Yes I am sure
Sign up for collective lawsuit
