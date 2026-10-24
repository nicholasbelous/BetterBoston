import type { IconName } from "@/components/ui/Icon";

export interface NavItem {
  href: string;
  label: string;
  /** Longer label for the desktop nav and the menu. */
  longLabel: string;
  icon: IconName;
}

// The screens, in the order of the user journey.
// Turned off for the hackathon demo (not ready in time): /improvements ("Before & after")
// and /actions ("Recommended actions"). Their pages redirect to /report, and the real
// action plan lives in the report's Recommendations tab. To bring them back, re-add:
//   { href: "/improvements", label: "Improve", longLabel: "Before & after", icon: "compare" },
//   { href: "/actions", label: "Actions", longLabel: "Recommended actions", icon: "bulb" },
// and restore app/improvements/page.tsx and app/actions/page.tsx from git.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Search", longLabel: "Search an address", icon: "search" },
  { href: "/map", label: "Map", longLabel: "Climate map", icon: "map" },
  { href: "/report", label: "Analysis", longLabel: "Home analysis", icon: "home" },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
