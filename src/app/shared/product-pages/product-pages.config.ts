import { ProductPagesConfig } from '@taliferro/ui/platform/product-pages.model';

/** Maya's Help and About pages (the shared template). */
export const PRODUCT_PAGES_CONFIG: ProductPagesConfig = {
  key: 'maya',
  logo: 'assets/brand/products/svg/light/03-marketing-assistant.svg',
  logoDark: 'assets/brand/products/svg/dark/03-marketing-assistant.svg',
  logoFill: true,
  openRoute: '/',
  // Maya's header (with the Menu) is hidden on Help and About.
  ownMenu: true,
};
