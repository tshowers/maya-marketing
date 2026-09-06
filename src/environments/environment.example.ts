// Copy this file to environment.ts (and environment.prod.ts, etc.) and fill in real values.
// The real environment.*.ts files are gitignored because they hold live API keys.
export const environment = {
    production: false,
    useEmulators: false,
    multiTenant: true,
    multiple_choice_login: false,
    COMPANY_NAME: 'COMPANY_NAME',
    paid: false,
    PLATFORM_URL: 'http://localhost:4200',
    VERSION: require('../../package.json').version,
    firebaseConfig: {
        apiKey: 'FIREBASE_API_KEY',
        authDomain: 'FIREBASE_AUTH_DOMAIN',
        projectId: 'FIREBASE_PROJECT_ID',
        storageBucket: 'FIREBASE_STORAGE_BUCKET',
        messagingSenderId: 'FIREBASE_MESSAGING_SENDER_ID',
        appId: 'FIREBASE_APP_ID',
        measurementId: 'FIREBASE_MEASUREMENT_ID',
    },
    googleMapsApiKey: 'GOOGLE_MAPS_API_KEY',
    RECAPTCHA_KEY: 'RECAPTCHA_SITE_KEY',
    linkPreview: 'LINK_PREVIEW_API_KEY',
    backendURL: 'https://api.example.com/api',
    accessCode: 'ACCESS_CODE',
};
