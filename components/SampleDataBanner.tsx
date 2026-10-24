// Banner shown on every page that displays scores while metadata.is_sample is true.
// Sample data must never look like real results.
import Icon from "@/components/ui/Icon";

interface SampleDataBannerProps {
  show?: boolean;
  /** Extra sentence for screens with more mock content (e.g. "Flood and air quality are placeholders."). */
  note?: string;
}

export default function SampleDataBanner({ show = true, note }: SampleDataBannerProps) {
  if (!show) return null;
  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-xl border border-alert/50 bg-alert/10 px-3.5 py-2.5 text-[13px] leading-snug text-[#ffb4aa]"
    >
      <Icon name="alert" size={18} className="mt-px shrink-0" />
      <p>
        <strong className="font-semibold text-[#ffd0ca]">SAMPLE DATA:</strong> these scores are made up
        for testing. They are not real results.
        {note ? ` ${note}` : ""}
      </p>
    </div>
  );
}
