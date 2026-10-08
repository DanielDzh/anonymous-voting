/**
 * Playful game-show music for the results show, synthesised with Web Audio (no files, no
 * licensing): an oom-pah bass with a bouncy 8-bit melody, a drumroll for the breakaway and a
 * fanfare for the winner. Browsers only allow sound after a user gesture, so it's created on
 * the host's first key press / click.
 */

export type MusicMode = "calm" | "race";

const NOTE = (name: string) => {
  const steps: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  const octave = Number(name.slice(-1));
  return 440 * 2 ** ((steps[name[0]] + (name[1] === "#" ? 1 : 0) + (octave - 4) * 12) / 12);
};

/** Two bars of eighth notes; "-" is a rest. */
const BASS = ["C3", "-", "G2", "-", "A2", "-", "G2", "-", "F2", "-", "C3", "-", "G2", "-", "G2", "-"];
const CHORD = [
  ["E4", "G4"], null, ["E4", "G4"], null, ["E4", "A4"], null, ["D4", "G4"], null,
  ["F4", "A4"], null, ["E4", "G4"], null, ["D4", "F4"], null, ["D4", "G4"], null,
] as const;
const MELODY = ["C5", "E5", "G5", "E5", "A5", "G5", "E5", "C5", "F5", "A5", "C6", "A5", "G5", "-", "B4", "D5"];
const FANFARE: [string, number][] = [
  ["G4", 0.12], ["C5", 0.12], ["E5", 0.12], ["G5", 0.36], ["E5", 0.12], ["G5", 0.9],
];

const TEMPO = { calm: 104, race: 128, raceMax: 168 } as const;
const LOOKAHEAD_SECONDS = 0.15;

export const createRevealMusic = () => {
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new Context();
  const master = context.createGain();
  master.gain.value = 0.32;
  master.connect(context.destination);

  // Short white-noise buffer for hats and the drumroll.
  const noise = context.createBuffer(1, context.sampleRate * 0.5, context.sampleRate);
  const channel = noise.getChannelData(0);
  for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;

  const tone = (frequency: number, at: number, length: number, type: OscillatorType, volume: number) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    oscillator.connect(gain).connect(master);
    oscillator.start(at);
    oscillator.stop(at + length + 0.05);
  };

  const hit = (at: number, length: number, volume: number, highpass: number) => {
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = highpass;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    source.connect(filter).connect(gain).connect(master);
    source.start(at);
    source.stop(at + length + 0.02);
  };

  let mode: MusicMode = "calm";
  let intensity = 0;
  let playing = true;
  let step = 0;
  let nextAt = context.currentTime + 0.1;
  let rollUntil = 0;

  const tempo = () => (mode === "race" ? TEMPO.race + (TEMPO.raceMax - TEMPO.race) * intensity : TEMPO.calm);

  const schedule = () => {
    while (nextAt < context.currentTime + LOOKAHEAD_SECONDS) {
      const eighth = 60 / tempo() / 2;
      const index = step % BASS.length;
      if (playing) {
        const bass = BASS[index];
        if (bass !== "-") tone(NOTE(bass), nextAt, eighth * 1.6, "square", 0.16);
        // Off-beat "pah" stabs (the chord of the beat before).
        const chord = index % 2 === 1 ? CHORD[index - 1] : null;
        chord?.forEach((note) => tone(NOTE(note), nextAt, eighth * 0.6, "triangle", 0.08));
        hit(nextAt, 0.04, index % 2 === 1 ? 0.12 : 0.05, 7000);
        if (mode === "race") {
          const note = MELODY[index];
          if (note !== "-") tone(NOTE(note), nextAt, eighth * 0.9, "square", 0.07);
          if (index % 4 === 0) hit(nextAt, 0.12, 0.22, 900); // snare-ish
        }
      }
      if (nextAt < rollUntil) {
        // Drumroll: fast noise hits getting louder.
        for (let i = 0; i < 4; i++) hit(nextAt + (eighth / 4) * i, 0.05, 0.1 + 0.3 * intensity, 1500);
      }
      nextAt += eighth;
      step++;
    }
  };
  const timer = window.setInterval(schedule, 40);

  return {
    resume: () => void context.resume(),
    setMode: (next: MusicMode) => {
      if (next !== mode) step = 0;
      mode = next;
      if (next === "calm") intensity = 0;
    },
    /** 0…1 — the race speeds up as it goes. */
    setIntensity: (value: number) => {
      intensity = Math.min(Math.max(value, 0), 1);
    },
    drumroll: (seconds: number) => {
      rollUntil = context.currentTime + seconds;
    },
    fanfare: () => {
      rollUntil = 0;
      playing = false;
      let at = context.currentTime + 0.05;
      FANFARE.forEach(([note, length]) => {
        tone(NOTE(note), at, length + 0.25, "square", 0.14);
        tone(NOTE(note) / 2, at, length + 0.25, "triangle", 0.12);
        at += length;
      });
      // Final chord + crash.
      ["C5", "E5", "G5", "C6"].forEach((note) => tone(NOTE(note), at, 1.6, "triangle", 0.1));
      hit(at, 1.2, 0.35, 3000);
      window.setTimeout(() => {
        playing = true;
        mode = "calm";
        step = 0;
      }, (at - context.currentTime + 1.4) * 1000);
    },
    setMuted: (muted: boolean) => {
      master.gain.setTargetAtTime(muted ? 0 : 0.32, context.currentTime, 0.05);
    },
    dispose: () => {
      window.clearInterval(timer);
      void context.close();
    },
  };
};

export type RevealMusic = ReturnType<typeof createRevealMusic>;
