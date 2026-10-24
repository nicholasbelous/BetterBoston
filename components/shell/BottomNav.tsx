"use client";
// Mobile tab bar for the five screens. Hidden on the landing page and from tablet up.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "@/components/shell/navItems";
import Icon from "@/components/ui/Icon";
import { useScreenHref } from "@/hooks/useScreenHref";

export default function BottomNav() {
  const pathname = usePathname();
  const href = useScreenHref();
  if (pathname === "/" || pathname === "/about") return null;

  return (
    <nav
      aria-label="Screens"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-navy-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={href(item.href)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${
                  active ? "text-mint" : "text-ink-mute hover:text-ink-dim"
                }`}
              >
                <Icon name={item.icon} size={22} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
