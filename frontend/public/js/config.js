/* Set this to the HTTPS API URL when the frontend and backend use separate origins. */
const configuredApiBase = '';
const isLocalFrontend = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
const defaultApiBase = isLocalFrontend
  ? `http://${window.location.hostname}:5000/api`
  : `${window.location.origin}/api`;
const configuredUrl = configuredApiBase
  ? new URL(configuredApiBase, window.location.origin)
  : new URL(defaultApiBase, window.location.origin);
const isLoopbackApi = ['localhost', '127.0.0.1', '::1'].includes(configuredUrl.hostname);

if (
  !['http:', 'https:'].includes(configuredUrl.protocol) ||
  (configuredUrl.protocol !== 'https:' && !isLoopbackApi) ||
  configuredUrl.username ||
  configuredUrl.password ||
  configuredUrl.search ||
  configuredUrl.hash ||
  !configuredUrl.pathname.replace(/\/+$/, '').endsWith('/api')
) {
  throw new Error('Invalid API base URL. Use an HTTPS URL ending in /api (HTTP is allowed only for localhost development).');
}

window.CAMPUS_STYLES_API_BASE = `${configuredUrl.origin}${configuredUrl.pathname.replace(/\/+$/, '')}`;

const configScriptUrl = document.currentScript?.src;
if ('serviceWorker' in navigator && configScriptUrl && window.isSecureContext) {
  const appBaseUrl = new URL('../', configScriptUrl);
  const serviceWorkerUrl = new URL('service-worker.js', appBaseUrl);
  navigator.serviceWorker.register(serviceWorkerUrl, { scope: appBaseUrl.pathname })
    .catch((error) => console.error('Offline support could not be enabled:', error));
}

if (typeof document !== 'undefined' && document.body) {
  const connectivityBanner = document.createElement('div');
  connectivityBanner.id = 'connectivity-status';
  connectivityBanner.setAttribute('role', 'status');
  connectivityBanner.setAttribute('aria-live', 'polite');
  connectivityBanner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10000;padding:10px 16px;text-align:center;font:600 13px/1.4 Arial,sans-serif;background:#7c2d12;color:#fff;display:none;';
  document.body.prepend(connectivityBanner);

  let onlineMessageTimeout;
  const updateConnectivityStatus = (showOnlineMessage = false) => {
    clearTimeout(onlineMessageTimeout);
    if (!navigator.onLine) {
      connectivityBanner.textContent = 'You are offline. Cached pages and products may be available; ordering and payments need a connection.';
      connectivityBanner.style.background = '#7c2d12';
      connectivityBanner.style.display = 'block';
      return;
    }
    if (showOnlineMessage) {
      connectivityBanner.textContent = 'Connection restored.';
      connectivityBanner.style.background = '#166534';
      connectivityBanner.style.display = 'block';
      onlineMessageTimeout = setTimeout(() => {
        connectivityBanner.style.display = 'none';
      }, 3000);
      return;
    }
    connectivityBanner.style.display = 'none';
  };

  window.addEventListener('offline', () => updateConnectivityStatus());
  window.addEventListener('online', () => updateConnectivityStatus(true));
  updateConnectivityStatus();
}
