# Vision

## What xnovelist is

xnovelist is a novel writing application that runs entirely in the user's browser, stores every word in the user's own device, and treats AI as an opt-in layer rather than a required component. It is a serious writing tool first, an AI-assisted writing tool second.

xnovelist is a **pure static asset bundle**: HTML, CSS, JavaScript, a few fonts and icons, nothing else. It deploys to any CDN — GitHub Pages, Cloudflare, Netlify, an internal HTTP server — and opens from `file://` if the user double-clicks the bundled `index.html`. There is no xnovelist server, no account, no subscription. We never run one.

The application is **responsive across phone, tablet, and desktop**. The same bundle serves every device; the layout adapts. Touch interactions are first-class — selection, AI affordances, snapshot navigation, bible editing all work with a finger. A novelist drafts at home on a laptop, revises on a tablet at a cafe, polishes a paragraph on their phone on the train.

xnovelist is **multilingual by design** — both the UI and the AI prompts. The UI translates to the user's chosen interface language; the AI prompts use the language the novel is being written in. The two are independent. A user with a French UI writing a Japanese novel gets a French interface and Japanese AI output. Initial language coverage is English and Vietnamese; further languages ship as pull requests.

The defining commitment: a novelist who never enables AI should still find xnovelist among the most thoughtful writing environments available. Chapter management, a Story Bible for characters and locations and voice, automatic snapshots with line-level diff, find-and-replace across the manuscript, typography control suited to long-form prose, distraction-free mode, DOCX export — all of this works without an LLM ever being called.

The second commitment: a novelist who *does* want AI gets it in three calibrated phases. Polish (sentence-level edits on a highlighted selection), Beat (the AI writes prose inside a card-shaped slot the user authored), Agent (the AI plans, drafts, and self-checks a scene for the user to review). Each phase has a named, fixed tool set. The user always knows which tool they are invoking and which they are not. And every AI call goes directly from the user's browser to the LLM endpoint they configured — OpenAI, OpenRouter, Ollama, LM Studio, whatever they pick — with xnovelist nowhere in the loop.

## Who it is for

**The AI-skeptical novelist.** Forty-five, literary or genre, has been writing for fifteen years, has tried ChatGPT once and found its prose insufferable. Wants chapter organisation, a place to keep character notes that the manuscript will respect, version history they can roll back, and an export that comes out clean. Will not enable the AI toggle and never has to. xnovelist must serve this user well, or the rest of the product doesn't matter.

**The AI-curious novelist.** Twenty-eight, fantasy or speculative, drafts fast and revises hard. Wants help with sensory description, dialogue voice, and continuity bookkeeping across a 200,000-word epic. Willing to learn a tool set; allergic to magic-AI-does-everything pitches. Wants to highlight a sentence, see the AI's proposal as a diff, accept or discard, and move on. Will eventually want beat-driven generation but only when the polish tier has earned that trust.

The product is sized for both. The same install serves both. The AI-skeptical user's experience is not impoverished because the AI exists; the AI-curious user's experience is not unsafe because the AI is opt-in.

## What it is not

xnovelist is not a cloud SaaS. There is no xnovelist account, no server-side manuscript storage, no telemetry of writing content. Backup and sync are the user's responsibility — exports are first-class to make this easy.

xnovelist is not a chat-based AI writer. There is no free-text "ask the AI anything" surface. Every AI action is a named tool with a defined input contract and a previewed output.

xnovelist is not a screenplay or stage-play tool. Those formats need different structural primitives (sluglines, action lines, character cues, page-per-minute pacing) that distract from prose-fiction needs. A separate product would do them better.

xnovelist is not a generic markdown editor or a blog platform. It is opinionated about being a novel-writing surface: chapter outlines, character bibles, continuity tracking, manuscript compilation. A general-purpose markdown editor would be lighter; xnovelist is heavier because novelists ask more of their tool than bloggers do.

xnovelist is not a publishing or marketing platform. The export pipeline ends at DOCX (and eventually EPUB, PDF). What happens after that — querying agents, formatting for KDP, ad campaigns — is somebody else's product.

## The three-year horizon

In year one xnovelist ships v1.0: the full editor and Story Bible, with phase 1 AI tools fully validated. The product is genuinely useful to both personas. Real novelists have written real chapters in it.

In year two phase 2 (beat-driven writing) and phase 3 (agent writing) ship, each gated by the trust criteria spelled out in the AI design doc. The "tool set per phase" doctrine matures into a stable contract: each tool's prompt, temperature, length policy, and failure mode is locked, documented, and only changed via a deliberate process.

In year three xnovelist remains a single-purpose, single-install, single-user application. It does not pivot to collaboration, to a marketplace, to a cloud product. The bet is that *enough* novelists want a tool with this exact shape — local, AI-optional, calibrated — that the product can sustain itself by being the best version of itself rather than by sprawling.
