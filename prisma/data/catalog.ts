/**
 * Demo card catalog used by the seed script.
 *
 * Card names, set names and printed numbers come from public set lists. No
 * official artwork is bundled: cards render generated placeholder art unless an
 * image URL is imported later (see scripts/import-tcgdex.ts). All values are
 * fictional Rip Coin amounts and do not reflect real market prices.
 */
import { POKEDEX } from "./pokedex";

export type RarityCode = "C" | "U" | "R" | "UR" | "SR" | "CH";
export type Category = "VINTAGE" | "MODERN" | "ILLUSTRATION" | "GRADED" | "PROMO";

export const RARITY_FROM_CODE = {
  C: "COMMON",
  U: "UNCOMMON",
  R: "RARE",
  UR: "ULTRA_RARE",
  SR: "SECRET_RARE",
  CH: "CHASE",
} as const;

export interface SetSeed {
  code: string;
  name: string;
  series: string;
  releaseYear: number;
  printedTotal?: number;
  description: string;
}

export interface CardSeed {
  slug: string;
  set: string;
  number: string;
  name: string;
  pokemon: string | null;
  variant: string | null;
  rarity: (typeof RARITY_FROM_CODE)[RarityCode];
  energyType: string;
  dexNumber: number | null;
  value: number;
  grade: string | null;
  releaseYear: number;
  category: Category;
  externalId: string | null;
}

export const SETS: SetSeed[] = [
  { code: "base1", name: "Base Set", series: "Original Series", releaseYear: 1999, printedTotal: 102, description: "The set that started it all — home of the iconic holo Charizard." },
  { code: "base2", name: "Jungle", series: "Original Series", releaseYear: 1999, printedTotal: 64, description: "The first expansion, introducing the Eeveelutions and Snorlax." },
  { code: "base3", name: "Fossil", series: "Original Series", releaseYear: 1999, printedTotal: 62, description: "Ancient Pokémon, legendary birds and the fan-favourite holo Gengar." },
  { code: "base5", name: "Team Rocket", series: "Original Series", releaseYear: 2000, printedTotal: 82, description: "Dark Pokémon and the first secret rare." },
  { code: "neo1", name: "Neo Genesis", series: "Neo Series", releaseYear: 2000, printedTotal: 111, description: "Gold & Silver arrive with the legendary holo Lugia." },
  { code: "neo4", name: "Neo Destiny", series: "Neo Series", releaseYear: 2002, printedTotal: 105, description: "Light and dark Pokémon plus the Shining secret rares." },
  { code: "ecard3", name: "Skyridge", series: "e-Card Series", releaseYear: 2003, printedTotal: 144, description: "The final e-Card set, featuring crystal-type secret rares." },
  { code: "ex8", name: "EX Deoxys", series: "EX Series", releaseYear: 2005, printedTotal: 107, description: "Space-themed set with a gold-star Rayquaza." },
  { code: "ex15", name: "EX Dragon Frontiers", series: "EX Series", releaseYear: 2006, printedTotal: 101, description: "δ Delta Species and the legendary gold-star Charizard." },
  { code: "pop5", name: "POP Series 5", series: "POP Series", releaseYear: 2007, printedTotal: 17, description: "A tiny promo set with two of the most coveted gold stars." },
  { code: "sm115", name: "Hidden Fates", series: "Sun & Moon", releaseYear: 2019, printedTotal: 68, description: "The Shiny Vault special set." },
  { code: "swsh35", name: "Champion's Path", series: "Sword & Shield", releaseYear: 2020, printedTotal: 73, description: "Galar's Champion journey, with a rainbow Charizard VMAX." },
  { code: "swsh4", name: "Vivid Voltage", series: "Sword & Shield", releaseYear: 2020, printedTotal: 185, description: "Electrifying set featuring the giant Pikachu VMAX." },
  { code: "swsh45", name: "Shining Fates", series: "Sword & Shield", releaseYear: 2021, printedTotal: 72, description: "Shiny Vault returns with a shiny Charizard VMAX." },
  { code: "swsh7", name: "Evolving Skies", series: "Sword & Shield", releaseYear: 2021, printedTotal: 203, description: "Dragons and Eeveelutions — the modern alternate-art benchmark." },
  { code: "swsh8", name: "Fusion Strike", series: "Sword & Shield", releaseYear: 2021, printedTotal: 264, description: "Fusion Strike style with Gengar, Mew and Espeon alt arts." },
  { code: "swsh9", name: "Brilliant Stars", series: "Sword & Shield", releaseYear: 2022, printedTotal: 172, description: "The debut of VSTAR Pokémon." },
  { code: "swsh11", name: "Lost Origin", series: "Sword & Shield", releaseYear: 2022, printedTotal: 196, description: "The Lost Zone opens, led by Giratina." },
  { code: "swsh12", name: "Silver Tempest", series: "Sword & Shield", releaseYear: 2022, printedTotal: 195, description: "Lugia soars in one of the era's best alt arts." },
  { code: "swsh125", name: "Crown Zenith", series: "Sword & Shield", releaseYear: 2023, printedTotal: 159, description: "The Sword & Shield finale with the Galarian Gallery." },
  { code: "sv3", name: "Obsidian Flames", series: "Scarlet & Violet", releaseYear: 2023, printedTotal: 197, description: "Tera Charizard ex blazes onto the scene." },
  { code: "sv35", name: "Scarlet & Violet 151", series: "Scarlet & Violet", releaseYear: 2023, printedTotal: 165, description: "A love letter to the original 151 with stunning illustration rares." },
  { code: "sv45", name: "Paldean Fates", series: "Scarlet & Violet", releaseYear: 2024, printedTotal: 91, description: "Shiny Pokémon return in force." },
  { code: "sv85", name: "Prismatic Evolutions", series: "Scarlet & Violet", releaseYear: 2025, printedTotal: 131, description: "An Eeveelution celebration with special illustration rares." },
  { code: "promo", name: "Legendary Promos", series: "Promotional", releaseYear: 1998, description: "Ultra-rare promotional cards." },
  { code: "vault", name: "Graded Vault", series: "RipVault Collection", releaseYear: 2026, description: "Professionally graded slabs held in the RipVault (virtual)." },
];

