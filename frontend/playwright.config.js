import { defineConfig } from "@playwright/test";
import process from "node:process";

const dotnetCommand = process.env.DOTNET_HOST_PATH ? JSON.stringify(process.env.DOTNET_HOST_PATH) : "dotnet";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: [
    {
      command: `${dotnetCommand} run --no-launch-profile --project ../backend/Queuing.Api/Queuing.Api.csproj --urls http://127.0.0.1:5271`,
      url: "http://127.0.0.1:5271/api/v1/services",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
