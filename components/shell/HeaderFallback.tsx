// Shown in the server HTML while SiteHeader (which reads the URL) hydrates, so the
// logo and menu icon are there on first paint instead of popping in late.
import Brand from "@/components/shell/Brand";
import Icon from "@/components/ui/Icon";

export default function HeaderFallback() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-navy-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5">
        <Brand />
        {/* Not interactive yet: the real menu button replaces this within a moment. */}
        <span aria-hidden="true" className="grid size-11 place-items-center text-ink md:hidden">
          <Icon name="menu" size={24} />
        </span>
      </div>
    </header>
  );
}