// [number, name, rarity, value, variant?]
type Row = [string, string, RarityCode, number, string?];

const TRAINERS = new Set([
  "Clefairy Doll", "Computer Search", "Devolution Spray", "Imposter Professor Oak", "Item Finder", "Lass",
  "Pokémon Breeder", "Pokémon Trader", "Scoop Up", "Super Energy Removal", "Defender", "Energy Retrieval",
  "Full Heal", "Maintenance", "PlusPower", "Pokémon Center", "Pokémon Flute", "Pokédex", "Professor Oak",
  "Revive", "Super Potion", "Bill", "Energy Removal", "Gust of Wind", "Potion", "Switch", "Poké Ball",
  "Mr. Fuji", "Energy Search", "Gambler", "Recall", "Mysterious Fossil", "Erika's Invitation", "Giovanni's Charisma",
]);

const BASE_SET: Row[] = [
  ["1", "Alakazam", "UR", 700, "Holo"], ["2", "Blastoise", "UR", 1600, "Holo"], ["3", "Chansey", "UR", 520, "Holo"],
  ["4", "Charizard", "SR", 4800, "Holo"], ["5", "Clefairy", "UR", 480, "Holo"], ["6", "Gyarados", "UR", 620, "Holo"],
  ["7", "Hitmonchan", "UR", 460, "Holo"], ["8", "Machamp", "UR", 300, "Holo"], ["9", "Magneton", "UR", 440, "Holo"],
  ["10", "Mewtwo", "UR", 780, "Holo"], ["11", "Nidoking", "UR", 520, "Holo"], ["12", "Ninetales", "UR", 600, "Holo"],
  ["13", "Poliwrath", "UR", 420, "Holo"], ["14", "Raichu", "UR", 640, "Holo"], ["15", "Venusaur", "UR", 1400, "Holo"],
  ["16", "Zapdos", "UR", 680, "Holo"],
  ["17", "Beedrill", "R", 70], ["18", "Dragonair", "R", 110], ["19", "Dugtrio", "R", 60], ["20", "Electabuzz", "R", 65],
  ["21", "Electrode", "R", 55], ["22", "Pidgeotto", "R", 60],
  ["23", "Arcanine", "U", 38], ["24", "Charmeleon", "U", 42], ["25", "Dewgong", "U", 16], ["26", "Dratini", "U", 24],
  ["27", "Farfetch'd", "U", 18], ["28", "Growlithe", "U", 20], ["29", "Haunter", "U", 24], ["30", "Ivysaur", "U", 28],
  ["31", "Jynx", "U", 16], ["32", "Kadabra", "U", 22], ["33", "Kakuna", "U", 12], ["34", "Machoke", "U", 14],
  ["35", "Magikarp", "U", 26], ["36", "Magmar", "U", 15], ["37", "Nidorino", "U", 13], ["38", "Poliwhirl", "U", 12],
  ["39", "Porygon", "U", 18], ["40", "Raticate", "U", 12], ["41", "Seel", "U", 12], ["42", "Wartortle", "U", 30],
  ["43", "Abra", "C", 6], ["44", "Bulbasaur", "C", 14], ["45", "Caterpie", "C", 5], ["46", "Charmander", "C", 18],
  ["47", "Diglett", "C", 5], ["48", "Doduo", "C", 4], ["49", "Drowzee", "C", 4], ["50", "Gastly", "C", 7],
  ["51", "Koffing", "C", 4], ["52", "Machop", "C", 4], ["53", "Magnemite", "C", 5], ["54", "Metapod", "C", 4],
  ["55", "Nidoran♂", "C", 5], ["56", "Onix", "C", 6], ["57", "Pidgey", "C", 5], ["58", "Pikachu", "C", 20],
  ["59", "Poliwag", "C", 5], ["60", "Ponyta", "C", 6], ["61", "Rattata", "C", 4], ["62", "Sandshrew", "C", 4],
  ["63", "Squirtle", "C", 16], ["64", "Starmie", "C", 7], ["65", "Staryu", "C", 5], ["66", "Tangela", "C", 4],
  ["67", "Voltorb", "C", 5], ["68", "Vulpix", "C", 8], ["69", "Weedle", "C", 4],
  ["70", "Clefairy Doll", "R", 50], ["71", "Computer Search", "R", 62], ["72", "Devolution Spray", "R", 45],
  ["73", "Imposter Professor Oak", "R", 45], ["74", "Item Finder", "R", 55], ["75", "Lass", "R", 45],
  ["76", "Pokémon Breeder", "R", 50], ["77", "Pokémon Trader", "R", 50], ["78", "Scoop Up", "R", 45],
  ["79", "Super Energy Removal", "R", 50],
  ["80", "Defender", "U", 10], ["81", "Energy Retrieval", "U", 10], ["82", "Full Heal", "U", 10], ["83", "Maintenance", "U", 10],
  ["84", "PlusPower", "U", 11], ["85", "Pokémon Center", "U", 12], ["86", "Pokémon Flute", "U", 10], ["87", "Pokédex", "U", 11],
  ["88", "Professor Oak", "U", 14], ["89", "Revive", "U", 10], ["90", "Super Potion", "U", 10],
  ["91", "Bill", "C", 5], ["92", "Energy Removal", "C", 5], ["93", "Gust of Wind", "C", 5], ["94", "Potion", "C", 4], ["95", "Switch", "C", 4],
  ["96", "Double Colorless Energy", "U", 14], ["97", "Fighting Energy", "C", 3], ["98", "Fire Energy", "C", 3],
  ["99", "Grass Energy", "C", 3], ["100", "Lightning Energy", "C", 3], ["101", "Psychic Energy", "C", 3], ["102", "Water Energy", "C", 3],
];

