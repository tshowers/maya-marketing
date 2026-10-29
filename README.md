![the Marketing Assistant banner](src/assets/maya-readme-banner.png)

# the Marketing Assistant

The Marketing Assistant is the AI marketing director web app, live at [marketing.16ahead.com](https://marketing.16ahead.com). It is a standalone Angular 19 app extracted from the Taliferro Tech frontend. It shares the Taliferro Tech backend, Firebase project (`taliferrotech`), Firestore data, sign-in and API contracts with the other 16Ahead products. It has no backend of its own.

## Prerequisites

- **Node.js 22** (Angular 19 also supports 18.19+ and 20.11+) and npm.
- **The `taliferro-ui` repo, checked out next to `web-products`.** `@taliferro/ui` is installed from `file:../../taliferro-ui`, so `npm install` fails without it:

  ```
  corporate/
    taliferro-ui/                 git clone https://github.com/tshowers/taliferro-ui.git
    web-products/
      maya-marketing/             this repo
  ```

  It holds the shared design tokens and styles. Files marked `SYNCED FROM taliferro-ui/...` (the menu, site footer, Help/About template and "Also from us") are copied in by that repo's `sync.sh` scripts. Edit them there, not here.
- **Google Chrome**, for `npm test` (Karma runs headless Chrome).
- **Firebase CLI** (`npm install -g firebase-tools`), plus access to the `taliferrotech` Firebase project. You only need these to deploy.

## Configuration

`src/environments/` is gitignored because it holds live keys. Create both files from the example:

```bash
cp src/environments/environment.example.ts src/environments/environment.ts
cp src/environments/environment.example.ts src/environments/environment.prod.ts
```

Then fill in the values. Ask a Taliferro Tech admin for them. The Firebase ones are also in the Firebase console (taliferrotech > Project settings > Your apps). The comments in the example explain each field. The values you must set are:

| Field | What it is |
| --- | --- |
| `firebaseConfig` | The shared Taliferro Tech Firebase web app (Auth, Firestore, Storage, Functions). |
| `backendURL` | The Taliferro Tech API (`https://api.taliferro.tech/api`). Almost every service calls it. |
| `apiKey` | Bearer key for the API's public endpoints. Signed-out visitors use it to get the Marketing Assistant's free advice. |
| `taliferroTenantId` | The Taliferro Tech tenant. Guests read its data, and its owner sees admin items. |
| `PLATFORM_URL` | `http://localhost:4200` in development, `https://app.16ahead.com` in production. |
| `RECAPTCHA_KEY` | reCAPTCHA site key. |

In `environment.prod.ts`, set `production: true`. The production build swaps in that file (see `angular.json`).

### Backend APIs

The Marketing Assistant has no backend of its own. Everything goes through `backendURL` to the Taliferro Tech backend, which is `todd-backend` in the [taliferrotech](https://github.com/taliferro-tech/taliferrotech) monorepo.

The API reference is the hand-written OpenAPI in that monorepo, under `frontend/src/assets/api/*.yaml`. Use those files, not the stale copy in this repo's `src/assets/api/`. The ones the Marketing Assistant uses most:

- `marketing.yaml`: The Marketing Assistant's advice, status reports and decks (`/marketing-director/*`), her jobs (`/maya/jobs`), the marketing employee, and Image and Email Creator
- `ai-backend.yaml`: the other AI endpoints
- `missions.yaml`, `momentum.yaml`: missions, action plans and integrations
- `account-admin-billing.yaml`, `core-system.yaml`: profile, tenant and entitlements

Every operation has an `x-maya` tag (`direct`, `approval`, `internal` or `never`). That tag decides what the Marketing Assistant may call on her own. When you add an endpoint, tag it. The design is in [MAYA-ORCHESTRATION-DESIGN.md](MAYA-ORCHESTRATION-DESIGN.md).

## Run it locally

```bash
npm install
npm start
```

Open `http://localhost:4200/`. You can ask for advice without signing in. Sign in with a 16Ahead account to see the employee pages. Google Analytics is turned off on localhost.

## Routes

| Route | Page |
| --- | --- |
| `/` | Marketing Assistant session (advice). Prerendered. |
| `/help`, `/about` | Help and About. Prerendered for search engines. |
| `/work` | The Marketing Assistant's jobs, approvals and questions |
| `/marketing-employee`, `/marketing-employee/plan` | Status and plan board (signed in) |
| `/profile` | Company profile |
| `/pricing` | What's free and what comes with the app |
| `/get-started`, `/login`, `/auth/callback`, `/mobile-handoff` | Sign-in |

`/marketing-director` and `/marketing-director/session` redirect to `/`.

## Tests and checks

```bash
npm run typecheck
npm test               # Karma + headless Chrome, marketing specs only
npm run build
```

`npm run build` **bumps the version** in `package.json` (`<year>.<month>.<day>-build.<n>`) and writes `src/app/version.ts` and `src/assets/version.json`, both gitignored. The app shows the version on its startup screen. Open tabs check `version.json` every minute and reload onto a new deploy when nothing would be lost; mid-conversation they wait for the next page change (`src/app/services/app-update.service.ts`). `npm start` doesn't bump the version. To build without bumping it, run `node scripts/generate-version.js && npx ng build`.

## SEO

- `/`, `/help` and `/about` are prerendered at build time (`src/app/app.routes.server.ts`). Every other route renders in the browser. Firebase Hosting rewrites those routes to `index.csr.html`.
- Code that runs on a prerendered page must not touch `window`, `document`, `Audio`, `localStorage` and so on while prerendering. Guard it with `isPlatformBrowser`.
- `src/index.html` holds the site-wide meta tags and JSON-LD. `src/app/shared/canonical-url.ts` keeps `canonical` and `og:url` matched to each page. Help and About set their own title and description.
- `public/sitemap.xml` and `public/robots.txt` are served from the site root. Add a page to the sitemap when you prerender it.

## Deploy

There is no staging environment: deploying goes straight to production at `maya.taliferro.tech`. That site is Firebase Hosting site `maya-marketing` in the `taliferrotech` project.

```bash
npm run deploy:hosting   # runs ./deploy.sh
```

`deploy.sh` does the following. If any step fails, it stops.
1. Builds the production bundle (this bumps the version).
2. Runs the tests and the typecheck.
3. Commits any changes as `Deploy: v<version>`.
4. Runs `firebase deploy --only hosting:maya-marketing`.
