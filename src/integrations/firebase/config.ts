export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || "",
};

export function assertFirebaseConfig() {
  const missing = (
    [
      ["FIREBASE_API_KEY", firebaseConfig.apiKey],
      ["FIREBASE_AUTH_DOMAIN", firebaseConfig.authDomain],
      ["FIREBASE_PROJECT_ID", firebaseConfig.projectId],
      ["FIREBASE_APP_ID", firebaseConfig.appId],
    ] as const
  )
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing Firebase environment variable(s): ${missing.join(", ")}`);
  }
}