const JUNGLE_HOLOS: [string, number][] = [
  ["Clefable", 360], ["Electrode", 330], ["Flareon", 500], ["Jolteon", 480], ["Kangaskhan", 360], ["Mr. Mime", 380],
  ["Nidoqueen", 340], ["Pidgeot", 380], ["Pinsir", 320], ["Scyther", 500], ["Snorlax", 580], ["Vaporeon", 540],
  ["Venomoth", 310], ["Victreebel", 320], ["Vileplume", 360], ["Wigglytuff", 340],
];
const JUNGLE_RARE_VALUES = [45, 40, 70, 68, 42, 48, 40, 50, 38, 72, 85, 75, 36, 38, 44, 40];
const JUNGLE: Row[] = [
  ...JUNGLE_HOLOS.map(([name, v], i): Row => [String(i + 1), name, "UR", v, "Holo"]),
  ...JUNGLE_HOLOS.map(([name], i): Row => [String(i + 17), name, "R", JUNGLE_RARE_VALUES[i]]),
  ["33", "Butterfree", "U", 16], ["34", "Dodrio", "U", 12], ["35", "Exeggutor", "U", 12], ["36", "Fearow", "U", 12],
  ["37", "Gloom", "U", 13], ["38", "Lickitung", "U", 14], ["39", "Marowak", "U", 14], ["40", "Nidorina", "U", 12],
  ["41", "Parasect", "U", 12], ["42", "Persian", "U", 14], ["43", "Primeape", "U", 12], ["44", "Rapidash", "U", 16],
  ["45", "Rhydon", "U", 13], ["46", "Seaking", "U", 12], ["47", "Tauros", "U", 13], ["48", "Weepinbell", "U", 12],
  ["49", "Bellsprout", "C", 5], ["50", "Cubone", "C", 7], ["51", "Eevee", "C", 16], ["52", "Exeggcute", "C", 4],
  ["53", "Goldeen", "C", 4], ["54", "Jigglypuff", "C", 9], ["55", "Mankey", "C", 4], ["56", "Meowth", "C", 8],
  ["57", "Nidoran♀", "C", 5], ["58", "Oddish", "C", 5], ["59", "Paras", "C", 4], ["60", "Pikachu", "C", 18],
  ["61", "Rhyhorn", "C", 4], ["62", "Spearow", "C", 4], ["63", "Venonat", "C", 4], ["64", "Poké Ball", "C", 5],
];

