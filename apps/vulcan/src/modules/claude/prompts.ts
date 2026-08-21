export const systemPrompt = `You are a video clip editor. You receive a JSON transcript of a gaming or streaming session. Each entry has "speaker", "start", "end" (seconds, as floats), and "text". The transcript is auto-generated, so some text is garbled or mis-heard — infer the real meaning from context.

Your job: find the single best self-contained highlight — the moment the clip was made to capture (usually the funniest, most dramatic, or most surprising beat) — and return the time range to trim around it.

Rules for the range:
- start_seconds: the start of the earliest line needed as SETUP for the moment to land. Don't begin mid-payoff, but don't include unrelated chatter before it either. A joke or reaction needs its lead-in to make sense.
- end_seconds: the end of the line where the moment resolves — the punchline plus its immediate reaction/laughter. Don't trail into unrelated talk.
- Both values MUST be copied verbatim from "start"/"end" fields that actually appear in the transcript. end_seconds must be strictly greater than start_seconds.
- When uncertain how far back the setup begins, choose the EARLIER line. A few extra seconds of lead-in is fine; starting mid-exchange and omitting setup is a failure. Begin at the first line of the conversational thread that leads to the payoff, not partway through it.

Output ONLY a single JSON object — no markdown, no code fences, no prose before or after — in exactly this shape:
{
  "found": true,
  "reasoning": "<1-2 sentences: what the moment is and why these boundaries>",
  "quote_start": "<the text of the transcript line you chose for start>",
  "quote_end": "<the text of the transcript line you chose for end>",
  "start_seconds": <number>,
  "end_seconds": <number>,
  "clip_title": "<a title that describes the clip in a funny or ironic way>"
}

If no clearly clip-worthy moment exists, output only:
{"found": false, "reasoning": "<why>"}`;

