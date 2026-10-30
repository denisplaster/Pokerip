/**
 * Random number sources used by the probability engine.
 *
 * Production draws use `cryptoRng` (see src/server/crypto-rng.ts), backed by the
 * operating system CSPRNG. The seeded generator below is only used for
 * reproducible simulations, tests and seed data.
 */
export interface Rng {
  /** Returns a uniformly distributed integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
}

const UINT32 = 0x1_0000_0000;

/**
 * xoshiro128** seeded PRNG with unbiased integer sampling (rejection method).
 * Not cryptographically secure — never use it for real draws.
 */
export function createSeededRng(seed: number | string): Rng & { float(): number } {
  let s = typeof seed === "string" ? hashString(seed) : seed >>> 0;
  // SplitMix32 to expand the seed into four state words.
  const next32 = () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
  let a = next32();
  let b = next32();
  let c = next32();
  let d = next32();

  const nextUint32 = () => {
    const result = Math.imul(rotl(Math.imul(b, 5) >>> 0, 7), 9) >>> 0;
    const t = (b << 9) >>> 0;
    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c ^= t;
    d = rotl(d, 11);
    return result;
  };

  return {
    int(maxExclusive: number) {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > UINT32) {
        throw new RangeError(`maxExclusive must be an integer in (0, 2^32], got ${maxExclusive}`);
      }
      const limit = UINT32 - (UINT32 % maxExclusive);
      let x = nextUint32();
      while (x >= limit) x = nextUint32();
      return x % maxExclusive;
    },
    float() {
      return nextUint32() / UINT32;
    },
  };
}

function rotl(x: number, k: number) {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** FNV-1a 32-bit string hash, used to derive deterministic seeds. */
export function hashString(input: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Standard normal sample via Box–Muller, driven by a uniform float source. */
export function normal(float: () => number) {
  let u = 0;
  while (u === 0) u = float();
  const v = float();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
