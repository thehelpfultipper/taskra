import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const workspaceRoot = path.resolve(__dirname, "..");
const functionsRoot = path.join(workspaceRoot, "supabase/functions");
const outputRoot = path.join(workspaceRoot, "dist/edge-function-zips");

const functionNames = [
  "activity-worker",
  "content-worker",
  "market-worker",
  "notification-worker",
  "cron-pulse",
];

function zipFunction(functionName: string): void {
  const functionDir = path.join(functionsRoot, functionName);
  const sharedDir = path.join(functionDir, "_shared");
  const indexPath = path.join(functionDir, "index.ts");

  if (!fs.existsSync(indexPath)) {
    throw new Error(`Missing ${indexPath}. Run npm run functions:prepare first.`);
  }
  if (!fs.existsSync(sharedDir)) {
    throw new Error(`Missing ${sharedDir}. Run npm run functions:prepare first.`);
  }

  fs.mkdirSync(outputRoot, { recursive: true });
  const zipPath = path.join(outputRoot, `${functionName}.zip`);

  if (fs.existsSync(zipPath)) {
    fs.rmSync(zipPath, { force: true });
  }

  // Zip from inside the function dir so paths are index.ts and _shared/*.ts
  execSync(`zip -r "${zipPath}" index.ts _shared`, {
    cwd: functionDir,
    stdio: "inherit",
  });

  console.log(`Created ${zipPath}`);
}

function main(): void {
  console.log("Packaging edge functions for Supabase Dashboard upload...");
  for (const functionName of functionNames) {
    zipFunction(functionName);
  }
  console.log("");
  console.log("Upload each zip in Supabase Dashboard:");
  console.log("  Edge Functions → Deploy a new function → Via Editor → drag zip into editor");
  console.log("  Or open an existing function → Code tab → drag zip to replace files");
  console.log("");
  console.log(`Zips written to: ${outputRoot}`);
}

main();
