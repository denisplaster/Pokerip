# Implementation checklist

This list tracks each requirement from the product brief. ✅ = implemented and verified (tests and/or browser run), ⚠️ = implemented with a noted limitation.

## Phase 1 — Foundation
- ✅ Next.js 16 App Router, TypeScript, Tailwind v4, shadcn/ui (Radix) components — `src/components/ui`
- ✅ PostgreSQL + Prisma 7 schema with relations, indexes, unique constraints and extra SQL `CHECK` constraints — `prisma/schema.prisma`, `prisma/migrations`
- ✅ Every requested model (User, Wallet, WalletTransaction, Card, CardSet, UserCard, Pack, PackDropPool, PackOpening, PackOpeningReward, MarketplaceListing, MarketplaceTransaction, MysteryBox, MysteryBoxReward, DailyReward, Mission, UserMission, Achievement, UserAchievement, CardPriceHistory, ActivityEvent), plus supporting models (OddsVersion, PackRarityOdds, PackVoucher, DailyRewardClaim, Collectible, UserCollectible, MysteryBoxOpening, MysteryBoxRewardCard, FavoriteCard, SystemSetting, AdminAuditLog, Account)
- ✅ Auth.js v5: credentials sign-up/sign-in, optional GitHub/Discord OAuth, JWT sessions re-validated against the DB
- ✅ Seed: 316 cards in 26 sets, 90-day reproducible price history, 7 packs, 4 boxes, missions, achievements, admin from env, 24 simulated demo collectors, marketplace listings and sales — `prisma/seed.ts`
- ✅ Environment-based secrets, no hard-coded credentials — `.env.example`

## Phase 2 — Core gameplay
- ✅ Rip Coins wallet: 10,000 RC sign-up grant; atomic, row-locked ledger with balance before/after and related pack/card/box/listing — `services/wallet.ts`
- ✅ Pack shop with price, available cards, rarities, published odds (per slot and per pack), featured chase cards, value range, expected value, pack artwork — `/packs`, `/packs/[id]`
- ✅ Weighted probability engine (ppm odds, per-card weights), CSPRNG, no client-side outcomes, no personalised odds, versioned and hashed odds, replayable rolls — `lib/probability.ts`, `services/odds.ts`
- ✅ Cinematic opening: centred pack, tap/swipe/Space to tear, shake + particles, face-down cards, individual 3D flips, rarity effects (common glow, uncommon blue, rare purple particles, ultra gold sweep, secret rainbow holo, chase full-screen celebration), summary, auto-added to collection — `components/opening`
- ✅ Skip animations, open another, 1×/5×/10×, synthesized sound effects with mute and volume, mobile touch, confetti for major pulls
- ✅ Statistical tests over 1,000,000 simulated cards, plus a CSPRNG run and a p-value calibration check — `tests/unit/probability.test.ts`

## Phase 3 — Economy
- ✅ Collection: totals, unique count, value, most valuable, completion %, rarity distribution, recent pulls, favourites, sort/filter/search/set filter, duplicate counts, holo detail modal, instant sell, bulk duplicate sell — `/collection`
- ✅ Card detail page with price chart, 24h/7d/30d changes, owned copies, listings, packs containing the card (with odds), recent sales — `/collection/[cardId]`
- ✅ Marketplace: browse/search/filter/sort/paginate, buy, list, cancel, my listings, sale history, price index — `/marketplace`
- ✅ Prevented: buying your own listing, double purchases, negative balances, selling cards you don't own, duplicate execution (tested with concurrent requests)
- ✅ Platform instant sell at a configurable share of value (default 70%), configurable marketplace fee (5%)
- ✅ Simulated market: current value, history, 24h/7d/30d changes, mock volume, charts, scheduled ticks within configurable limits (Vercel cron, CLI worker, admin button), labelled fictional throughout

## Phase 4 — Engagement
- ✅ Daily login calendar (100/150/200/250/300/500 RC, day 7 = free pack voucher), UTC streaks, double-claim protection — `/rewards`
- ✅ Missions: open 3 packs, collect 5 unique cards, complete a set, sell a duplicate, earn 1,000 RC (plus mystery-box, weekly and listing missions), claimable rewards
- ✅ XP, 100 levels, level-up RC rewards, 23 achievements and badges, collection milestones
- ✅ Leaderboards: collection value, biggest pull, cards collected, unique cards, level, sets completed; day/week/month/all-time where appropriate — `/leaderboards`
- ✅ Live activity feed of notable pulls and milestones (polling), animated
- ✅ Mystery boxes with cards, bundles, coins, pack vouchers and limited collectibles; exact odds; same secure architecture — `/mystery-boxes`
- ✅ Profiles (username, avatar, level, join date, value, packs opened, biggest pull, badges, favourites, showcase, collectibles) with a visibility control — `/profile`, `/u/[username]`, `/settings`

## Phase 5 — Administration & polish
- ✅ Protected admin dashboard (server-side role checks on every API call and page) — `/admin`
- ✅ User management, audited balance adjustments, role and suspension
- ✅ Create/edit packs, rarity probabilities, card pools with live EV/RTP preview; publishing creates odds versions
- ✅ Add/edit/retire/delete cards and configure virtual prices
- ✅ Manage mystery boxes; transaction history with filters; pack-opening analytics; currency issuance vs spend; daily rewards and missions editors; audit log
- ✅ Pack simulator: 1,000 / 10,000 / 100,000 openings with distribution chart, χ² test, RTP and value histogram
- ✅ Responsive layouts (desktop sidebar/header, mobile tab bar), no horizontal overflow at 390px
- ✅ Loading skeletons, error boundary, 404 page, toasts
- ✅ 111 automated tests (54 unit/statistical + 57 integration), ESLint, TypeScript and the production build all pass
- ✅ Security review (see README → Security)
- ⚠️ Rate limiting is in-memory (single instance); swap for Redis in multi-instance deployments
- ⚠️ Official card images aren't bundled (licensing): placeholder art plus an optional TCGdex importer
- ✅ README with setup, testing, architecture, deployment (Vercel, Docker) and environment reference
