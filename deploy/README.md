# Outpace invitation hosting

Prepared October 13, 2026 from website source `b8e2dd3ca28580f8cecef8c9142aaa23bf20fa87`, the exact source named in the October 12 Health-privacy deployment receipt. The original checkout and its parent worker/config were preserved.

This directory brings the existing `outpace-website` worker and custom-domain configuration into the website repository. Public Cloudflare account/zone identifiers identify the existing deployment; no token or credential is saved here. The assets directory is now `../dist`, relative to this config. Build the site before a reviewed Wrangler dry run or deployment.

## Invitation route

- `/i/<32 hex characters>` renders a generic first-party preview and an explicit **Open Outpace** link using the existing `outpace://invite?code=...` fallback.
- The page does not fetch a person's identity, accept friendships, set cookies, run JavaScript or claim installation recovery. The app verifies the invitation after sign-in; acceptance is explicit.
- Invitation pages return `no-store`, `no-referrer` and `noindex`. Existing public routes, policies and Clerk DNS configuration are preserved. No custom URL/token logging is added.
- Invalid invitation paths return 404; unsupported methods return 405. No bearer token is inserted into social metadata. No guessed or unpublished store links are presented.
- After installation, return to the original message and open it again. Universal links do not provide automatic deferred installation recovery.

## Native association

`public/.well-known/apple-app-site-association` allows only `/i/*` for `FBBT7DGB33.com.virtualpiratesllc.imessagewalkingapp`.

`public/.well-known/assetlinks.json` intentionally supports only the existing controlled Android tester signer for `com.virtualpiratesllc.outpace`:

`FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`

This is the certificate independently recorded in native build 28; it is **not Google Play production signing**. Replace or extend the association only after the actual Play signer is established and approved. The app's verified HTTPS intent filter additionally restricts native routing to `/i/`.

The worker serves both association files as HTTP 200 `application/json` without a redirect on the canonical host. Before enabling HTTPS in outbound native sharing, verify live HTTPS landing/assets/association responses, the actual signed entitlements and installation routing. Existing installed packages do not acquire new native associations from a website change alone.

## Review and rollout

1. Review this branch and compare the current live Cloudflare worker/version with the recorded baseline. Preserve a rollback version.
2. Build with the existing dependencies. Review the added landing and worker's request behavior locally.
3. Run a reviewed Wrangler dry run using `deploy/wrangler.json`; confirm the hidden `.well-known` JSON files and extensionless AASA are included in the asset manifest.
4. Deploy only after the owning task's review. Verify the canonical host responds 200 with correct content types, no unexpected redirects, token-safe fallback and existing policy pages intact.
5. Enable the app's outbound HTTPS gate only after live verification; build/install packages containing the associations and `/i/[code]` alias.
6. Verify actual Messages-to-app navigation, signed-out/onboarding/Google-return restoration, revoked/expired invitations and explicit acceptance. Android hardware and Play signer remain separate acceptance gates.

No deployment, store availability or native routing acceptance is established by this prepared source.
