import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "net.edgehunter.app",
  appName: "EdgeHunter",
  webDir: "dist",
  server: {
    androidScheme: "https",
    // Point to live site for hot-loading during setup.
    // Remove `url` when building a standalone native app.
    url: "https://edgehunter.net",
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#0a0b0f",
      showSpinner: false,
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#0a0b0f",
    },
  },
};

export default config;