# Maya Presentation Generation Implementation Plan

## Purpose

Build a reusable presentation-generation workflow inside Maya. Maya will help the user define the communication goal, gather only the information still needed, create a narrative plan, select semantic slide compositions, and produce a polished downloadable PDF.

The attached ChatGPT mockups are visual references and design direction. They are not pixel-perfect templates to reproduce.

## Product principles

1. Maya builds the story before she builds the slides.
2. The desired audience outcome matters more than a generic description of the topic.
3. Maya asks only for information she still needs; there is no fixed 20-question questionnaire.
4. Existing authenticated company information is reused and can be edited for the presentation.
5. Anonymous users can create and download a presentation without an account wall before generation.
6. No metric, chart, quote, claim, logo, or image may be invented.
7. User-uploaded supporting material should be preferred over stock imagery when appropriate.
8. If no appropriate image exists, the renderer uses typography and geometry instead of forcing an image into the layout.
9. The LLM determines meaning, story, hierarchy, and visual intent. The application determines layout and rendering.
10. Corporate and Minimal are visual renderings of the same semantic content, not separate content systems.

## User experience

### First screen

The first screen should remain visually simple and focused:

- Heading: `Create a presentation with Maya`
- Prompt: `What are we making?`
- Selectable presentation types:
  - Investor Pitch
  - Sales Presentation
  - Proposal
  - Strategy
  - Project Update
  - Product Presentation
  - Conference / Talk
  - Something Else
- Audience selection:
  - Investors
  - Customers
  - Executives
  - Employees
  - Partners
  - General Audience
  - Other
- Large objective field:
  - Ask what the user wants the audience to understand, believe, approve, buy, fund, or do.

The objective field should not be phrased as `What is your presentation about?` because the desired outcome is more useful for planning the story.

### Supporting material

Allow optional uploads of:

- PDF
- DOCX
- TXT / Markdown
- Images
- Charts
- Screenshots

Also allow an optional company logo in PNG, SVG, JPEG, or WebP format.

If no logo exists, display the supplied company name typographically. Never show a broken image or invent a logo.

### Visual style

Offer at least two styles:

#### Corporate

- More structured and information-rich
- Assertive typography
- Strong geometric elements
- Prominent metrics
- Sophisticated photography
- Appropriate for investor presentations, sales decks, proposals, executive updates, and strategy presentations

#### Minimal

- More negative space
- Fewer elements per slide
- Dramatic typography
- Cinematic photography
- Restrained graphics
- Strong single-message slides
- Appropriate for keynotes, product presentations, vision presentations, conference talks, and executive storytelling

### Accent color

Offer approximately six curated accent-color presets plus a custom color picker.

Only one user accent color is accepted. The renderer derives its related values internally:

- accent
- accentDark
- accentLight
- accentTint
- neutralDark
- neutralLight
- white

Users do not select each derived color individually. Maya and the renderer control the design system.

## Conversation state

The presentation conversation should maintain an internal state:

```text
NEEDS_INFORMATION
READY_TO_GENERATE
GENERATING
COMPLETE
```

Maya determines whether the available information is sufficient to create a credible presentation. When ready, she should explain that she has what she needs and show a clear `Generate My Deck` action.

The user should not need to specify a slide count unless they want to. Maya determines an appropriate number of slides from the narrative and available evidence.

## Existing knowledge Maya can reuse

For authenticated users, prefill the presentation setup from existing workspace data where available:

- Company name
- Company logo
- Company description
- Products and services
- Website
- Value proposition
- Mission and goals
- Existing marketing plan
- Relevant documents
- Available workspace context

The user must be able to change the company or presentation-specific information without changing their permanent company profile.

## Data architecture

Keep the workflow separated into these layers:

```text
User
  -> Maya deck conversation
  -> Requirements
  -> Maya narrative planner
  -> DeckPlan
  -> Slide composition selector
  -> MayaDeck JSON
  -> Theme renderer
  -> Reusable slide components
  -> PDF
```

Do not ask the LLM to generate HTML, PDF layout, pixel coordinates, or arbitrary CSS.

### Requirements object

```ts
interface PresentationRequirements {
  deckType: string;
  audience: string;
  objective: string;
  supportingMaterial: SupportingMaterialReference[];
  company: PresentationCompany;
  theme: 'corporate' | 'minimal';
  accentColor?: string;
  conversationState: 'NEEDS_INFORMATION' | 'READY_TO_GENERATE' | 'GENERATING' | 'COMPLETE';
}
```

