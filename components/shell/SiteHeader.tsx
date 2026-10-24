"use client";
// Top bar: brand + menu on mobile, full nav on tablet and desktop.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Brand from "@/components/shell/Brand";
import { NAV_ITEMS, isActive } from "@/components/shell/navItems";
import Icon from "@/components/ui/Icon";
import { useScreenHref } from "@/hooks/useScreenHref";

export default function SiteHeader() {
  const pathname = usePathname();
  const href = useScreenHref();
  // The menu is "open" only for the page it was opened on, so it closes itself on navigation.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenPath(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-navy-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5">
        <Brand />

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={href(item.href)}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-mint-tint text-mint" : "text-ink-dim hover:bg-white/5 hover:text-ink"
                }`}
              >
                {item.longLabel}
              </Link>
            );
          })}
          <Link
            href="/about"
            aria-current={pathname === "/about" ? "page" : undefined}
            className="rounded-lg px-3 py-2 text-sm font-medium text-ink-dim transition hover:bg-white/5 hover:text-ink"
          >
            About the data
          </Link>
        </nav>

        <button
          type="button"
          className="grid size-11 place-items-center rounded-xl text-ink transition hover:bg-white/5 md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpenPath(open ? null : pathname)}
        >
          <Icon name={open ? "close" : "menu"} size={24} />
        </button>
      </div>

      {open ? (
        <nav
          id="mobile-menu"
          aria-label="Menu"
          className="rise-in border-t border-line bg-navy-900/95 px-3 pb-4 pt-2 backdrop-blur-xl md:hidden"
        >
          <ul className="mx-auto flex max-w-md flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={href(item.href)}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-medium ${
                      active ? "bg-mint-tint text-mint" : "text-ink hover:bg-white/5"
                    }`}
                  >
                    <Icon name={item.icon} size={20} />
                    {item.longLabel}
                  </Link>
                </li>
              );
            })}
            <li>
              <Link
                href="/about"
                className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-ink hover:bg-white/5"
              >
                <Icon name="info" size={20} />
                About the data
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
