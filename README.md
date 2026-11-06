# Campus Styles
Modern fashion eCommerce platform built with HTML, CSS, JavaScript, Node.js, Express and MySQL.

## Production API configuration

The frontend defaults to the same-origin `/api` path in production; configure the web server or reverse proxy to route `/api` and `/uploads` to the backend. For a separately hosted backend, set `configuredApiBase` in `frontend/public/js/config.js` to its HTTPS API URL ending in `/api` (for example, `https://api.example.com/api`). The admin page and storefront use this shared setting.

In production, set `FRONTEND_URL` to the frontend's HTTPS origin (no path) and configure the required database, JWT, SMTP, and email environment variables before starting the server. Set `TRUST_PROXY` for your hosting topology: use `0` for direct connections, a hop count only when the number of trusted proxy hops is fixed, or trusted proxy IPs/subnets where available. Do not use `true`. If M-Pesa is enabled, configure its required credentials and callback settings as well.

The backend waits for MySQL before listening, and `/api/health` checks database readiness. If your platform uses ephemeral disks, mount persistent storage and set `UPLOADS_DIR` to that mount; for multiple backend instances, use shared storage or object storage so every instance can serve uploaded product images. Verify the deployment with `https://<backend-host>/api/health`; browser API calls must use HTTPS.

## Offline storefront

The frontend registers a service worker on HTTPS (and localhost) to cache its page shell and local assets. Previously retrieved product queries/details are cached in the browser so they may be viewed offline. The first visit must be online to install the cache; external fonts/icons and uncached images may not be available without a connection. Authentication, stock/price verification, admin actions, orders, and payments still require the live API and are never queued or submitted offline.