const FOSSIL_HOLOS: [string, number][] = [
  ["Aerodactyl", 360], ["Articuno", 500], ["Ditto", 430], ["Dragonite", 620], ["Gengar", 680], ["Haunter", 360],
  ["Hitmonlee", 340], ["Hypno", 320], ["Kabutops", 400], ["Lapras", 480], ["Magneton", 360], ["Moltres", 500],
  ["Muk", 340], ["Raichu", 430], ["Zapdos", 500],
];
const FOSSIL_RARE_VALUES = [45, 70, 60, 85, 90, 45, 40, 38, 50, 65, 40, 70, 40, 55, 70];
const FOSSIL: Row[] = [
  ...FOSSIL_HOLOS.map(([name, v], i): Row => [String(i + 1), name, "UR", v, "Holo"]),
  ...FOSSIL_HOLOS.map(([name], i): Row => [String(i + 16), name, "R", FOSSIL_RARE_VALUES[i]]),
  ["31", "Arbok", "U", 13], ["32", "Cloyster", "U", 12], ["33", "Gastly", "U", 14], ["34", "Golbat", "U", 12],
  ["35", "Golduck", "U", 13], ["36", "Golem", "U", 13], ["37", "Graveler", "U", 12], ["38", "Kingler", "U", 12],
  ["39", "Magmar", "U", 13], ["40", "Omastar", "U", 14], ["41", "Sandslash", "U", 12], ["42", "Seadra", "U", 12],
  ["43", "Slowbro", "U", 13], ["44", "Tentacruel", "U", 12], ["45", "Weezing", "U", 12],
  ["46", "Ekans", "C", 4], ["47", "Geodude", "C", 4], ["48", "Grimer", "C", 4], ["49", "Horsea", "C", 4],
  ["50", "Kabuto", "C", 6], ["51", "Krabby", "C", 4], ["52", "Omanyte", "C", 6], ["53", "Psyduck", "C", 7],
  ["54", "Shellder", "C", 4], ["55", "Slowpoke", "C", 5], ["56", "Tentacool", "C", 4], ["57", "Zubat", "C", 4],
  ["58", "Mr. Fuji", "U", 11], ["59", "Energy Search", "C", 4], ["60", "Gambler", "C", 4], ["61", "Recall", "C", 4],
  ["62", "Mysterious Fossil", "C", 5],
];

