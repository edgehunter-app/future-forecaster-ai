import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "net.edgehunter",
  appName: "EdgeHunter",
  webDir: "dist",
  server: {
    androidScheme: "https",
    url: "https://edgehunter.net",
    cleartext: false,
  },
};

export default config;