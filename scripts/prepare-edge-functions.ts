import fs from "node:fs";
import path from "node:path";

const workspaceRoot = path.resolve(__dirname, "..");
const functionsRoot = path.join(workspaceRoot, "supabase/functions");
const sharedSource = path.join(functionsRoot, "_shared");

const functionNames = [
  "activity-worker",
  "content-worker",
  "market-worker",
  "notification-worker",
  "cron-pulse",
];

function copySharedIntoFunction(functionName: string): void {
  const functionDir = path.join(functionsRoot, functionName);
  const sharedTarget = path.join(functionDir, "_shared");

  if (!fs.existsSync(functionDir)) {
    throw new Error(`Missing edge function directory: ${functionDir}`);
  }

  if (fs.existsSync(sharedTarget)) {
    fs.rmSync(sharedTarget, { recursive: true, force: true });
  }

  fs.cpSync(sharedSource, sharedTarget, { recursive: true });
  console.log(`Prepared ${functionName}/_shared`);
}

function main(): void {
  if (!fs.existsSync(sharedSource)) {
    throw new Error(`Missing shared source directory: ${sharedSource}`);
  }

  for (const functionName of functionNames) {
    copySharedIntoFunction(functionName);
  }

  console.log("Edge function shared modules copied for remote-compatible deploy bundles.");
}

main();
