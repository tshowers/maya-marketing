import { ProductPagesConfig } from '@taliferro/ui/platform/product-pages.model';

/** Maya's Help and About pages (the shared template). */
export const PRODUCT_PAGES_CONFIG: ProductPagesConfig = {
  key: 'maya',
  logo: 'assets/find/entities/maya/logo-icon.png',
  logoFill: true,
  openRoute: '/',
  // Maya's header (with the Menu) is hidden on Help and About.
  ownMenu: true,
};
