import { IconName } from '../shared/components/icon/icons';

export interface NavItem {
  label: string;
  link: string;
  icon: IconName;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', link: '/dashboard', icon: 'dashboard' },
  { label: 'Tournaments', link: '/tournaments', icon: 'trophy' },
  { label: 'Matches', link: '/matches', icon: 'versus' },
  { label: 'Teams', link: '/teams', icon: 'users' },
  { label: 'Players', link: '/players', icon: 'user' },
  { label: 'Statistics', link: '/statistics', icon: 'chart' },
];

/** The four always-visible items in the bottom bar; the rest live under "More". */
export const PRIMARY_MOBILE_ITEMS = NAV_ITEMS.slice(0, 4);
export const MORE_MOBILE_ITEMS = NAV_ITEMS.slice(4);
