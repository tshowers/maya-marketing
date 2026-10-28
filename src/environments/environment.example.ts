// Copy this file to environment.ts and environment.prod.ts and fill in real values.
// The real environment.*.ts files are gitignored because they hold live API keys.
// Ask a Taliferro Tech admin for the values; the Firebase ones are also in the
// Firebase console (taliferrotech project > Project settings > Your apps > Web app).
export const environment = {
    // true in environment.prod.ts only.
    production: false,
    useEmulators: false,
    // Leave true: data is scoped per tenant (see tenant.interceptor.ts).
    multiTenant: true,
    multiple_choice_login: false,
    // Product name used in a few page titles and messages ("TODD").
    COMPANY_NAME: 'COMPANY_NAME',
    paid: false,
    // Where sign-in and other TODD platform links point. http://localhost:4200
    // for development, https://app.16ahead.com for production.
    PLATFORM_URL: 'http://localhost:4200',
    VERSION: require('../../package.json').version,
    // Shared Taliferro Tech Firebase web app (Auth, Firestore, Storage, Functions).
    firebaseConfig: {
        apiKey: 'FIREBASE_API_KEY',
        authDomain: 'FIREBASE_AUTH_DOMAIN',
        projectId: 'FIREBASE_PROJECT_ID',
        storageBucket: 'FIREBASE_STORAGE_BUCKET',
        messagingSenderId: 'FIREBASE_MESSAGING_SENDER_ID',
        appId: 'FIREBASE_APP_ID',
        measurementId: 'FIREBASE_MEASUREMENT_ID',
    },
    // Taliferro Tech backend, e.g. https://api.taliferro.tech/api. The OpenAPI
    // specs for its endpoints are in src/assets/api/.
    backendURL: 'https://api.example.com/api',
    // Bearer key for the backend's public (signed-out) endpoints, such as
    // Maya's free advice (public-marketing-director.service.ts).
    apiKey: 'BACKEND_PUBLIC_API_KEY',
    // The Taliferro Tech tenant: guests use its data, and its owner is the admin.
    taliferroTenantId: 'TALIFERRO_TENANT_ID',
    RECAPTCHA_KEY: 'RECAPTCHA_SITE_KEY',
    googleMapsApiKey: 'GOOGLE_MAPS_API_KEY',
    linkPreview: 'LINK_PREVIEW_API_KEY',
    accessCode: 'ACCESS_CODE',
    topMenu: true,
    enableCustomInstallPrompt: false,
};