// Modern & special cards: [set, number, name, rarity, value, variant, category]
type SpecialRow = [string, string, string, RarityCode, number, string | null, Category];

const SPECIALS: SpecialRow[] = [
  // Vintage specials
  ["base5", "3/82", "Dark Blastoise", "UR", 900, "Holo", "VINTAGE"],
  ["base5", "4/82", "Dark Charizard", "UR", 1800, "Holo", "VINTAGE"],
  ["base5", "83/82", "Dark Raichu", "SR", 2200, "Secret Rare", "VINTAGE"],
  ["neo1", "9/111", "Lugia", "SR", 5500, "Holo", "VINTAGE"],
  ["neo4", "107/105", "Shining Charizard", "CH", 16000, "Shining", "VINTAGE"],
  ["ecard3", "146/144", "Charizard", "CH", 30000, "Crystal", "VINTAGE"],
  ["ex8", "107/107", "Rayquaza ★", "CH", 28000, "Gold Star", "VINTAGE"],
  ["ex15", "100/101", "Charizard ★", "CH", 45000, "Gold Star", "VINTAGE"],
  ["pop5", "16/17", "Espeon ★", "CH", 15000, "Gold Star", "VINTAGE"],
  ["pop5", "17/17", "Umbreon ★", "CH", 24000, "Gold Star", "VINTAGE"],
  // Hidden Fates
  ["sm115", "SV49/SV94", "Charizard-GX", "CH", 10500, "Shiny", "MODERN"],
  // Champion's Path
  ["swsh35", "020/073", "Charizard VMAX", "UR", 900, null, "MODERN"],
  ["swsh35", "074/073", "Charizard VMAX", "SR", 6500, "Rainbow Rare", "MODERN"],
  // Vivid Voltage
  ["swsh4", "044/185", "Pikachu VMAX", "UR", 350, null, "MODERN"],
  ["swsh4", "188/185", "Pikachu VMAX", "SR", 3600, "Rainbow Rare", "MODERN"],
  // Shining Fates
  ["swsh45", "SV107/SV122", "Charizard VMAX", "CH", 9000, "Shiny", "MODERN"],
  // Evolving Skies
  ["swsh7", "095/203", "Umbreon VMAX", "UR", 520, null, "MODERN"],
  ["swsh7", "111/203", "Rayquaza VMAX", "UR", 420, null, "MODERN"],
  ["swsh7", "189/203", "Umbreon V", "SR", 2600, "Alternate Art", "ILLUSTRATION"],
  ["swsh7", "192/203", "Dragonite V", "SR", 2100, "Alternate Art", "ILLUSTRATION"],
  ["swsh7", "194/203", "Rayquaza V", "SR", 2400, "Alternate Art", "ILLUSTRATION"],
  ["swsh7", "205/203", "Leafeon VMAX", "SR", 3800, "Alternate Art", "ILLUSTRATION"],
  ["swsh7", "209/203", "Glaceon VMAX", "SR", 4200, "Alternate Art", "ILLUSTRATION"],
  ["swsh7", "212/203", "Sylveon VMAX", "SR", 4600, "Alternate Art", "ILLUSTRATION"],
  ["swsh7", "215/203", "Umbreon VMAX", "CH", 22000, "Alternate Art", "ILLUSTRATION"],
  ["swsh7", "218/203", "Rayquaza VMAX", "CH", 14000, "Alternate Art", "ILLUSTRATION"],
  // Fusion Strike
  ["swsh8", "114/264", "Mew VMAX", "UR", 280, null, "MODERN"],
  ["swsh8", "157/264", "Gengar VMAX", "UR", 350, null, "MODERN"],
  ["swsh8", "269/264", "Mew VMAX", "SR", 2200, "Alternate Art", "ILLUSTRATION"],
  ["swsh8", "270/264", "Espeon VMAX", "SR", 5200, "Alternate Art", "ILLUSTRATION"],
  ["swsh8", "271/264", "Gengar VMAX", "CH", 9500, "Alternate Art", "ILLUSTRATION"],
  // Brilliant Stars
  ["swsh9", "017/172", "Charizard V", "UR", 250, null, "MODERN"],
  ["swsh9", "018/172", "Charizard VSTAR", "UR", 300, null, "MODERN"],
  // Lost Origin
  ["swsh11", "131/196", "Giratina VSTAR", "UR", 380, null, "MODERN"],
  ["swsh11", "186/196", "Giratina V", "CH", 12000, "Alternate Art", "ILLUSTRATION"],
  // Silver Tempest
  ["swsh12", "139/195", "Lugia VSTAR", "UR", 300, null, "MODERN"],
  ["swsh12", "186/195", "Lugia V", "CH", 11000, "Alternate Art", "ILLUSTRATION"],
  // Crown Zenith
  ["swsh125", "GG44/GG70", "Mewtwo VSTAR", "SR", 1600, "Galarian Gallery", "ILLUSTRATION"],
  ["swsh125", "GG69/GG70", "Giratina VSTAR", "SR", 3200, "Galarian Gallery", "ILLUSTRATION"],
  ["swsh125", "GG70/GG70", "Arceus VSTAR", "SR", 1800, "Gold", "MODERN"],
  // Obsidian Flames
  ["sv3", "125/197", "Charizard ex", "UR", 220, null, "MODERN"],
  ["sv3", "223/197", "Charizard ex", "CH", 8500, "Special Illustration Rare", "ILLUSTRATION"],
  // 151
  ["sv35", "003/165", "Venusaur ex", "R", 90, "Double Rare", "MODERN"],
  ["sv35", "006/165", "Charizard ex", "R", 180, "Double Rare", "MODERN"],
  ["sv35", "009/165", "Blastoise ex", "R", 110, "Double Rare", "MODERN"],
  ["sv35", "151/165", "Mew ex", "R", 75, "Double Rare", "MODERN"],
  ["sv35", "166/165", "Bulbasaur", "R", 220, "Illustration Rare", "ILLUSTRATION"],
  ["sv35", "167/165", "Ivysaur", "R", 160, "Illustration Rare", "ILLUSTRATION"],
  ["sv35", "168/165", "Charmander", "R", 300, "Illustration Rare", "ILLUSTRATION"],
  ["sv35", "169/165", "Charmeleon", "R", 200, "Illustration Rare", "ILLUSTRATION"],
  ["sv35", "170/165", "Squirtle", "R", 260, "Illustration Rare", "ILLUSTRATION"],
  ["sv35", "171/165", "Wartortle", "R", 170, "Illustration Rare", "ILLUSTRATION"],
  ["sv35", "172/165", "Caterpie", "R", 180, "Illustration Rare", "ILLUSTRATION"],
  ["sv35", "173/165", "Pikachu", "R", 240, "Illustration Rare", "ILLUSTRATION"],
  ["sv35", "198/165", "Venusaur ex", "SR", 2400, "Special Illustration Rare", "ILLUSTRATION"],
  ["sv35", "199/165", "Charizard ex", "CH", 9800, "Special Illustration Rare", "ILLUSTRATION"],
  ["sv35", "200/165", "Blastoise ex", "SR", 2600, "Special Illustration Rare", "ILLUSTRATION"],
  ["sv35", "201/165", "Alakazam ex", "SR", 1700, "Special Illustration Rare", "ILLUSTRATION"],
  ["sv35", "202/165", "Zapdos ex", "SR", 1300, "Special Illustration Rare", "ILLUSTRATION"],
  ["sv35", "203/165", "Erika's Invitation", "SR", 2900, "Special Illustration Rare", "ILLUSTRATION"],
  ["sv35", "204/165", "Giovanni's Charisma", "SR", 1200, "Special Illustration Rare", "ILLUSTRATION"],
  ["sv35", "205/165", "Mew ex", "SR", 1400, "Hyper Rare", "MODERN"],
  // Paldean Fates
  ["sv45", "234/091", "Charizard ex", "CH", 8000, "Shiny Special Illustration Rare", "ILLUSTRATION"],
  // Prismatic Evolutions
  ["sv85", "155/131", "Espeon ex", "SR", 6000, "Special Illustration Rare", "ILLUSTRATION"],
  ["sv85", "156/131", "Sylveon ex", "SR", 5800, "Special Illustration Rare", "ILLUSTRATION"],
  ["sv85", "161/131", "Umbreon ex", "CH", 18000, "Special Illustration Rare", "ILLUSTRATION"],
  // Promo
  ["promo", "Promo", "Pikachu Illustrator", "CH", 2500000, "CoroCoro Promo", "PROMO"],
];

