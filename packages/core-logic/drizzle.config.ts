import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    // For Phase 1 Local Development, we use a local SQLite file in the web app's directory
    // This perfectly mirrors Cloudflare D1
    url: "file:../../apps/web/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/db.sqlite",
  },
});
