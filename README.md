![Maya banner](src/assets/maya-readme-banner.png)

# Maya

Maya is a standalone Angular app for the AI marketing director product, extracted from the Taliferro Tech frontend. Backend services, the Firebase project, Firestore data, authentication, and API contracts remain shared with Taliferro Tech.

This repo contains only the source files Maya's live routes actually import — it was rebuilt from a full monorepo copy by tracing the real import graph from `src/main.ts`, rather than carrying over unrelated product code and assets.

## Routes

- `/` — Maya session (marketing advice), the app's home page
- `/marketing-employee` and `/marketing-employee/plan` — authenticated employee views
- `/marketing-director` and `/marketing-director/session` redirect to `/` for backward compatibility with existing links

## Development

`src/environments/` holds live API keys and is gitignored. Copy `src/environments/environment.example.ts` to `environment.ts` (and `environment.prod.ts` as needed) and fill in real values before running the app.

```bash
npm install
npm start
```

The default local route is `http://localhost:4200/`.

## Validation

```bash
npm run typecheck
npm run build
npm run build:production
```

## Deployment

Hosted on Firebase Hosting, site `maya-marketing` under the `taliferrotech` project, served at `maya.taliferro.tech`.

```bash
npm run build:production
firebase deploy --only hosting:maya-marketing
```

Every `start`/`build`/`build:production` run regenerates `src/app/version.ts` (gitignored) via `scripts/generate-version.js`, stamping the package version, short git SHA, and build timestamp. It's shown on the startup screen below the prompt chips.
