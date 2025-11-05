import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.huberty.memoapp",
  appName: "Memo App",
  webDir: ".next/static",
  server: {
    // Load the app from the live server URL
    url: "https://dev.memo.docuralis.com",
    cleartext: false,
    allowNavigation: [
      "https://dev.memo.docuralis.com",
      "https://staging.memo.docuralis.com",
      "https://memo.docuralis.com",
    ],
    androidScheme: "https",
    iosScheme: "https",
  },
  ios: {
    contentInset: "automatic",
  },
};

export default config;
