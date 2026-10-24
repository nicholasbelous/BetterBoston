// Shared class strings so buttons and cards look the same on every screen.
// Tap targets are at least 44px tall.

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint";

export const btnPrimary = `inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-mint px-5 text-[15px] font-semibold text-navy-950 shadow-[0_8px_28px_-10px_rgb(62_230_180/0.7)] transition hover:bg-mint-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;

export const btnGhost = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-white/[0.03] px-4 text-sm font-medium text-ink transition hover:bg-white/[0.07] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;

export const iconBtn = `inline-flex size-11 items-center justify-center rounded-xl border border-line bg-navy-800/80 text-ink backdrop-blur transition hover:bg-navy-700 ${focus}`;

export const card = "rounded-2xl border border-line bg-navy-800/70 backdrop-blur-sm";

export const eyebrowPill =
  "inline-flex items-center rounded-full border border-mint/30 bg-mint-tint px-3 py-1 text-xs font-medium text-mint";
