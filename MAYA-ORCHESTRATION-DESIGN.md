# Maya Orchestration Design

## Purpose

Maya stops pointing users at tools and starts running them. A user tells her what they want ("build me a social calendar for October", "send an email about the webinar", "I need a deck for the board"), and she does three things in order:

1. **Judges** whether the work should happen, as a Marketing Director would: what is it for, does it fit the plan, what does it cost.
2. **Plans** the work as a job: a set of steps across Image Creator, Email Creator, Social, Catalyst, Docs and her own presentation pipeline.
3. **Runs** the job, stopping for approval before anything is published, sent or paid for.

Before this work she only routed: `MarketingDirectorCapabilitiesService` matches phrases and replies "This is email-composer work. Open Compose Email," and the user does the coordinating. That is the problem this design removes. (Her chat still routes until gap 8; jobs start from Maya's work page.)

This document is grounded in the API as documented on 2026-10-01 (`taliferrotech/frontend/src/assets/api/*.yaml`). Every operation there carries an `x-maya` tag (`direct`, `approval`, `internal`, `never`) that this design treats as the source of truth for what Maya may do.

## Status (2026-10-02)

Phase 1 is built, plus single emails from Phase 2. **None of it has run live yet:** the backend functions and Maya's web app need deploying (the Firestore indexes for jobs are already deployed). There is no staging for Maya (or the other web products), so the first test is in production.

### Done

| Piece | Where |
|---|---|
| API docs match the backend, every operation tagged `x-maya` | `taliferrotech/frontend/src/assets/api/*.yaml` |
| OpenAI/Claude switch for planning (OpenAI by default) | `aiProvider.service.js`, Admin Control Panel → Maya tab |
| Organization size: required in Maya's sign-up wizard, default 2 | `employeeCount.js`, `/get-started`, `/profile` |
| Gap 1: save images to the Docs library | `imageLibrary.service.js`, `POST /image-creator/save-to-library` |
| Gap 2: image and email allowances per workspace | `tenantAllowance.js` |
| Gap 3: job store, planner, runner, trigger, sweeper | `todd-backend/functions/maya/`, `/maya/jobs` |
| Gap 5: plan-fit check and decisions | `maya/planFit.js`, `POST /maya/jobs/:id/decision` |
| Gap 6: Maya's work page (approvals, questions, jobs) | `maya-marketing/src/app/features/work/` (`/work`) |
| Gap 7: pushback setting | `operatorConfig.maya.pushbackLevel`, `/maya/settings` |
| Gap 4: tools can't be looser than the API docs | `__tests__/maya.toolDocs.test.js`; each tool lists the operations it wraps |
| Single emails (part of flow B): Maya writes the brief, Email Creator designs it, saved to Docs, previewed on Maya's work page | `email.create` tool, `GET /maya/emails/:id` |

Tools Maya can use today: `image.obtain`, `social.draftPost`, `social.approvePost`, `email.create`.

### Not done

| Piece | Phase | Note |
|---|---|---|
| Deploy and try it live | 1 | Backend functions, then Maya. No staging exists, so test first on the master tenant with Social autopilot off: nothing publishes without an approval, and jobs can be cancelled or halted with Maya's stop switch. Planning runs on OpenAI; Claude needs Anthropic credits. |
| Staging server for all web products | — | To do. Today only the TODD frontend has staging (todd-staging); Maya and the other web products deploy straight to production. |
| Gap 10: email series on the calendar, and sending | 2 | Emails are designed and saved but not yet sent from a job; the dispatcher, exit rules and calendar display remain. |
| Gap 9: deck images | 2 | |
| Gap 11: post engagement collection (LinkedIn, Bluesky first) | 3 | |
| Gap 12: numeric plan targets and starting benchmarks | 3 | Organization size, the input it needs, is done. |
| Gap 13: learnings and the 6 AM review | 3 | |
| Gap 8: Maya's chat starts jobs instead of routing | 4 | Email part built (2026-10-05): a `send_email` action in the chat starts an `email.create` job and links to it on the work page, which offers Catalyst (many) or the Email Composer (one) through Email Creator's `/email-creator/handoff`. Other requests still route ("This is email-composer work"). |
| Daily duty on jobs | 4 | Her 6 AM planner and social runner still run the old way. |
| Other apps' sign-up wizards ask for organization size | — | Not decided; they default to 2. |

## Principles

1. **Purpose before production.** Maya asks what a request is for only when the answer changes what she would do. Small, clear requests just get done.
2. **The plan is the referee.** When a marketing plan exists, every request is checked against it, and conflicts are explained in terms of consequences, not rules.
3. **She pushes back hard, and the user still decides.** When a request conflicts with the plan, she says so plainly and spells out what it will cost and what she expects to happen. If the user insists, she says "Okay, but this is what it will cost you" (or "this is what I think will happen"), does it, and records the decision. She doesn't nag after that. Users can turn the pushback down, but never off: the ramifications are always stated.
4. **Nothing leaves the building without a person.** Drafts, images and calendar placement are hers to do. Publishing, sending, spending and deleting need approval, except where the user has explicitly turned on autopilot (Social's `socialAutoApprove`).
5. **Reuse what exists.** Social already has cadence-aware scheduling, Maya already has a daily planner, a social runner, an image library, a creation guard and a spend budget. The orchestrator connects them; it does not replace them.
6. **No invented facts.** The rule already enforced by Email Creator and the presentation pipeline applies to everything she produces: no made-up metrics, prices, dates, quotes or URLs. Missing facts become questions or bracketed placeholders.
7. **Know the lane.** Work that isn't marketing goes to the right owner (TODD, Moves) instead of piling onto Maya.

## How a request flows

```
 User request ──► 1. JUDGE ──────────────► 2. PLAN ─────────► 3. RUN ───────────► 4. REVIEW
                  context + plan-fit        job + steps        tools, in order      approvals,
                  ├─ ask "what for?"        cost estimate       stop at approval     results,
                  ├─ push back + why        ▲                   steps                follow-up
                  └─ proceed                │                   │
                         │                  └── user edits ─────┘
                         └── decline / hand off (not marketing)
```

The same pipeline runs whether the user asked or Maya started the work herself (her daily duty). A self-started job skips step 1's questions but still runs the plan-fit check.

## 1. Judgment

### What Maya reads before deciding

| Context | Source |
|---|---|
| Who the business is | `GET /profile`: companyName, companyDescription, valueProp, companyGoal, jobDescriptionForTODD |
| The marketing plan | Active `MarketingPlanRecord`s: `extracted.goals`, `audiences`, `channels`, `campaigns`, `contentThemes`, `kpis`, `timeline` |
| Curated reference material | Knowledge Base entries flagged `mayaReference` (already loaded by `marketing.role.js`) |
| What is already in flight | `GET /momentum/maya-status/daily-actions`, `GET /outreach/social-posts` (planned and scheduled), her `employee-actions` |
| Capacity | `GET /momentum/maya-runs/status` → `queueHealth` (the creation guard: 10 open tasks, 100 drafts, 100 social posts) |
| Cost | Image Creator and Email Creator usage, plus the platform-wide `mayaAiBudget` |
| Channels available | Connected social accounts, mailbox and approved sender |

### When she asks "what are you trying to accomplish?"

She asks when at least one is true:

- The request is large: more than one deliverable, more than a week of content, or any send to a list.
- The goal is ambiguous and the output would differ by goal. "An email about the webinar" could be an invitation, a reminder or a follow-up.
- There is no active plan, and the request is a campaign rather than a single asset.

She does not ask for single assets with an obvious purpose ("make an image for this post", "shorten this email").

She asks one question at a time and offers likely answers, the same pattern the presentation pipeline uses (`NEEDS_INFORMATION`).

### Plan-fit check

A single model call with a fixed output contract:

```json
{
  "verdict": "fits | adjacent | conflicts | no_plan",
  "planReference": "Q4 goal 2: 40 qualified demos from mid-market ops leaders",
  "reasoning": "One or two sentences.",
  "ramifications": [
    {"kind": "focus", "detail": "Three weeks of LinkedIn slots move from the launch theme to this topic."},
    {"kind": "capacity", "detail": "Adds 24 drafts; 61 are already waiting for review."},
    {"kind": "cost", "detail": "Uses 24 images; your daily image allowance is 5."},
    {"kind": "audience", "detail": "The plan targets ops leaders; this topic speaks to developers."}
  ],
  "recommendation": "Do it as two posts inside the launch theme instead of a separate series.",
  "proceedOptions": ["as_asked", "recommended", "cancel"]
}
```

Ramification kinds are fixed so the UI can render them consistently: `focus`, `capacity`, `cost`, `timing`, `audience`, `channel`, `brand`.

The **capacity** and **cost** entries are computed, not guessed. They come from `queueHealth`, the allowance endpoints and the job's estimate (see below). The model only words them.

What she says, by verdict:

- **fits:** proceeds. She mentions the plan link in one line ("This supports the Q4 demo goal").
- **adjacent:** proceeds with her recommendation as the default and offers "as asked" as the alternative.
- **conflicts:** stops and presents the ramifications and the three options. The user's choice is stored on the job as a decision (`decision: {choice, decidedBy, decidedAt, verdict, acknowledgedRamifications}`) and shown in her status report.
- **no_plan:** proceeds for single assets. For campaigns she offers to draft a plan first (`/marketing-employee/extract-plan` already turns text into a plan).

### Pushback level

A per-tenant setting, `maya.pushbackLevel`, stored with her other settings in the momentum operator config (`operatorConfig.maya`, next to `socialAutoApprove`). It changes how hard she argues, never whether she states the consequences.

| Level | Default | On a conflict | On "adjacent" |
|---|---|---|---|
| `firm` | Yes | Stops the job. Makes her case: what the plan says, every ramification, her recommendation. Asks the user to choose. If they insist, she restates the cost in one line ("Okay. This will use all five of today's images and push the launch posts to next week") and proceeds. | Proceeds as asked and shows her recommendation. (Replanning adjacent requests her way by default was dropped: it would cost a second planning call on most requests.) |
| `standard` | | Stops the job, but gives the ramifications in a short list without arguing the case. | Proceeds as asked and mentions her recommendation. |
| `light` | | Doesn't stop. Proceeds as asked and puts the ramifications at the top of her reply and on the job. | Proceeds as asked. |

At every level:

- The ramifications are computed and shown. Capacity and cost come from real data, not the model.
- The decision is recorded on the job, with the ramifications the user saw.
- Her status report lists the decisions made against her advice, and later what actually happened.

When a recorded decision's outcome is measurable (for example, posting cadence or engagement on a theme), her status report closes the loop: "In October you chose the developer series over the launch theme. Here's how both did." That is how the pushback stays honest instead of turning into nagging.

### What she declines or hands off

| Request | What Maya does |
|---|---|
| Sales follow-up with a specific deal or person | Hands to Outreach/Signal Engine (Needs You, momentum threads) and says so |
| Tasks unrelated to marketing | Creates nothing; suggests TODD or Moves |
| Research questions | Uses Find as an input to her own work. Pure research requests go to Find. |
| Changing settings, mailboxes, billing, connected accounts | Never. Tagged `never` in the API. She explains where the user does it. |
| Deleting the user's content | Approval only |

## 2. Orchestration

### The job

A job is the unit of work. Stored at `tenants/{tenantId}/maya-jobs/{jobId}`:

```ts
interface MayaJob {
  id: string;
  origin: 'user_request' | 'daily_duty';
  request: string;                 // what the user said, verbatim
  brief: {                         // what Maya understood
    goal: string;
    audience: string;
    deliverables: string[];
    constraints: string[];
  };
  planFit: PlanFitResult | null;   // the contract above
  decision: { choice: string; decidedBy: string; decidedAt: string } | null;
  estimate: { images: number; emails: number; socialPosts: number; aiUsd: number };
  steps: MayaJobStep[];
  status: 'queued' | 'running' | 'awaiting_user' | 'awaiting_approval' | 'waiting' | 'done' | 'failed' | 'stopped' | 'cancelled';
  artifacts: { kind: 'image' | 'social_post' | 'email' | 'deck' | 'document'; id: string; url?: string }[];
  createdAt: string;
  updatedAt: string;
}

interface MayaJobStep {
  id: string;
  tool: string;                    // e.g. 'image.obtain', 'social.draftPost'
  input: Record<string, unknown>;
  dependsOn: string[];
  access: 'direct' | 'approval';   // copied from the tool's x-maya tag
  status: 'pending' | 'running' | 'awaiting_approval' | 'done' | 'skipped' | 'failed';
  output?: Record<string, unknown>;
  error?: string;
}
```

`maya-runs` keeps recording her scheduled duty runs. A run that does real work now points at the job it created.

### The runner

The runner is a backend loop in todd-backend. It is not frontend routing.

1. **Planning call.** A tool-calling model gets the brief, plan-fit result, context and the tool registry, and returns the step list. Steps are validated against the registry before saving. Unknown tools, `never` tools and over-budget plans are rejected.
2. **Execution.** Steps run in dependency order. `direct` steps run immediately. `approval` steps move the job to `awaiting_approval` and appear in the user's approval list. Independent steps (for example, 12 images) run in parallel, up to a small limit.
3. **Recovery.** A failed step is retried once if the error is transient (`upstream_error`, timeout). Moderation blocks (`422 moderation_blocked`) and allowance limits (`429`) are not retried. Maya rewrites the prompt once for moderation, or asks the user.
4. **Stop.** `POST /momentum/maya-batches/stop` already stops her duty runs at a safe checkpoint. The runner checks the same stop flag between steps.

Planning calls (the step plan and the plan-fit check) go through `generatePlanningJson()` in `todd-backend/functions/aiProvider.service.js`. A platform-wide switch picks the provider: OpenAI by default (`gpt-5`), or Claude (`claude-opus-5-5`). The master administrator flips it on the Maya tab of the Admin Control Panel (**built**, `GET/PUT /admin/ai-provider`), so both can be compared on real work without code changes. Everything else in the backend stays on OpenAI.

### Calling tools in-process

The runner calls service functions directly with the job's `tenantId` and `uid`, the way `mayaSocialRunner.service.js` already calls the social service. It does not call its own HTTP API. This avoids the auth mismatch: Image Creator, Email Creator and Catalyst routes require the user's Firebase ID token, which a background job doesn't have.

The HTTP docs remain the contract: each tool wraps exactly one documented operation, with the same inputs, outputs and limits.

### The tool registry

Generated from the `x-maya` tags so the docs and Maya can't drift apart. `direct` and `approval` operations become tools. `internal` and `never` operations are excluded.

| Tool | Wraps | Access |
|---|---|---|
| `image.obtain` (built) | Reuses a fitting library image; otherwise `imageCreator.service.generateImage` then `imageLibrary.service.saveImageToLibrary`. Merged into one tool so a plan never has to branch on whether the library had something. | direct |
| `email.generate` | `emailCreator.service.generateEmail` (`/email-creator/generate`) | direct |
| `email.hostImage` | `/email-creator/host-image` (30-day URLs, for imminent sends only) | direct |
| `social.generateDrafts` | `/outreach/social-posts/generate` with `autoApprove: false` | direct |
| `social.draftPost` (built) | `social.service.generateDrafts` + `upsertSocialPost` with `status: draft`, `plannedForDate`, the image, `planId` - the same calls Maya's daily social duty makes | direct |
| `social.approvePost` (built) | `upsertSocialPost` with `status: approved` (Social picks the time from the cadence); auto-approved when `socialAutoApprove` is on | approval |
| `social.publishNow` | `/outreach/social-posts/{id}/publish` | approval |
| `series.create` / `series.saveStep` | **new**, email series on the calendar (section 4) | direct |
| `series.approve` | **new**, locks the series content for sending | approval |
| `catalyst.queue` / `catalyst.draft` | `/mobile/outreach/catalyst/queue`, `/draft` (in-process) | direct |
| `catalyst.send` | `/mobile/outreach/catalyst/send` | approval |
| `deck.turn` | `/marketing-director/presentation` | direct |
| `doc.save` | `/docs` create | direct |
| `find.search` | Find search | direct |
| `plan.extract` | `/marketing-employee/extract-plan` | direct |
| `action.track` | `/marketing-employee/execute-action` (create/update only; `approve` comes from a person) | direct |

### Estimates and allowances

Before running, the runner totals the plan: images, emails, social posts and expected model usage. The estimate feeds the plan-fit **cost** and **capacity** ramifications. It is also checked against three limits:

- **The creation guard** (`mayaCreationGuard.service.js`): open drafts and social posts. A 30-post calendar fits under the 100-post limit, but not on top of 80 waiting posts.
- **The platform budget** (`mayaAiBudget.service.js`, `TODD_DAILY_AI_BUDGET_USD`).
- **The tenant's creative allowance:** 5 images a day per tenant, as today, with Maya's work counting against it. It's set per tenant, so a tenant's limit can be raised without changing anyone else's. (Counted per workspace in `imageCreatorUsage/{tenantId}`.)

Because 5 images a day won't cover a month of posts in one sitting, the plan does two things:

- It reuses library images first.
- It spreads new image generation across days. Image steps carry a `notBefore` date, and the runner picks them up as allowance frees up. A post whose image isn't ready yet stays a draft with no image, and is never approved without one.

She says this up front as a cost ramification ("12 posts need new images; at 5 a day they'll be ready by Thursday").

If the estimate doesn't fit, she says so during judgment and offers a smaller version ("I can do the first two weeks today and the rest tomorrow").

## 3. The flows

### A. "Create me a social media calendar"

Every piece exists except saving images to the library.

1. **Judge.** Read the plan's `contentThemes`, `channels` and `timeline`, the connected accounts and per-platform cadence (`getPlatformCadenceSettings`). Ask only what's missing: period, platforms, and whether every post needs an image.
2. **Plan.** For each platform, compute the slots the cadence allows over the period. Reuse the logic in `resolvePlannedForDate`, which already fills days up to `cadenceMaxPerDay` and skips full days. Assign a theme to each slot from the plan.
3. **Run:**
   - `social.generateDrafts` per platform and theme, with `strategyContext.cadence`, `planId` and `autoApprove: false`.
   - For posts that need images: `image.obtain`, which prefers an unused `eligibleForSocial` library image (the same rotation `selectImageForPlatform` uses) and otherwise generates one and saves it to the library.
   - `social.draftPost` with `plannedForDate`, the image (permanent library URL) and `planId`.
4. **Review.** Posts appear on the existing Social calendar as drafts on their planned days. Approving a post (`social.approve`) lets the backend pick the exact time from the cadence. With Social autopilot on (`socialAutoApprove: true`), Maya's daily duty approves them as it does today.

### B. "Create me an email about this topic"

1. **Judge.** Ask what the email is for only if unclear: invite, announcement, newsletter, follow-up. Ask who receives it, since that decides whether this is a one-off or a list send. Check the plan for audience fit.
2. **Plan.** Maya writes the copy brief herself, using the plan, profile and facts the user gave. Email Creator's chat step exists to get a brief from a person; Maya already has one, so she skips it.
3. **Run:**
   - `image.obtain` for each image the brief calls for (header, product), reusing library images when they fit.
   - `email.generate` with `brief` and `images` (ids referenced as `src="todd-image:<id>"`).
   - Resolve placeholders: hosted library URLs for durable use; `email.hostImage` only for a send happening within 30 days.
   - Return `notes` (bracketed facts the user must fill) as questions, not as a finished email.
4. **Hand-off.** Built as `email.create`: Maya writes the brief, Email Creator designs the HTML with the sender's real details and `{{token}}` placeholders, library images replace the image placeholders, and the email is saved to Docs (type `email`). Maya's work page previews it, lists anything still to fill in, and offers the HTML download. Sending is the next step: the finished email goes into the approval list as a draft. A one-off send to a list is a single-step email series on the calendar (section 4), so it uses the same approval and sending path as a longer series. Maya never sends on her own.

### C. "I need a PowerPoint"

1. **Judge and plan.** `deck.turn` already does fact extraction, strategy and a critic pass, and returns `NEEDS_INFORMATION` until it can build a credible story. Maya relays those questions.
2. **Images.** When the deck is `READY_TO_GENERATE`, find slides whose `visualIntent` calls for an image (`imageStatement`, `hero`, `product`). Get each with `image.obtain`, guided by `visualIntent` and the deck theme. Put the permanent URL in `slides[].image`.
3. **Render.** The existing PDF renderer (`maya-deck-pdf.service.ts`) produces the file. A `.pptx` export is a separate item; today's output is PDF.
4. **Rule kept.** Generated images illustrate; they never stand in for evidence. Charts and metrics still come only from supplied data.

### D. Maya's own duty

Her daily planner (`scheduledMarketingEmployeePlanner.js`) already creates a `social_post` planning task each day. The social runner only drafts when that task exists and isn't paused, which is the "she should be driving this" rule.

The change: the planner creates a job instead of a bare task, using the same pipeline. Self-started jobs skip the questions but still run plan-fit, estimates and approvals. Her end-of-day summary (`/outreach/maya-day`) lists jobs finished and waiting.

## 4. Email series on the calendar

Campaigns didn't work and were removed. This brings back the useful part, a story told across several emails where each builds on the last, by putting emails on the same calendar as social posts. A dispatcher sends whatever is due each day.

### The model

An **email series** is an ordered set of emails to one audience, each scheduled on the calendar:

```ts
interface EmailSeries {
  id: string;
  title: string;
  goal: string;                  // the story the series tells, from the brief
  planId: string | null;
  audience: { kind: 'list' | 'segment' | 'contacts'; ref: string; size: number };
  status: 'draft' | 'approved' | 'sending' | 'paused' | 'done' | 'cancelled';
  approval: { approvedBy: string; approvedAt: string; contentHash: string } | null;
  exitRules: { onReply: true; onUnsubscribe: true; onBounce: true };
  steps: EmailSeriesStep[];
}

interface EmailSeriesStep {
  id: string;
  order: number;                 // 1, 2, 3...
  plannedForDate: string;        // YYYY-MM-DD, shown on the calendar
  sendAfterDays: number | null;  // or: N days after the previous step actually sent
  subject: string;
  preheader: string;
  html: string;                  // from Email Creator
  buildsOn: string;              // one line: what this email picks up from the last one
  status: 'draft' | 'approved' | 'sent' | 'skipped';
  sentAt: string | null;
}
```

Stored at `tenants/{tenantId}/email-series/{seriesId}`, with steps as a subcollection.

### How Maya builds one

Flow B with more than one email:

1. **Maya chooses the audience.** She matches the plan's `audiences` against the tenant's contacts (Network relationships and stages, Outreach contacts, Lead Vault records already activated) and proposes a named audience with its size and why it fits ("214 ops leaders in Network marked warm or customer"). The user sees it as part of the series approval. The system limits her choice to contacts it may legally and safely email: they have an address, aren't unsubscribed or bounced, and meet the tenant's consent rules. Cold Lead Vault contacts carry a deliverability ramification she states.
2. The brief names the story arc ("problem, proof, offer, last call").
3. Plan-fit runs on the series as a whole. Audience size and send volume feed the capacity ramification.
4. Each step is generated with the previous steps' copy in the brief, so the emails read as one story rather than as copies of each other.
5. Steps are placed on the calendar with spacing, avoiding days already crowded with posts or other sends.

### Approval

The whole series is approved once, from Maya's approval list. Approval stores a hash of every step's content. Editing a step after approval clears that step's approval (the same rule sequence steps use today: changing `draftSubject`, `draftBody` or `draftText` clears approval). The dispatcher won't send a step whose content doesn't match the approved hash.

### The calendar

The Social calendar becomes the marketing calendar. It already shows posts by `plannedForDate`; it also shows series steps, styled differently, from the same date field. Users can drag a step to another day, which updates `plannedForDate` and leaves approval intact, since the content didn't change.

### The dispatcher

One scheduled function, `scheduledMarketingCalendar`, runs hourly. For each tenant it finds what's due today:

- **Social posts:** unchanged. Approved posts with a `scheduledFor` time are already published by `scheduledSocial.js`. The dispatcher only reports on them.
- **Email series steps:** approved, `plannedForDate` is today or earlier, the previous step has sent, and the series isn't paused. Each due step is sent to the audience through the existing `/send-email` handler, which already does pacing, the compliance footer, sender approval and warm-up.

Exit rules come from data that already exists:

- A recipient who replies leaves the series and appears in Needs You (`/mobile/outreach/needs-you`, momentum threads).
- Unsubscribes and bounces leave automatically.

Each send is recorded on the step and in Maya's day summary (`/outreach/maya-day`).

### Why this should work where campaigns didn't

- **Smaller surface.** No separate campaign builder, audience resolver or launch flow. A series is a list of dated emails.
- **One place to look.** Everything that will go out shows on one calendar.
- **Proven sending.** The send path, reply detection and Needs You are already in production use. The series only decides what is due.

## 5. The daily learning loop

At 6 AM (her existing planner, `scheduledMarketingEmployeePlanner.js`), Maya reviews yesterday against her plan's targets, decides what to change, and plans today. This replaces the current daily review, where most KPIs come back "Not yet verified" because she reads no real results.

### What she measures

| Signal | Source | Available today? |
|---|---|---|
| Emails sent, opened, clicked | `computeMomentumMetricsForDateKey` (SendGrid events) | Yes |
| Replies and booked conversations | Momentum threads, `activity` (category `replies`) | Yes |
| Posts published, by platform and theme | `outreach-social-posts` (status, `publishedTimestamp`, `planId`, `strategyContext`) | Yes |
| Post engagement: likes, comments, views | `postPerformance` on each post | **No.** The field exists but is only filled in by hand; the platform adapters don't fetch metrics. |
| Work that didn't happen | `maya-runs`, creation guard, drafts expired unapproved, approvals waiting | Yes |
| Survey feedback | Pulse responses (already feeds `proposeMarketingPlanAdjustment`) | Yes |

### Targets

The plan's `extracted.kpis` are free text today ("Email click-through rate"). The loop needs numbers to say a KPI is "off". Each plan gets a `targets` list, which Maya proposes when the plan is created and revises over time:

```ts
interface PlanTarget {
  kpi: 'emails_sent' | 'email_open_rate' | 'email_click_rate' | 'replies' | 'posts_published' | 'post_engagement_rate' | string;
  period: 'day' | 'week';
  target: number;
  channel?: string;           // e.g. linkedin
}
```

### Where the first numbers come from

Maya sets the starting targets herself, with no approval step. When a plan is created, or the first time the loop runs for a tenant without targets, she makes one planning call through `generatePlanningJson()`, on whichever provider the admin switch selects. She asks for best-practice benchmarks that fit:

- **Organization size:** `company.numberOfEmployees` on the user's contact record. It's a required question in Maya's sign-up wizard and editable on her profile page and through `/profile`. Anyone who never answered counts as **2** (`employeeCount.js`). The default is applied when the value is read, so a later real answer still lands.
- **Industry and audience:** from `companyDescription`, `valueProp` and the plan's `audiences`. There's no industry field; she infers it and records what she assumed.
- **Channels the tenant actually uses:** connected social accounts, mailbox and sender, and list sizes.

The result is saved as the tenant's reference benchmarks, part of Maya's memory for that client, at `tenants/{tenantId}/maya-memory/benchmarks`:

```ts
interface MayaBenchmarks {
  assumptions: { employees: string; industry: string; audience: string };
  targets: PlanTarget[];         // e.g. posts_published 3/week on LinkedIn, email_open_rate 0.30
  rationale: string;             // why these numbers fit this organization
  source: { provider: 'openai' | 'anthropic'; model: string; generatedAt: string };
  kind: 'starting_benchmark';
}
```

Her plan's `targets` are copied from it, and the user can edit any target from the plan board. Two cautions are built in:

- **These are starting points, not facts.** Model knowledge of industry benchmarks is approximate and can be dated. Every target shows where it came from ("Starting benchmark for a 10-person B2B services firm").
- **The tenant's own numbers replace them.** After four weeks of real data, the morning review compares each target with the tenant's actual baseline. She raises or lowers targets to "baseline plus a stretch" and logs each change and its reason in `maya-learnings`. The original benchmark stays in memory for reference.

Because the provider is recorded, switching the admin toggle and regenerating benchmarks gives a direct OpenAI-versus-Claude comparison on the same tenant.

### Two kinds of miss, handled differently

**Execution misses** are things that should have happened and didn't: no emails went out, posts weren't published, drafts expired waiting for approval. These are facts, not opinions, so she acts the same morning:

- She finds the cause. Was it a blocker (no approved sender, autopilot off and nothing approved, creation guard full, allowance used up), or did she simply fall short?
- She fixes what she can and reports what she can't ("Nothing went out because 40 drafts are waiting for you").
- She catches up within the limits. Instead of doubling, she spreads the shortfall over the next few days, under the auto-send cap, the warm-up schedule and the posting cadence. Doubling sends in one day is how sender reputation gets damaged, and that costs more than one missed day.

**Effectiveness misses** are things that happened but didn't work: low opens, no clicks, no engagement. One day is usually too little data to tell; a post with no likes by 6 AM may just be a slow day. So:

- She judges effectiveness over a rolling window (7 days by default) against the tenant's own baseline, not a single day.
- She changes one thing at a time (topic, format, posting time, subject-line style, image style) and records it as an experiment: what she changed, why, and what she expects.
- When the window closes, she compares and keeps or reverts the change. The model's marketing knowledge suggests what to try; the tenant's own results decide what stays.
- Experiments and outcomes are stored as `tenants/{tenantId}/maya-learnings`. She reads them every morning, so she doesn't retry what already failed for this tenant.

### What she changes herself, and what she asks about

- **Changes herself and logs:** tactics inside the plan. That means themes, formats, timing, platform mix, subject-line approach, which audience segment gets the next series, and catch-up pacing. Each change appears in her morning summary with the reason.
- **Proposes and waits for approval:** changes to the plan itself, meaning goals, target numbers, audiences, budget or timeline. These go into the approval list with her evidence ("Two weeks of developer posts beat the ops posts 3 to 1. I recommend making developers a primary audience"). This extends the field-level plan update `proposeMarketingPlanAdjustment` already applies after survey responses, so performance becomes a second trigger next to surveys.

Work Maya starts herself always gets her full judgment: she checks it against the plan and the learnings before doing it, regardless of the tenant's pushback setting. The pushback setting only governs how she argues with the user.

### Gaps this adds

- **Post engagement collection:** fetch likes, comments, views and reposts from each platform's API into `postPerformance` on a schedule, starting with LinkedIn and Bluesky. Until then, social effectiveness can only be judged on posts the user rates by hand, and she says so rather than guessing.
- **Numeric targets** on plans, seeded from Maya's starting benchmarks.
- **Learnings store** and the rolling-window comparison.

## 6. Autonomy

| Maya does freely | Maya prepares, a person approves | Maya never does |
|---|---|---|
| Draft posts, emails, decks, documents | Approve or schedule a social post (unless Social autopilot is on) | Change settings, mailboxes, connected accounts, billing |
| Generate images and save them to the library | Publish a post now | Send to a list on her own |
| Place drafts and series steps on the calendar (`plannedForDate`) | Send any email (Catalyst, momentum drafts, email series) | Delete account data |
| Research with Find | Delete posts or documents | Invent facts, metrics, quotes |
| Create and update her tracked actions | Spend beyond her allowance | Approve her own actions |
| Send a test email to the user | Change the marketing plan | Work outside marketing |

Every row maps to `x-maya` tags in the API docs. Changing what she's allowed to do means changing a tag, which updates the registry.

## 7. Gaps to build

In the order the flows need them:

0. ~~**Planning provider switch.**~~ Built: `aiProvider.service.js`, `GET/PUT /admin/ai-provider`, and the Planning Model control on the Admin Control Panel's Maya tab. OpenAI by default.
1. ~~**Save images to the library.**~~ Built: `imageLibrary.service.js` (`saveImageToLibrary`, used in-process by the runner) and `POST /image-creator/save-to-library`. Files go to `{tenantId}/documents/maya/` with a permanent URL; the Docs record is `eligibleForSocial` by default and counts against the plan's document limit.
2. ~~**Tenant allowance.**~~ Built: Image Creator and Email Creator counters are per workspace (`imageCreatorUsage/{tenantId}`, `emailCreatorUsage/{tenantId}`), defaults 5 images and 10 emails a day, with optional tenant overrides `imageCreatorDailyLimit`, `emailCreatorDailyLimit` and `emailCreatorHostedImageDailyLimit` (`tenantAllowance.js`). Spreading image steps across days with `notBefore` belongs to the job runner (gap 3).
3. ~~**Job store and runner.**~~ Built in `todd-backend/functions/maya/`: `jobs.store.js` (jobs at `tenants/{tenantId}/maya-jobs`, a lease so one runner works a job, and `approvals`/`cancelRequested` fields only people write), `planner.js` (one planning call through the provider switch, validated before saving), `context.js`, `runner.js`, `tools.js`, and `jobs.routes.js` (`/maya/jobs`). The `mayaJobRunner` Firestore trigger runs a job whenever it's written as `queued`; `scheduledMayaJobs` (every 10 minutes) resumes `waiting` jobs and recovers expired leases. Phase 1 tools: `image.obtain` (reuse a library image, else generate and save), `social.draftPost`, `social.approvePost` (approval; autopilot honored). Starting a job requires the TODD Suite, the Maya app, or the master tenant.
4. ~~**Tool/doc consistency.**~~ Built (replacing the original generator idea, agreed 2026-10-02): each tool lists the documented operations it wraps, and `__tests__/maya.toolDocs.test.js` fails if a tool is looser than their `x-maya` tags, wraps an `internal`/`never` operation, or wraps something undocumented. A tool may be stricter (`social.approvePost` needs approval though the PUT it uses is `direct`).
5. ~~**Plan-fit evaluator.**~~ Built: `maya/planFit.js`. After planning and before any step runs, one call through the provider switch judges fit and the strategic ramifications; capacity and cost are computed from the real allowances and review queue. A conflict stops the job (`awaiting_decision`) at firm and standard; the user picks Maya's way (she replans with her rewritten request), as asked (she states what it costs, recorded on the job) or cancel. A failed check is recorded and the job proceeds. Adjacent requests proceed as asked with her recommendation shown.
6. ~~**Approvals in Maya.**~~ Built: the **Maya's work** page (`/work`, linked from the menu). A box to give Maya a job; one "Waiting for you" list across all jobs showing each post's text, image, account and planned day, where Approve schedules the post and "Not this one" skips it; questions Maya needs answered; and every job's steps, status and progress (refreshing every 5 seconds while she works). Email series and Catalyst sends join the same list in Phase 2.
7. ~~**Pushback setting.**~~ Built: `operatorConfig.maya.pushbackLevel` (`firm` default, `standard`, `light`), `GET/PUT /maya/settings`, and a control on Maya's work page. Decision outcomes in her status report come with the learning loop (gap 13).
8. **Replace routing with jobs.** `MarketingDirectorCapabilitiesService` route guides become job intents. "Write an email" starts flow B instead of sending the user to Compose Email. Pure navigation ("open the email queue") can stay.
9. **Deck images.** Wire library URLs into `slides[].image` in the presentation pipeline.
10. **Email series and the dispatcher.** The `email-series` model, series tools, calendar display of steps, and `scheduledMarketingCalendar` sending through `/send-email` with exit rules.
11. **Post engagement collection.** Scheduled fetch of likes, comments, views and reposts into `postPerformance`, LinkedIn and Bluesky first.
12. **Numeric plan targets and starting benchmarks.** `targets` on marketing plans, set by Maya from best-practice benchmarks for the organization's size and industry (saved to `maya-memory/benchmarks`), editable by the user, recalibrated to the tenant's baseline after four weeks. Organization size is done: required in Maya's sign-up wizard, editable through `/profile`, default 2.
13. **Learnings and the morning review.** `maya-learnings`, rolling-window comparison, execution-miss catch-up within caps, and performance-triggered plan proposals.

## 8. Phasing

**Phase 1: Social calendar end to end.** Gaps 1 to 7, with the approval list in Maya from the start. *Built; not yet deployed.* It's the most-requested flow, it exercises every layer, and the Social side (drafts, `plannedForDate`, cadence slots, autopilot) already exists.

**Phase 2: Email series and decks.** Flow B as email series on the calendar with the dispatcher (gap 10), flow C with deck images (gap 9). *Single emails (`email.create`) are built; series, sending and decks are not.*

**Phase 3: The learning loop.** *Not started.* Engagement collection (gap 11), numeric targets (gap 12) and the learnings store with the morning review (gap 13).

**Phase 4: Duty on jobs.** *Not started.* Move her daily planner and social runner onto jobs, and replace the routing service (gap 8).

## 9. Decisions (2026-10-01)

| Question | Decision |
|---|---|
| Model for the planning loop | OpenAI for now. A master-admin switch (built) flips planning between OpenAI and Claude for comparison. |
| Maya's allowance | Per tenant, as today: 5 images a day. Maya's work counts against it. |
| Pushback | Hard by default. Users can turn it down (`firm`, `standard`, `light`) but ramifications are always stated, and if a user insists she says what it will cost and proceeds. |
| Approvals | One list inside Maya, and approving there performs the action. |
| Campaigns | Replaced by email series on the marketing calendar, sent by a daily dispatcher. |
| Series approval | The whole series at once. |
| Series audience | Maya chooses it from the plan and the tenant's contacts; the user sees it in the series approval. The system limits her to contacts that can legally and safely be emailed. |
| Plan requirement | Maya's call. Plan-fit decides whether work is in the plan, adjacent or outside it, and she explains the ramifications. No hard rule. |
| Self-started work | Always full judgment. She also reviews results every morning and adjusts tactics herself; plan-level changes go to the approval list. |
| Engagement data | LinkedIn and Bluesky first. |
| Organization size | Required in the sign-up wizard; 2 when never answered. |
| Target numbers | Maya sets them from best-practice benchmarks for the organization's size and industry, via whichever provider the admin switch selects. She saves them to her memory for that client and applies them without approval. The user can edit them, and she recalibrates to real results after four weeks. |

## 10. Open questions

None at the moment. New questions will come up during Phase 1.
