# 09 — Build & Security Headers

## Build Configuration

**File**: `next.config.js`

| Setting | Value | Rationale |
| --------- | ------- | ----------- |
| `reactStrictMode` | `false` | Disabled to avoid double-rendering side effects with Firebase auth listener |
| `swcMinify` | `true` | Rust-based SWC minifier (faster than Terser) |
| PWA plugin | `@ducanh2912/next-pwa` | Service worker generation + precaching |

---

## Security Headers

Applied to all routes via `next.config.js` headers config:

| Header | Value | Purpose |
| -------- | ------- | --------- |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME type sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking (iframe embedding) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer info to external sites |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Explicitly deny device APIs |
| `X-DNS-Prefetch-Control` | `on` | Enable DNS prefetch for performance |

---

## Linting

**ESLint** configured with:

- `eslint-config-next` — Next.js-specific rules

- `eslint-config-standard` — Standard JS style

- Plugins: `react`, `react-hooks`, `import`, `promise`, `node`

---

## Testing

> No testing framework is currently configured (no Jest, Vitest, or Playwright).
> This is a known gap — tests are planned for future iterations.

---

## Deployment

Build output is a standard Next.js production build:

```bash
npm run build    # Generates .next/ + public/sw.js
npm start        # Serves production build

```text
The PWA service worker (`public/sw.js`) is generated at build time with asset manifest.
