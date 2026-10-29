"use client";

/**
 * Tiny Web Audio synthesiser for UI sound effects. Everything is generated at
 * runtime, so there are no audio assets to license or download.
 */
import { usePreferences } from "@/stores/preferences";

export type SoundName = "tear" | "flip" | "common" | "rare" | "ultra" | "secret" | "chase" | "coin" | "click" | "whoosh" | "error";

let ctx: AudioContext | null = null;

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(ac: AudioContext, out: AudioNode, freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.25, slideTo?: number) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(out);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function noise(ac: AudioContext, out: AudioNode, start: number, dur: number, gain = 0.3, filterFreq = 2400) {
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  filter.Q.value = 0.8;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filter).connect(g).connect(out);
  src.start(start);
}

export function playSound(name: SoundName) {
  const { muted, volume } = usePreferences.getState();
  if (muted || volume <= 0) return;
  const ac = audio();
  if (!ac) return;
  const master = ac.createGain();
  master.gain.value = volume * 0.8;
  master.connect(ac.destination);
  const t = ac.currentTime + 0.01;
  switch (name) {
    case "click":
      tone(ac, master, 660, t, 0.06, "triangle", 0.12);
      break;
    case "whoosh":
      noise(ac, master, t, 0.35, 0.18, 900);
      break;
    case "tear":
      noise(ac, master, t, 0.18, 0.4, 3200);
      noise(ac, master, t + 0.12, 0.28, 0.35, 1800);
      tone(ac, master, 180, t, 0.25, "sawtooth", 0.05, 90);
      break;
    case "flip":
      noise(ac, master, t, 0.08, 0.22, 4200);
      tone(ac, master, 520, t, 0.07, "triangle", 0.08, 780);
      break;
    case "common":
      tone(ac, master, 523.25, t, 0.18, "sine", 0.12);
      break;
    case "rare":
      [523.25, 659.25, 783.99].forEach((f, i) => tone(ac, master, f, t + i * 0.07, 0.3, "triangle", 0.14));
      break;
    case "ultra":
      [587.33, 739.99, 880, 1174.66].forEach((f, i) => tone(ac, master, f, t + i * 0.08, 0.45, "triangle", 0.16));
      tone(ac, master, 1760, t + 0.32, 0.6, "sine", 0.06);
      break;
    case "secret":
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(ac, master, f, t + i * 0.06, 0.6, "sine", 0.15));
      [1567.98, 2093].forEach((f, i) => tone(ac, master, f, t + 0.35 + i * 0.1, 0.5, "triangle", 0.07));
      break;
    case "chase":
      noise(ac, master, t, 0.6, 0.25, 600);
      [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ac, master, f, t + i * 0.11, 0.8, "sawtooth", 0.07));
      [1046.5, 1318.5, 1567.98, 2093].forEach((f, i) => tone(ac, master, f, t + 0.6 + i * 0.09, 0.9, "triangle", 0.12));
      break;
    case "coin":
      tone(ac, master, 987.77, t, 0.08, "square", 0.08);
      tone(ac, master, 1318.5, t + 0.07, 0.25, "square", 0.08);
      break;
    case "error":
      tone(ac, master, 220, t, 0.18, "sawtooth", 0.08, 150);
      break;
  }
}

export function soundForRarity(rarity: string): SoundName {
  switch (rarity) {
    case "CHASE":
      return "chase";
    case "SECRET_RARE":
      return "secret";
    case "ULTRA_RARE":
      return "ultra";
    case "RARE":
      return "rare";
    default:
      return "common";
  }
}
