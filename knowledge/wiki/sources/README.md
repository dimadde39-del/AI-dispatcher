# Source Summaries

Use this folder for summaries of files stored in `knowledge/raw/`.

Each source summary should include:

- Source filename.
- Date added.
- Short summary.
- Important facts.
- Open questions.
- Links to related entities, concepts, decisions, or synthesis notes.

## Current Raw Source Set

- `01_CONCEPT_AND_WEDGE.md`: Core wedge. The product sells saved orders from missed calls, not a bot or CRM.
- `02_CUSTOMER_PROFILES.md`: ICPs: washing machine repair, plumbers, fridge repair, locksmiths, and conditioner installers.
- `03_PAIN_AND_USE_CASES.md`: Main pains: missed call to competitor, late callback, empty trip, chaotic notes, and unqualified callers.
- `04_PRODUCT_FLOW.md`: Main missed-call forwarding flow, busy-call forwarding flow, and future anti-no-show confirmation.
- `05_MVP_SCOPE.md`: MVP phases: manual pilot, first paid version, and what waits until enough paying masters.
- `06_TECHNICAL_ARCHITECTURE.md`: Vapi first, Pipecat/self-host later, local SIP constraints, and an earlier SQLite/Beeline Cloud proposal.
- `07_TELEPHONY_AND_FORWARDING.md`: Kazakhstan forwarding realities; avoid foreign SIP assumptions and explain forwarding minute costs to masters.
- `08_VOICE_AI_PROMPTS.md`: First-phrase trust/legal framing, service-specific prompts, and price/arrival guardrails.
- `09_SAFETY_AND_GUARDRAILS.md`: Personal data consent framing, data localization concerns, price/guarantee limits, and emergency handling.
- `10_TELEGRAM_LEAD_CARD_SPEC.md`: Telegram lead card, inline buttons, and lead state machine.
- `11_PILOT_PLAN_AND_GATES.md`: 14-day manual pilot and kill gates.
- `12_ECONOMICS_AND_PRICING.md`: Vapi cost phase, later self-host margin phase, and hidden forwarding costs.
- `13_SALES_PLAYBOOK.md`: Field sales script, demo sequence, offer, and objection handling.
- `14_COMPETITOR_RESEARCH.md`: Competitors include doing nothing, voicemail, call centers, telephony/CRM, and WhatsApp bot agencies.
- `15_LEGAL_AND_PRIVACY.md`: Business registration, Kazakhstan personal data localization, data collection, offer, and liability.
- `16_PARTNERSHIP_50_50.md`: Founder/sales partner role split, vesting, IP, and expense expectations.
- `17_ROADMAP.md`: v0 manual test, v1 AI call capture, v2 scheduling, v3 payments, v4 CRM/upsell, v5 marketplace.
- `18_RED_TEAM_PROMPT.md`: Review lenses: investor, angry master, panicked client, field sales, voice AI architect, legal/ops, pessimist.
- `19_ONE_PAGE_FOR_FRIEND.md`: One-page sales cheat sheet with demo and pilot success framing.
- `20_AI_VS_VOICEMAIL.md`: AI dispatcher vs voicemail: dialogue, data extraction, readable Telegram summary, and qualification.
- `21_THE_MARKETPLACE_MOAT.md`: Future squad/brigade expansion and marketplace only after strong supply.

## Source Quality Note

The Russian raw text appears mojibake/encoding-garbled when read normally in the current shell. Agents should not rewrite raw files; use careful decoding for summaries or ask for clean copies if exact wording matters.