### DeckPlan object

Maya creates this internal story plan before selecting slides:

```ts
interface DeckPlan {
  title: string;
  objective: string;
  audience: string;
  narrative: string[];
  evidence: EvidenceReference[];
  recommendedCompositions: string[];
  missingInformation: string[];
}
```

The narrative should be a sequence of communication jobs, for example:

1. Establish the opportunity.
2. Show the current problem or constraint.
3. Quantify the impact when real data exists.
4. Present the proposed approach.
5. Demonstrate evidence or expected results.
6. Explain implementation or next steps.
7. Ask for the intended decision or action.

### MayaDeck output

The renderer should consume a structured object similar to:

```ts
interface MayaDeck {
  metadata: {
    title: string;
    organization?: string;
    audience: string;
    objective: string;
    theme: 'corporate' | 'minimal';
    accentColor: string;
  };
  assets: {
    logo?: AssetReference;
    uploadedImages: AssetReference[];
    selectedStockImages: AssetReference[];
  };
  slides: MayaSlide[];
}

interface MayaSlide {
  type: SlideCompositionType;
  headline: string;
  supportingText?: string;
  metrics?: SlideMetric[];
  bullets?: string[];
  chartData?: ChartData;
  image?: AssetReference;
  quote?: string;
  attribution?: string;
  visualIntent?: string;
  speakerNotes?: string;
}
```

Speaker notes should be generated even though the initial download format is PDF. They provide a future path to PPTX or Keynote-compatible exports.

## Semantic slide compositions

Start with a reusable composition palette of approximately 15–16 types:

- `hero` — cover or opening statement
- `bigStatement` — one major idea
- `problem` — problem or challenge
- `opportunity` — market or business opportunity
- `threeIdeas` — three related concepts
- `comparison` — A versus B
- `process` — steps or process
- `timeline` — chronological progression
- `metrics` — important numbers
- `chart` — quantitative story
- `quote` — customer or expert quotation
- `imageStatement` — photography plus statement
- `product` — product or screenshot presentation
- `roadmap` — future sequence
- `recommendation` — decision or action
- `closing` — final thought or call to action

These are a palette, not a checklist. Maya should not use every composition in every deck. A seven-slide deck may use five composition types; a longer deck may repeat `metrics`, `imageStatement`, or `product` when the narrative calls for it.

One slide equals one communication job. Do not force all available information onto slides.

## Visual assets

Use the controlled library at:

```text
src/assets/maya/decks/images/
```

Organize or tag assets by visual intent where practical:

- business
- technology
- architecture
- people
- workspace
- city
- nature
- abstract
- industry

Maya’s structured output should provide a `visualIntent`, such as:

```json
{
  "visualIntent": "modern city architecture suggesting growth"
}
```

The application maps that intent to an available tagged asset. It must never fetch external stock photography or randomly select an image.

If no suitable image exists, use a typography or geometry composition instead.

User-uploaded images take priority over stock images when the uploaded material is relevant, such as:

- Product screenshots
- Factory or building photographs
- Team photographs
- Diagrams
- Charts

## Data integrity rules

Charts and metrics are real-data-only.

Maya must not invent:

- Market size
- Revenue
- Customer counts
- Growth rates
- Conversion rates
- Engagement figures
- Quotes
- Case-study results

If the user provides reliable data, visualize it. If uploaded material contains usable data, Maya may use it with an appropriate source reference. If reliable data is unavailable, choose another composition.

## Rendering architecture

Create reusable renderers for semantic compositions rather than one giant slide template or one giant HTML document.

Recommended boundaries:

- `PresentationConversationService`
- `PresentationRequirementsService`
- `NarrativePlannerService`
- `SlideCompositionSelectorService`
- `MayaDeckValidatorService`
- `MayaAssetSelectionService`
- `CorporateThemeRenderer`
- `MinimalThemeRenderer`
- `MayaPdfGeneratorService`

The content model should remain independent from theme rendering. Both theme renderers should accept the same `MayaDeck` structure and produce different visual treatments.

## PDF generation

The first export target is PDF.

The PDF generator should:

