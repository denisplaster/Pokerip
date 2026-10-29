/**
 * Marketplace rules shared by the server (enforcement) and the client (previews).
 *
 * The price band stops listings far below the instant-sell price (which would
 * let a buyer mint coins by reselling to the platform) and far above value
 * (which would let alternate accounts funnel coins to each other).
 */
import { LISTING_MAX_PRICE } from "./constants";

/** Minimum collector level before an account can buy or list on the marketplace. */
export const MARKETPLACE_MIN_LEVEL = 3;
/** Listings may be priced up to this multiple of the card's current virtual value. */
export const LISTING_MAX_MULTIPLE = 4;

export function listingPriceBounds(currentValue: number, instantSellBps: number) {
  const min = Math.max(2, Math.ceil((currentValue * instantSellBps) / 10_000));
  const max = Math.min(LISTING_MAX_PRICE, Math.max(min, 10, Math.floor(currentValue * LISTING_MAX_MULTIPLE)));
  return { min, max };
}

/** Platform fee on a sale: rounded up, and at least 1 RC whenever a fee rate is set. */
export function marketplaceFee(price: number, feeBps: number) {
  if (feeBps <= 0) return 0;
  return Math.min(price - 1, Math.max(1, Math.ceil((price * feeBps) / 10_000)));
}