// Graded vault slabs: [number, name, variant, grade, rarity, value, releaseYear]
const VAULT: [string, string, string, string, RarityCode, number, number][] = [
  ["4/102", "Charizard", "1st Edition · Base Set", "PSA 10", "CH", 1500000, 1999],
  ["2/102", "Blastoise", "1st Edition · Base Set", "PSA 10", "CH", 220000, 1999],
  ["15/102", "Venusaur", "1st Edition · Base Set", "PSA 10", "CH", 160000, 1999],
  ["4/102", "Charizard", "Shadowless · Base Set", "PSA 9", "CH", 140000, 1999],
  ["10/102", "Mewtwo", "1st Edition · Base Set", "PSA 10", "CH", 60000, 1999],
  ["1/102", "Alakazam", "1st Edition · Base Set", "PSA 9", "SR", 18000, 1999],
  ["6/102", "Gyarados", "1st Edition · Base Set", "PSA 9", "SR", 16000, 1999],
  ["14/102", "Raichu", "1st Edition · Base Set", "PSA 9", "SR", 20000, 1999],
  ["16/102", "Zapdos", "1st Edition · Base Set", "PSA 9", "SR", 15000, 1999],
  ["12/102", "Ninetales", "1st Edition · Base Set", "PSA 9", "SR", 14000, 1999],
  ["58/102", "Pikachu", "1st Edition · Red Cheeks", "PSA 9", "UR", 6500, 1999],
  ["5/62", "Gengar", "1st Edition · Fossil", "PSA 10", "CH", 45000, 1999],
  ["4/62", "Dragonite", "1st Edition · Fossil", "PSA 10", "CH", 32000, 1999],
  ["11/64", "Snorlax", "1st Edition · Jungle", "PSA 10", "SR", 22000, 1999],
  ["10/64", "Scyther", "1st Edition · Jungle", "PSA 10", "SR", 12000, 1999],
  ["9/111", "Lugia", "1st Edition · Neo Genesis", "PSA 9", "CH", 75000, 2000],
  ["107/105", "Shining Charizard", "Neo Destiny", "PSA 10", "CH", 90000, 2002],
  ["215/203", "Umbreon VMAX", "Alternate Art · Evolving Skies", "PSA 10", "CH", 48000, 2021],
  ["218/203", "Rayquaza VMAX", "Alternate Art · Evolving Skies", "PSA 10", "CH", 26000, 2021],
  ["186/196", "Giratina V", "Alternate Art · Lost Origin", "PSA 10", "CH", 22000, 2022],
  ["199/165", "Charizard ex", "Special Illustration Rare · 151", "PSA 10", "CH", 20000, 2023],
];