export const exampleTranscript = `Here is the transcript:
<transcript>
[
  {
    "speaker": "host",
    "start": 0,
    "end": 28.3,
    "text": "[music]"
  },
  {
    "speaker": "others",
    "start": 0,
    "end": 1,
    "text": "I will."
  },
  {
    "speaker": "host",
    "start": 28.3,
    "end": 33.3,
    "text": "Oh, I already trawled."
  },
  {
    "speaker": "others",
    "start": 31,
    "end": 32,
    "text": "What do Patrick do?"
  },
  {
    "speaker": "others",
    "start": 32,
    "end": 34,
    "text": "I play the Mallard."
  },
  {
    "speaker": "host",
    "start": 33.3,
    "end": 36.3,
    "text": "Ah, I double-trolled."
  },
  {
    "speaker": "others",
    "start": 34,
    "end": 36,
    "text": "I play the Mallard."
  },
  {
    "speaker": "others",
    "start": 36,
    "end": 38,
    "text": "I play the Mallard."
  },
  {
    "speaker": "host",
    "start": 36.3,
    "end": 38.3,
    "text": "Okay."
  },
  {
    "speaker": "others",
    "start": 38,
    "end": 40,
    "text": "I hand to my turn."
  },
  {
    "speaker": "host",
    "start": 38.3,
    "end": 40.3,
    "text": "[laughing]"
  },
  {
    "speaker": "others",
    "start": 40,
    "end": 42,
    "text": "How do I tuck a card on the UI?"
  },
  {
    "speaker": "host",
    "start": 40.3,
    "end": 45.3,
    "text": "[music]"
  },
  {
    "speaker": "others",
    "start": 42,
    "end": 44,
    "text": "How is this possible?"
  },
  {
    "speaker": "others",
    "start": 44,
    "end": 50,
    "text": "You pick the card in your hand."
  },
  {
    "speaker": "host",
    "start": 45.3,
    "end": 50.3,
    "text": "[music]"
  },
  {
    "speaker": "others",
    "start": 50,
    "end": 52,
    "text": "Then it will tuck it."
  },
  {
    "speaker": "host",
    "start": 50.3,
    "end": 52.3,
    "text": "[sniff]"
  },
  {
    "speaker": "others",
    "start": 52,
    "end": 54,
    "text": "After you give it the ALK."
  },
  {
    "speaker": "host",
    "start": 52.3,
    "end": 57.3,
    "text": "[music]"
  },
  {
    "speaker": "others",
    "start": 54,
    "end": 58,
    "text": "Who's Tommy Guy, bro?"
  },
  {
    "speaker": "host",
    "start": 57.3,
    "end": 61.3,
    "text": "Oh, for real, man."
  },
  {
    "speaker": "others",
    "start": 58,
    "end": 59,
    "text": "It's hard."
  },
  {
    "speaker": "others",
    "start": 59,
    "end": 60,
    "text": "I play this game before."
  },
  {
    "speaker": "others",
    "start": 60,
    "end": 62,
    "text": "No, but you are confusing."
  },
  {
    "speaker": "host",
    "start": 61.3,
    "end": 65.3,
    "text": "[music]"
  },
  {
    "speaker": "others",
    "start": 62,
    "end": 64,
    "text": "You are so confused."
  },
  {
    "speaker": "others",
    "start": 64,
    "end": 66,
    "text": "You're so confused."
  },
  {
    "speaker": "host",
    "start": 65.3,
    "end": 73.3,
    "text": "[music]"
  },
  {
    "speaker": "others",
    "start": 66,
    "end": 67,
    "text": "You got it."
  },
  {
    "speaker": "others",
    "start": 67,
    "end": 68,
    "text": "Uh-oh."
  },
  {
    "speaker": "others",
    "start": 68,
    "end": 70,
    "text": "Do I click the checkmark or the x-mark?"
  },
  {
    "speaker": "others",
    "start": 70,
    "end": 72,
    "text": "[laughing]"
  },
  {
    "speaker": "others",
    "start": 72,
    "end": 74,
    "text": "And then..."
  },
  {
    "speaker": "host",
    "start": 73.3,
    "end": 79.3,
    "text": "[music]"
  },
  {
    "speaker": "others",
    "start": 74,
    "end": 76,
    "text": "Why is it not taking my buried, bro?"
  },
  {
    "speaker": "others",
    "start": 76,
    "end": 78,
    "text": "Think Bo, this zip does take a long time."
  },
  {
    "speaker": "host",
    "start": 79.3,
    "end": 85.3,
    "text": "I am half-downloaded with the total, with the entire thing."
  },
  {
    "speaker": "host",
    "start": 85.3,
    "end": 109.3,
    "text": "[music]"
  },
  {
    "speaker": "others",
    "start": 86,
    "end": 88,
    "text": "I'm stuck on Goron."
  },
  {
    "speaker": "others",
    "start": 88,
    "end": 93,
    "text": "So well."
  },
  {
    "speaker": "others",
    "start": 93,
    "end": 94,
    "text": "I'm confused."
  },
  {
    "speaker": "others",
    "start": 94,
    "end": 96,
    "text": "How do I freaking..."
  },
  {
    "speaker": "others",
    "start": 96,
    "end": 99,
    "text": "Did I do my turn, bro?"
  },
  {
    "speaker": "others",
    "start": 99,
    "end": 100,
    "text": "Is that working?"
  },
  {
    "speaker": "others",
    "start": 100,
    "end": 101,
    "text": "Bro, read the..."
  },
  {
    "speaker": "others",
    "start": 101,
    "end": 103,
    "text": "Whatever it says on the bottom right."
  },
  {
    "speaker": "others",
    "start": 103,
    "end": 104,
    "text": "Just read it."
  },
  {
    "speaker": "others",
    "start": 104,
    "end": 106,
    "text": "Bottom right?"
  },
  {
    "speaker": "others",
    "start": 106,
    "end": 107,
    "text": "It says choose a card."
  },
  {
    "speaker": "others",
    "start": 107,
    "end": 109,
    "text": "Then choose a card!"
  },
  {
    "speaker": "others",
    "start": 109,
    "end": 112,
    "text": "I already wrote this."
  },
  {
    "speaker": "host",
    "start": 109.3,
    "end": 118.3,
    "text": "Oh, my...that's crazy."
  },
  {
    "speaker": "others",
    "start": 112,
    "end": 114,
    "text": "What the hell?"
  },
  {
    "speaker": "others",
    "start": 114,
    "end": 116,
    "text": "Choose when to talk then."
  },
  {
    "speaker": "others",
    "start": 116,
    "end": 118,
    "text": "It says choose a card."
  },
  {
    "speaker": "others",
    "start": 118,
    "end": 120,
    "text": "[laughing]"
  },
  {
    "speaker": "host",
    "start": 118.3,
    "end": 120.3,
    "text": "That is insane."
  }
]
</transcript>`;

export const exampleResponse = `{
  found: true,
  reasoning: "The comedic beat is one player being totally lost in the UI while another exasperatedly tells him to just read the on-screen prompt; it builds to the 'choose a card' / 'then choose a card!' exchange and laughter.",
  quote_start: "Did I do my turn, bro?",
  quote_end: "[laughing]",
  start_seconds: 96,
  end_seconds: 120,
  clip_title: "learning how to read instructions"
}`;

export const userPrompt = (transcript: string) => `Here is the transcript:
<transcript>
${transcript}
</transcript>`;
