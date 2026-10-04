import { LayoutDashboard, Plus, Receipt, Settings, type LucideIcon } from "lucide-react";
import { it } from "@/lib/i18n/it";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Azione principale: in evidenza con il colore ambra. */
  primary?: boolean;
};

export const navItems: readonly NavItem[] = [
  { href: "/dashboard", label: it.nav.dashboard, icon: LayoutDashboard },
  { href: "/add", label: it.nav.add, icon: Plus, primary: true },
  { href: "/receipts", label: it.nav.receipts, icon: Receipt },
  { href: "/settings", label: it.nav.settings, icon: Settings },
];

/** Una voce è attiva sulla sua rotta e su tutte le sottorotte (es. /receipts/123). */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