- Render slides in a standard widescreen presentation ratio.
- Apply the selected theme and one accent color.
- Render logos only when a valid logo asset exists.
- Apply cropping and positioning in the renderer.
- Omit unsupported visual elements instead of displaying broken placeholders.
- Preserve speaker notes in the internal deck object for future exports.
- Provide a preview before download when practical.
- Produce a clear download state and error state.

## Authentication and conversion

Anonymous flow:

```text
Generate Slide Deck
  -> Answer Maya
  -> Upload optional assets
  -> Generate
  -> Preview
  -> Download PDF
  -> Offer sign-in so Maya can remember the company for next time
```

Authenticated flow:

- Prefill known company information.
- Reuse existing logo, company description, products, services, and brand information.
- Allow presentation-specific overrides.
- Persist the deck conversation and generated deck metadata when appropriate.

The sign-in prompt should come after the user experiences the generated presentation, not before generation.

## Validation and security

Validate structured output before rendering:

- Required metadata exists.
- Slide type is in the allowed composition list.
- No slide contains unsupported raw HTML.
- Chart values have source references.
- Images resolve to approved local or user-uploaded assets.
- No slide contains an invented placeholder metric.
- Uploaded files meet size and type limits.
- User-uploaded content is scoped to the correct user or tenant.

The backend must independently validate permissions and asset ownership. The client must not be the only security boundary.

## Implementation phases

### Phase 1 — Foundation

- Add presentation models and enums.
- Add conversation state management.
- Add the first-screen requirements UI.
- Add authenticated profile prefill.
- Add anonymous-session support.
- Add theme and accent-color selection.

### Phase 2 — Supporting material

- Add optional file upload UI.
- Connect uploaded files to the existing document/storage services where appropriate.
- Extract text and metadata from supported files.
- Register uploaded images and charts as deck assets.
- Add optional company-logo upload or selection.

### Phase 3 — Maya planning

- Add a structured Maya presentation-planning request.
- Implement `NEEDS_INFORMATION` and `READY_TO_GENERATE` responses.
- Add presentation-type-specific follow-up questions.
- Add `DeckPlan` generation.
- Add narrative validation and missing-information handling.

### Phase 4 — Composition selection

- Implement the semantic composition registry.
- Select compositions from the narrative rather than from a checklist.
- Add content-density rules.
- Add chart and metric validation.
- Add visual-intent output.
- Add controlled stock-image selection and uploaded-image priority.

### Phase 5 — Theme rendering

- Implement reusable composition renderers.
- Implement Corporate theme.
- Implement Minimal theme.
- Implement fixed design-system colors and accent derivation.
- Add geometry and typography fallbacks.

### Phase 6 — PDF and preview

- Generate widescreen PDFs from `MayaDeck` JSON.
- Add preview and download states.
- Add rendering error handling.
- Preserve speaker notes for future export formats.

### Phase 7 — Persistence and polish

- Persist authenticated deck sessions.
- Add deck history and regeneration.
- Add source attribution and data-coverage details.
- Add analytics for generation completion and download success.
- Test long text, missing data, missing logos, missing images, mobile UI, and anonymous downloads.

## Testing checklist

### Conversation

- User can select each presentation type.
- User can select each audience.
- Objective is required before planning.
- Maya asks different follow-up questions for different deck types.
- Maya stops asking questions when enough information exists.
- State transitions are correct.

### Data integrity

- No fake metrics appear.
- No fake logo appears.
- Missing charts are omitted.
- Missing images produce a typography/geometry fallback.
- Uploaded data is attributed correctly.

### Themes

- Corporate and Minimal render the same content differently.
- Accent color is limited to one user-selected color.
- Derived colors remain readable and accessible.
- Long headlines do not overflow.

### Access

- Anonymous users can generate and download.
- Authenticated users receive profile prefill.
- Tenant data cannot leak between users.
- Uploads are scoped and validated.

### PDF

- PDF opens correctly in common viewers.
- Slide dimensions are consistent.
- Images crop correctly.
- Slides with sparse content remain polished.
- Speaker notes remain available in the internal model.

## Definition of done

The first production-ready version is complete when a user can tell Maya what they want to accomplish, select an audience and presentation type, optionally upload source material, choose Corporate or Minimal, provide one accent color, answer only the follow-up questions Maya determines are necessary, preview a credible data-grounded deck, and download a polished PDF without the LLM controlling the visual layout.
