---
name: to-questionnaire
description: Turn a decision you can't fully answer into a questionnaire for someone else to fill in.
disable-model-invocation: true
---

Turn something the user can't answer alone into a **questionnaire**: a single shareable HTML page the user sends to one person to fill in async, or fills out together with them over a meeting. The recipient holds knowledge the user lacks; the questionnaire pulls it out of them. The page has an answer box under every question, keeps answers in the recipient's browser between visits, and ends with a **Copy answers** button that puts every question and answer on the clipboard as Markdown, so the recipient replies by pasting.

**Grill the send, not the subject.** Interview the user only about the _send_, which they can always answer: who it goes to, and what they need back. The questions in the document then target the **gap** between what the recipient knows and what the user needs.

1. **Who is it going to?** Ask, in one exchange, the recipient's role, expertise, and relationship to the user. This fixes the questionnaire's tone and how much context it must carry. Done when you know who the recipient is and what they know that the user doesn't.

2. **What do you need back?** Ask, in one exchange, the specific decisions or facts the user can't resolve alone and needs from this person. Done when you have a concrete list of what the user must walk away able to do or decide.

3. **Write the questionnaire.** Draft the questions aimed at the gap from steps 1–2, following the Question rules below. Copy [template.html](template.html) to `to-questionnaire-<slug>.html` in the current directory (slug from the topic) and replace only the JSON inside `<script type="application/json" id="questionnaire">` with your content. The rendering, autosave and copy behaviour live in the rest of the file and are identical in every questionnaire; leave them untouched. Done when the file exists, the JSON parses, and every item the user named in step 2 is covered by a question.

4. **Share it.** If the Artifact tool is available, publish the file with it and report the link together with the path; the link is what the user forwards. Otherwise report the path and say the file opens in any browser and can be sent as an attachment. Done when the user has something they can hand to the recipient.

## Question rules

Frame the document as a **discovery questionnaire**: the user lacks context, the recipient holds it. The JSON fields map onto the page like this:

- `title`, `purpose`, `from`, `to`, `usage` make the header. Purpose states why the questionnaire exists and the decision riding on it. Usage says where the answers go.
- `context` is one paragraph orienting a recipient who wasn't in the user's head. Enough to answer well, not a page.
- `howToAnswer` carries the deadline and rough effort, and says that partial answers and "I don't know" are useful, so the recipient flags what they're unsure of instead of skipping it.
- `sections` group the questions under one heading per theme once there are more than a handful; a short questionnaire is one section. Order sections and questions most-important-first, since async means you may only get one pass.
- Every question's `text` is one idea, never compound. Add `why` only where the question could be misread or invite a throwaway answer, as one line the recipient reads as "Why this matters: ...".
- `closing` is the catch-all at the end: anything we didn't ask that we should know?

<question-example>
{ "text": "What load is the system expected to handle at launch?",
  "why": "It decides whether we provision for burst traffic now or defer it." }
</question-example>
