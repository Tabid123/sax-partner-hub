const OFFLINE_CACHE_KEYS = [
  'offline_providers',
  'offline_categories',
  'offline_packages',
  'offline_payment_providers',
  'offline_delivery_instructions',
  'offline_banners',
  'offline_app_settings',
  'offline_cache_timestamp',
];

/** Drops the cached storefront data, which is tenant-specific. */
export const clearOfflineCache = () => {
  try {
    OFFLINE_CACHE_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
};

/** Clears any locally saved tenant selection (used on logout / failed sign-in). */
export const clearTenantSelection = () => {
  try {
    localStorage.removeItem('active_tenant_id');
    localStorage.removeItem('public_tenant_slug');
  } catch {
    /* ignore */
  }
  clearOfflineCache();
};
