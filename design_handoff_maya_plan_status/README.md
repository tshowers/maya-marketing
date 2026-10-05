# Handoff: Maya Plan and Status redesign

Repo: `tshowers/maya-marketing` (Angular). Routes: `/marketing-employee` (Status) and `/marketing-employee/plan` (Plan).

## Kickoff prompt for a new Claude Code session
> Implement the Maya Plan and Status redesign described in `design_handoff_maya_plan_status/README.md` in this repo. Open `Maya Plan and Status.dc.html` in a browser as the visual reference. Reuse existing services (`employee-plan.service.ts`, `marketing-employee.service.ts`, `maya-jobs.service.ts`) and models (`EmployeeActionRecord`, `MarketingPlanRecord`, `Task`). Start by adding the plan-step link on actions, then build Plan (List + Timeline), then Status (Columns + Today's run). Keep the existing header (Status / Plan / Menu). Add Cypress `data-cy` hooks matching the names in this README.

## Overview
The current Plan and Status pages list facts without showing progress. The redesign turns:
- **Plan** into a sequence of steps that get checked off, with where you are, what is stuck, and what Maya needs from the user.
- **Status** into what Maya has done, is doing, and will do next, with one clear ask when she is blocked.

Each page has a **view toggle**:
- Plan: **List** | **Timeline**
- Status: **Done, doing, next** | **Today's run**

## About the design files
`Maya Plan and Status.dc.html` is an **HTML design reference**, not production code. Open it in a browser (keep `support.js` and `assets/` beside it). Recreate it in the Angular app with its existing patterns. The data in the mock is illustrative.

## Fidelity
High fidelity. Match colours, type, radii and spacing below. Desktop frame is 1280px wide. Mobile is not designed yet: stack columns into one at < 900px.

## Required data change (do this first)
The current Plan page says "No linked execution evidence yet", because actions are not tied to plan steps. Both pages depend on that link.
- Add `planStepId?: string` (and optional `planStepIndex?: number`) to `EmployeeActionRecord` / `MarketingEmployeeActionRecord`, set when Maya creates an action from a plan.
- Add `steps: { id, title, summary, plannedStart?, plannedEnd?, status: 'done'|'doing'|'todo', completedAt? }[]` to the plan record (derive from `extracted` / outline on ingestion; Maya fills in proposed dates).
- Add `datesConfirmed: boolean` on the plan (false = Maya's proposal).
- Step status derivation: `done` when all linked actions are `completed`; `doing` when any linked action is in progress; otherwise `todo`. A step is **stuck** when any linked action has `blocked === true`.
- "What I need from you" = actions with `blocked === true` (text from the latest Maya entry in `notesLog`) + the review backlog (pending approvals count) + `datesConfirmed === false`.

## Shared header (unchanged layout)
Padding 20px 40px. Avatar 36px circle, then "Maya" 20px/700 + "Marketing advice" 20px/500 muted. Right: pill links 42px tall, padding 0 16px, radius 999px, 15px/600, 18px icon + 6px gap. Active page pill = `--t-green` bg / `--t-green-fg` text, weight 700. Inactive = `--surface`. Menu = `--text` bg / `--bg` text.

## View toggle
Directly under the header, right-aligned, padding 4px 40px 0. Track: `--surface`, radius 999, padding 4px, gap 4px. Buttons 36px tall, padding 0 16px, 14px/700, no border. Active: `--bg` bg, `--text`, shadow `0 1px 3px rgba(15,17,21,.12)`. Inactive: transparent, `--muted`. Remember the last view per page in localStorage (`maya.planView`, `maya.statusView`). `data-cy="plan-view-list|plan-view-timeline|status-view-cols|status-view-timeline"`.

## Screen: Plan · List
Body padding 24px 40px 56px; grid `1fr 340px`, gap 48px.

**Left column (gap 32px)**
1. Kicker "MARKETING PLAN" (12px/700, .08em, uppercase, muted) + health pill (26px, radius 999, 13px/700, alert icon 14px). States: `Stuck · needs you` (pink), `Behind` (yellow), `On track` (green).
2. Title, plan name: 38px/700, letter-spacing -0.03em, line-height 1.05.
3. Maya summary: 32px avatar + 17px/1.55 sentence (generated: current step, what's stuck, what she needs, when the step can finish).
4. Step progress: 6-segment bar (equal grid, gap 6, height 10, radius 999). Done = `--green`, doing = `--blue`, stuck = `--pink`, todo = `--surface2`. Below: "3 of 6 steps done" left, "Timeline not set" right (13px muted).
5. **What I need from you** (20px/700) + pink count badge (24px, `--pink` bg, white 13px/700). Cards: `--surface`, radius 20, padding 18px 20px, gap 16. 40px pink icon circle, title 16px/700, detail 14px/1.5 muted, primary button (`--text` bg, 40px, radius 999, 14px/700) + optional secondary (`--bg`). `data-cy="plan-need"`.
6. **The plan, step by step**: vertical stepper. Rail column 40px: dot 40px (done = green + check; doing = blue + spinning loader + 5px `--t-blue` ring; stuck = pink + "!"; todo = `--bg` with inset 2px `--surface2` ring + step number). Connector 3px wide, green below done steps, else `--surface2`. Content: title 17px/700, status tag (24px pill, 12px/700, tinted), "YOU ARE HERE" label (12px/700, `--t-blue-fg`) on the current step, summary 14px muted, bottom padding 28px.
   - The current step expands to show its actions in a `--surface` panel (radius 18, padding 8). Rows are `--bg`, radius 12, padding 10px 12px, 26px status dot. Done titles are struck through and muted. Stuck rows get a pink "Pick contact" button (34px). `data-cy="plan-step"`, `plan-action`.

**Right column (gap 16)**: Goals card and "Who does what" card (`--surface`, radius 24, padding 22). Goal title 15px/700 + "Steps 4 and 5" 13px muted. Owners: Maya / TODD / You with one-line duties (from the plan's Execution Ownership text). Link "Read the written plan" opens the raw plan text (current Summary content).

## Screen: Plan · Timeline
Body: column, gap 28px, padding 24px 40px 56px.
1. Header row: kicker + title + Maya sentence (max 720px) on the left. On the right, two stats, right-aligned: "Steps done / 3 of 6" and "Against plan / +1 week" (label 13px muted, value 28px/700; late value in `--t-pink-fg`).
2. If `datesConfirmed === false`: yellow banner (`--t-yellow` / `--t-yellow-fg`, radius 18, padding 12px 12px 12px 18px), calendar icon, text "Your plan's timeline says "To be determined", so these dates are my proposal. Keep them and I'll hold myself to them." Buttons "Keep these dates" (primary) and "Edit dates".
3. Gantt card (`--surface`, radius 24, padding 20px 24px 24px). Grid `240px 1fr`. Week header: 8 weekly columns (13px muted). Rows 56px: label (15px/700 "4. Lead generation" + 13px sub, pink when late). Track has weekly gridlines (`--surface2`, 1px).
   - Planned span: dashed 2px `--muted` outline, 32px tall, radius 999 (55% opacity when actual exists).
   - Actual span: solid 24px bar (done green, doing blue) with white 12px/700 label (e.g. "2 of 6").
   - Overrun/forecast: pink diagonal stripes continuing from the actual bar.
   - Today: 2px `--text` vertical line across rows.
   - Legend: Planned, Done, In progress, Running late, Today.
4. Two columns (`1.3fr 1fr`, gap 24): "Lead generation this week" (current step's actions, same rows as List) and "What I need from you" (pink cards, `--t-pink` bg, primary button).

## Screen: Status · Done, doing, next
Body: column, gap 28px.
1. Kicker "STATUS · MONDAY, OCTOBER 5". Headline (38px/700) is generated from state, e.g. "I'm paused until you review." Then the Maya sentence.
2. Blocker banner (only when Maya has stopped): `--t-pink`, radius 20, pause icon 22px. Title "New work is on hold" 16px/700, detail 14px ("Anything left unreviewed for 14 days expires. The oldest task expires Thursday."). Buttons "Review 56 tasks" (primary) and "Open drafts". Replaces the old red alert. `data-cy="status-blocker"`.
3. Three columns (equal, gap 20): **Done** (green dot), **Doing now** (blue dot), **Up next** (grey dot). Column header 18px/700 + count 14px muted. Cards: radius 18, padding 16px 18px, gap 6. Background: `--surface`, but `--t-blue` for in-progress and `--t-pink` for anything waiting on the user. Card content: time + owner (13px, owner right), title 16px/700, detail 14px muted, plan chip "Plan · Lead generation" (24px pill, `--bg`, 12px/600).
4. Footer link pill: "Plan: step 4 of 6, lead generation · about a week behind →" opens Plan.

## Screen: Status · Today's run
Grid `1fr 360px`, gap 48.
**Left**: kicker "TODAY · …", headline "Step 4 of 10: stopped at drafts.", a 10-segment bar (height 8, gap 4) with "3 done · 1 stopped · 6 to go". Below it, a vertical timeline (grid `72px 36px 1fr`):
- time (13px/600 muted, right-aligned)
- 36px status dot + connector
- title 16px/700 (muted when todo) + owner pill (Maya / TODD / You; "You" is pink) + detail 14px.

The stopped step's content sits in a `--t-pink` panel (radius 18, padding 12px 16px 16px) with buttons "Review 56 tasks" and "Why the limit?".

Plain step names (map from the existing 10 pipeline steps): Start the day · Social queue pass · Choose the outreach batch · Write first-pass drafts · Outbox review (You) · Auto-send eligible items (TODD) · Hold approval-first items (TODD) · Record proof of sending (TODD) · Hand replies to TODD (TODD) · Afternoon results review.

**Right**: "Needs you" card (`--t-pink`, title + underlined action link per need), "Where today sits in the plan" card (6-segment bar + sentence + "Open plan →"), and a "Tomorrow" card (Maya's next-day intent).

## Interactions
- Toggle switches views instantly; no animation required.
- In-progress dots/icons spin (1.4s linear infinite).
- All action buttons deep-link to existing flows: Review → work approvals; Pick contact → Lead Vault contact picker for that action; Keep these dates → set `datesConfirmed = true`; Edit dates → date editor per step.
- Hover: buttons darken one step; links underline. Focus-visible: 2px `--blue` outline, offset 2px.
- Empty states: no plan → "Maya needs a plan" with a link to create one. No needs → hide the section. Not blocked → hide the banner and use a positive headline ("On track: step 4 of 6.").

## State
`planView: 'list'|'timeline'`, `statusView: 'cols'|'timeline'` (persisted). Data: plan with steps, actions grouped by `planStepId`, pending approval counts, the draft backlog count, today's pipeline run (steps with time, owner, status, result text), and the Maya summary sentence (LLM or templated).

## Design tokens (light; dark values in the HTML file)
`--bg #fff` · `--surface #f2f3f6` · `--surface2 #e4e7ed` · `--text #0f1115` · `--muted #5a6170` · `--blue #2f6bff` · `--green #22b35e` · `--pink #ff4fa8` · `--t-blue #e3ecff / fg #1d4fd6` · `--t-green #e0f6e6 / fg #17703a` · `--t-pink #ffe3f1 / fg #a8105a` · `--t-yellow #fff4c2 / fg #6e5700`.
Font: "Helvetica Neue", Helvetica, Arial, sans-serif. Radii: 12 / 14 / 18 / 20 / 24 / 999. Icons: Lucide, stroke 2.75.

## Assets
`assets/maya-avatar.png` (existing Maya avatar). Icons are Lucide: bar-chart, file-text, menu, check, alert-circle, calendar, user, inbox, pause, arrow-right, loader.

## Files
- `screenshots/01-plan-list.png`, `02-plan-timeline.png`, `03-status-columns.png`, `04-status-todays-run.png`: full-length captures of each view at 1280px wide
- `Maya Plan and Status.dc.html`: the design (18a Plan with toggle, 19a Status with toggle; the Tweaks panel sets the default views)
- `support.js`: runtime needed to open the HTML
- Source read: `src/app/features/employees/models/employee.models.ts`, `features/marketing/models/*.ts`, `features/marketing/marketing.routes.ts`, `features/work/work.component.html`, `shared/data/interfaces/task.model.ts`
