import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export function fail(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  return adminEmails().includes(email.trim().toLowerCase());
}

export function displayName(identity: {
  name?: string | null;
  email?: string | null;
}): string {
  const name = identity.name?.trim();
  if (name) return name;
  const email = identity.email?.trim();
  if (email) return email.split("@")[0];
  return "Neighbour";
}

export async function findUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
}

export async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const user = await findUser(ctx);
  if (!user) {
    fail("NOT_SYNCED", "Your account is still syncing. Refresh in a moment.");
  }
  return user;
}

/**
 * Every write path funnels through here. Names, emails and roles come from the
 * verified Clerk identity on the server — never from client-supplied args.
 */
export async function requireUserForWrite(ctx: MutationCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    fail("UNAUTHENTICATED", "Sign in to continue.");
  }

  const existing = await findUser(ctx);
  const email = (identity.email ?? existing?.email ?? "").trim().toLowerCase();
  if (!email) {
    fail(
      "EMAIL_CLAIM_MISSING",
      "Your Clerk session has no email claim. Add email to the `convex` JWT template.",
    );
  }

  const now = Date.now();
  const name = displayName({ name: identity.name, email });
  const imageUrl = identity.pictureUrl ?? undefined;
  const role = isAdminEmail(email) ? ("admin" as const) : ("user" as const);

  if (existing) {
    await ctx.db.patch(existing._id, {
      clerkId: identity.subject,
      email,
      name,
      imageUrl,
      role,
      updatedAt: now,
    });
    return { ...existing, clerkId: identity.subject, email, name, imageUrl, role, updatedAt: now };
  }

  const id = await ctx.db.insert("users", {
    tokenIdentifier: identity.tokenIdentifier,
    clerkId: identity.subject,
    email,
    name,
    imageUrl,
    role,
    trustedLender: false,
    createdAt: now,
    updatedAt: now,
  });
  const created = await ctx.db.get(id);
  if (!created) {
    fail("USER_CREATE_FAILED", "Could not create your account. Please retry.");
  }
  return created;
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "admin") {
    fail("FORBIDDEN", "This action requires an admin account.");
  }
  return user;
}

export async function requireAdminForWrite(ctx: MutationCtx): Promise<Doc<"users">> {
  const user = await requireUserForWrite(ctx);
  if (user.role !== "admin") {
    fail("FORBIDDEN", "This action requires an admin account.");
  }
  return user;
}
