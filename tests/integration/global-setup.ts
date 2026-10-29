import "dotenv/config";
import { execSync } from "node:child_process";

/** Applies migrations to the dedicated test database before the integration suite runs. */
export default function setup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST must be set to run integration tests (see .env.example).");
  if (url === process.env.DATABASE_URL && !process.env.ALLOW_SHARED_TEST_DB) {
    throw new Error("DATABASE_URL_TEST must point at a separate database — integration tests wipe it.");
  }
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