const SUFFIXES = [" VMAX", " VSTAR", " V", " ex", "-GX", " ★"];
const PREFIXES = ["Dark ", "Shining "];

export function pokemonFromName(name: string): string | null {
  let base = name;
  for (const p of PREFIXES) if (base.startsWith(p)) base = base.slice(p.length);
  for (const s of SUFFIXES) if (base.endsWith(s)) base = base.slice(0, -s.length);
  return POKEDEX[base] ? base : null;
}

function energyTypeFor(name: string, pokemon: string | null): string {
  if (name.endsWith(" Energy")) {
    const t = name.replace(" Energy", "").toLowerCase();
    return t === "double colorless" ? "colorless" : t;
  }
  if (TRAINERS.has(name) || !pokemon) return "trainer";
  // Modern-era typings that differ from the classic TCG colours.
  if (name === "Gengar VMAX") return "dark";
  if (name === "Dragonite V") return "dragon";
  return POKEDEX[pokemon][1];
}

function numberSlug(n: string) {
  return n.split("/")[0].toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function makeCard(
  set: SetSeed,
  number: string,
  name: string,
  code: RarityCode,
  value: number,
  variant: string | null,
  category: Category,
  extra: { grade?: string; releaseYear?: number; slug?: string; externalId?: string | null } = {},
): CardSeed {
  const pokemon = pokemonFromName(name);
  return {
    slug: extra.slug ?? `${set.code}-${numberSlug(number)}`,
    set: set.code,
    number,
    name,
    pokemon,
    variant,
    rarity: RARITY_FROM_CODE[code],
    energyType: energyTypeFor(name, pokemon),
    dexNumber: pokemon ? POKEDEX[pokemon][0] : null,
    value,
    grade: extra.grade ?? null,
    releaseYear: extra.releaseYear ?? set.releaseYear,
    category,
    externalId: extra.externalId === undefined ? null : extra.externalId,
  };
}

const setByCode = new Map(SETS.map((s) => [s.code, s]));

function vintageSet(code: string, total: number, rows: Row[]): CardSeed[] {
  const set = setByCode.get(code)!;
  return rows.map(([num, name, rarity, value, variant]) =>
    makeCard(set, `${num}/${total}`, name, rarity, value, variant ?? null, "VINTAGE", {
      externalId: `${code}-${num}`,
    }),
  );
}

export function buildCatalog(): CardSeed[] {
  const cards: CardSeed[] = [
    ...vintageSet("base1", 102, BASE_SET),
    ...vintageSet("base2", 64, JUNGLE),
    ...vintageSet("base3", 62, FOSSIL),
  ];
  for (const [code, number, name, rarity, value, variant, category] of SPECIALS) {
    const set = setByCode.get(code)!;
    const slug = code === "promo" ? "promo-pikachu-illustrator" : undefined;
    cards.push(
      makeCard(set, number, name, rarity, value, variant, category, {
        slug,
        grade: code === "promo" ? "PSA 9" : undefined,
      }),
    );
  }
  const vault = setByCode.get("vault")!;
  VAULT.forEach(([number, name, variant, grade, rarity, value, year], i) => {
    cards.push(
      makeCard(vault, number, name, rarity, value, variant, "GRADED", {
        grade,
        releaseYear: year,
        slug: `vault-${String(i + 1).padStart(2, "0")}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      }),
    );
  });
  const slugs = new Set<string>();
  for (const c of cards) {
    if (slugs.has(c.slug)) throw new Error(`Duplicate card slug ${c.slug}`);
    slugs.add(c.slug);
  }
  return cards;
}
