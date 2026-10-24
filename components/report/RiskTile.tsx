// One tile in the "Climate Risk Summary" 2x2 grid.
import { TONE_TEXT, TONE_TILE, type Level, type Tone } from "@/components/report/levels";
import Icon, { type IconName } from "@/components/ui/Icon";
import { card } from "@/components/ui/classes";

interface RiskTileProps {
  icon: IconName;
  label: string;
  level: Level | null;
  tone: Tone;
  /** Shown as a small "Sample" tag when the value is a placeholder. */
  sample?: boolean;
  /** Shown instead of a level when there is no data. */
  emptyText?: string;
}

export default function RiskTile({ icon, label, level, tone, sample = false, emptyText = "Coming soon" }: RiskTileProps) {
  return (
    <div className={`${card} flex items-center gap-3 p-3.5`}>
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${TONE_TILE[tone]}`}>
        <Icon name={icon} size={20} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-ink-dim">{label}</p>
        <p className={`flex items-center gap-1.5 font-display text-base font-semibold ${level ? TONE_TEXT[tone] : "text-ink-mute"}`}>
          {level ?? emptyText}
          {sample ? (
            <span className="rounded bg-white/10 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-ink-dim">
              Sample
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
