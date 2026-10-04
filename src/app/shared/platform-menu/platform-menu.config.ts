import { MenuAppConfig } from '@taliferro/ui/platform/universal-menu.model';

/** Maya's part of the universal menu: what you can do in Maya. */
export const PLATFORM_MENU_CONFIG: MenuAppConfig = {
  app: 'maya',
  name: 'Maya',
  items: [
    { label: 'Home', icon: 'home', route: '/' },
    { label: 'Status', icon: 'chart', route: '/marketing-employee', keywords: 'report progress' },
    { label: 'Plan', icon: 'file', route: '/marketing-employee/plan', keywords: 'marketing plan board' },
    { label: 'Work', icon: 'grid', route: '/work', keywords: 'tasks projects' },
  ],
  secondaryItems: [
    { label: 'Profile', icon: 'user', route: '/profile' },
    { label: 'Pricing', icon: 'card', route: '/pricing', keywords: 'plans billing' },
    { label: 'Help', icon: 'help', route: '/help' },
    { label: 'About', icon: 'info', route: '/about' },
  ],
  signInRoute: '/get-started',
  profileRoute: '/profile',
};
