# Website smoke check

Requires Node.js and Playwright with Chromium installed in your development environment. The website itself has no runtime dependencies.

```sh
node .checks/site-smoke.mjs
```

For a separately installed Playwright module or system Chrome, set `PLAYWRIGHT_MODULE` to the module's absolute path and `CHROME_PATH` to the browser executable. `SCREENSHOT_DIR` optionally saves desktop and mobile screenshots. Use `CHROME_NO_SANDBOX=1` only when required by an isolated test environment.

The check starts a temporary local HTTP server. It checks all eight product pages at five widths, metadata, local links and anchors, image loading, shared footer links, browser errors, mobile navigation, preview controls, FAQs, support form validation, stale draft prevention, clipboard fallback, and navigation without JavaScript. It never sends email or submits a report.

This hidden directory is excluded from Firebase Hosting by the existing `**/.*` ignore rule.
