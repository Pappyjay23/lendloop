import type { AuthConfig } from "convex/server";

/**
 * Clerk JWT template named "convex" with `aud: "convex"`.
 * The issuer domain is public metadata, not a secret.
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN ?? "",
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
