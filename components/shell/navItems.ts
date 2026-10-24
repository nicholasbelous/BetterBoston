import type { IconName } from "@/components/ui/Icon";

export interface NavItem {
  href: string;
  label: string;
  /** Longer label for the desktop nav and the menu. */
  longLabel: string;
  icon: IconName;
}

// The five screens, in the order of the user journey.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Search", longLabel: "Search an address", icon: "search" },
  { href: "/map", label: "Map", longLabel: "Climate map", icon: "map" },
  { href: "/report", label: "Analysis", longLabel: "Home analysis", icon: "home" },
  { href: "/improvements", label: "Improve", longLabel: "Before & after", icon: "compare" },
  { href: "/actions", label: "Actions", longLabel: "Recommended actions", icon: "bulb" },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
