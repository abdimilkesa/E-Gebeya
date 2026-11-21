import {
  ClipboardList,
  FolderTree,
  LayoutDashboard,
  Package,
  Store,
  UserCircle,
  Users,
  UsersRound,
} from 'lucide-react';
import { lazy, type ComponentType } from 'react';
import { createBrowserRouter, Outlet, ScrollRestoration } from 'react-router';
import { GuestOnly, RequireRole, RequireSignedIn } from './auth/guards';
import { DashboardLayout, type DashboardNavItem } from './components/layout/DashboardLayout';
import { PublicLayout } from './components/layout/PublicLayout';
import { AccountPage } from './features/auth/AccountPage';
import { ChangePasswordPage } from './features/auth/ChangePasswordPage';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { CartPage } from './features/cart/CartPage';
import { CheckoutPage } from './features/cart/CheckoutPage';
import { HomeMapPage } from './features/discovery/HomeMapPage';
import { ProductPage } from './features/discovery/ProductPage';
import { SearchPage } from './features/discovery/SearchPage';
import { StorefrontPage } from './features/discovery/StorefrontPage';
import { NotFoundPage, RouteErrorPage } from './pages/ErrorPages';

/** Dashboards are split into their own chunks so shoppers never download them. */
function lazyPage<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M & string) {
  return lazy(async () => ({ default: (await load())[name] as ComponentType }));
}

const AdminOverviewPage = lazyPage(() => import('./features/admin/OverviewPage'), 'OverviewPage');
const AdminShopsPage = lazyPage(() => import('./features/admin/ShopsPage'), 'ShopsPage');
const AdminShopFormPage = lazyPage(() => import('./features/admin/ShopFormPage'), 'ShopFormPage');
const AdminMerchantsPage = lazyPage(() => import('./features/admin/MerchantsPage'), 'MerchantsPage');
const AdminMerchantDetailPage = lazyPage(() => import('./features/admin/MerchantDetailPage'), 'MerchantDetailPage');
const AdminCustomersPage = lazyPage(() => import('./features/admin/CustomersPage'), 'CustomersPage');
const AdminCategoriesPage = lazyPage(() => import('./features/admin/CategoriesPage'), 'CategoriesPage');
const AdminAuditLogPage = lazyPage(() => import('./features/admin/AuditLogPage'), 'AuditLogPage');

const MerchantDashboardPage = lazyPage(() => import('./features/merchant/DashboardPage'), 'DashboardPage');
const MerchantProductsPage = lazyPage(() => import('./features/merchant/ProductsPage'), 'ProductsPage');
const MerchantProductFormPage = lazyPage(() => import('./features/merchant/ProductFormPage'), 'ProductFormPage');
const MerchantShopPage = lazyPage(() => import('./features/merchant/ShopPage'), 'ShopPage');
const MerchantProfilePage = lazyPage(() => import('./features/merchant/ProfilePage'), 'ProfilePage');

const ADMIN_NAV: DashboardNavItem[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/shops', label: 'Shops', icon: Store },
  { to: '/admin/merchants', label: 'Merchants', icon: UsersRound },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/categories', label: 'Categories', icon: FolderTree },
  { to: '/admin/audit-log', label: 'Audit log', icon: ClipboardList },
];

const MERCHANT_NAV: DashboardNavItem[] = [
  { to: '/merchant', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/merchant/products', label: 'Products', icon: Package },
  { to: '/merchant/shop', label: 'My shop', icon: Store },
  { to: '/merchant/profile', label: 'Profile', icon: UserCircle },
];

function RootLayout() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { index: true, element: <HomeMapPage /> },
          { path: 'search', element: <SearchPage /> },
          { path: 'shops/:slug', element: <StorefrontPage /> },
          { path: 'products/:productId', element: <ProductPage /> },
          { path: 'cart', element: <CartPage /> },
          {
            path: 'checkout',
            element: (
              <RequireRole roles={['CUSTOMER']}>
                <CheckoutPage />
              </RequireRole>
            ),
          },
          {
            path: 'login',
            element: (
              <GuestOnly>
                <LoginPage />
              </GuestOnly>
            ),
          },
          {
            path: 'register',
            element: (
              <GuestOnly>
                <RegisterPage />
              </GuestOnly>
            ),
          },
          {
            path: 'account',
            element: (
              <RequireSignedIn>
                <AccountPage />
              </RequireSignedIn>
            ),
          },
          {
            path: 'account/change-password',
            element: (
              <RequireSignedIn>
                <ChangePasswordPage />
              </RequireSignedIn>
            ),
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        path: 'admin',
        element: (
          <RequireRole roles={['SUPER_ADMIN']}>
            <DashboardLayout area="Admin" nav={ADMIN_NAV} />
          </RequireRole>
        ),
        children: [
          { index: true, element: <AdminOverviewPage /> },
          { path: 'shops', element: <AdminShopsPage /> },
          { path: 'shops/new', element: <AdminShopFormPage /> },
          { path: 'shops/:shopId', element: <AdminShopFormPage /> },
          { path: 'merchants', element: <AdminMerchantsPage /> },
          { path: 'merchants/:merchantId', element: <AdminMerchantDetailPage /> },
          { path: 'customers', element: <AdminCustomersPage /> },
          { path: 'categories', element: <AdminCategoriesPage /> },
          { path: 'audit-log', element: <AdminAuditLogPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        path: 'merchant',
        element: (
          <RequireRole roles={['MERCHANT']}>
            <DashboardLayout area="Merchant" nav={MERCHANT_NAV} />
          </RequireRole>
        ),
        children: [
          { index: true, element: <MerchantDashboardPage /> },
          { path: 'products', element: <MerchantProductsPage /> },
          { path: 'products/new', element: <MerchantProductFormPage /> },
          { path: 'products/:productId', element: <MerchantProductFormPage /> },
          { path: 'shop', element: <MerchantShopPage /> },
          { path: 'profile', element: <MerchantProfilePage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
