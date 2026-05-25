import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import "./load-local-env.mjs";

const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!dbPassword) {
  console.error("Missing SUPABASE_DB_PASSWORD.");
  console.error("");
  console.error("Set your Supabase database password in .env.local:");
  console.error("SUPABASE_DB_PASSWORD=your_database_password");
  console.error("");
  console.error("You can reset or copy it from Supabase Dashboard:");
  console.error("Project Settings > Database > Database password");
  process.exit(1);
}

const supabaseBin = path.join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "supabase.cmd" : "supabase"
);

if (!existsSync(supabaseBin)) {
  console.error("Local Supabase CLI was not found. Run npm install first.");
  process.exit(1);
}

const args = ["db", "push", ...process.argv.slice(2)];
const child = spawn(supabaseBin, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    SUPABASE_DB_PASSWORD: dbPassword,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`supabase db push was interrupted by ${signal}.`);
    process.exit(1);
  }

  process.exit(code ?? 1);
});
