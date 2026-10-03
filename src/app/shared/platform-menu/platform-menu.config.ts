import { MenuAppConfig } from '@taliferro/ui/platform/universal-menu.model';

/** Maya's part of the universal menu: what you can do in Maya. */
export const PLATFORM_MENU_CONFIG: MenuAppConfig = {
  app: 'maya',
  name: 'Maya',
  logo: 'assets/find/entities/maya/logo.png',
  items: [
    { label: 'Home', icon: 'home', route: '/' },
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
