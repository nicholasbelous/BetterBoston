// Logo + name. Plain server markup so it can render before the page hydrates.
import Link from "next/link";
import Icon from "@/components/ui/Icon";

export default function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label="BetterBoston home">
      <span className="grid size-8 place-items-center rounded-lg bg-mint-tint text-mint">
        <Icon name="leaf" size={20} />
      </span>
      <span className="font-display text-[17px] font-semibold tracking-tight">BetterBoston</span>
    </Link>
  );
}
