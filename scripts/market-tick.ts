/**
 * Runs the fictional market simulation.
 *
 *   npm run market:tick                      # one tick
 *   npm run market:tick -- --loop --every=60 # keep running, one tick every 60 minutes
 */
import "dotenv/config";
import { prisma } from "../src/server/db";
import { runMarketTick } from "../src/server/services/market";

const args = process.argv.slice(2);
const loop = args.includes("--loop");
const everyMinutes = Number(args.find((a) => a.startsWith("--every="))?.split("=")[1] ?? 60);

async function tick() {
  const result = await runMarketTick();
  console.log(`[market] ${result.at}: ${result.changed}/${result.cards} cards moved (dt ${result.dtDays.toFixed(3)} days)`);
}

async function main() {
  await tick();
  if (!loop) return;
  console.log(`[market] running every ${everyMinutes} minutes — Ctrl+C to stop`);
  setInterval(() => void tick().catch((e) => console.error("[market] tick failed", e)), everyMinutes * 60_000);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    if (!loop) void prisma.$disconnect();
  });
