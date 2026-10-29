import { randomInt } from "node:crypto";
import type { Rng } from "@/lib/rng";

/** Cryptographically secure RNG backed by the OS CSPRNG. Used for every real draw. */
export const cryptoRng: Rng = {
  int(maxExclusive: number) {
    return randomInt(0, maxExclusive);
  },
};
