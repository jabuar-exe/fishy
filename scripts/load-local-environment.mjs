import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Load server-only local settings before Vite or Wrangler starts. */
export function loadLocalEnvironment() {
  const localEnvironment = fileURLToPath(
    new URL("../.env.local", import.meta.url),
  );
  if (existsSync(localEnvironment)) process.loadEnvFile(localEnvironment);
}
