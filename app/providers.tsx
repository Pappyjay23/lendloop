"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useState } from "react";
import { Toaster } from "sonner";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function Providers({ children }: { children: React.ReactNode }) {
  if (!convexUrl || !clerkKey) {
    return <SetupNotice hasConvex={Boolean(convexUrl)} hasClerk={Boolean(clerkKey)} />;
  }

  return (
    <ConfiguredProviders convexUrl={convexUrl} clerkKey={clerkKey}>
      {children}
    </ConfiguredProviders>
  );
}

function ConfiguredProviders({
  children,
  convexUrl,
  clerkKey,
}: {
  children: React.ReactNode;
  convexUrl: string;
  clerkKey: string;
}) {
  const [client] = useState(() => new ConvexReactClient(convexUrl));

  return (
    <ClerkProvider
      publishableKey={clerkKey}
      afterSignOutUrl="/"
      appearance={{
        variables: {
          colorPrimary: "#c2542a",
          colorForeground: "#1a1712",
          colorMutedForeground: "#5f574a",
          colorBackground: "#fffcf6",
          colorInput: "#fffdfa",
          colorInputForeground: "#1a1712",
          colorNeutral: "#1a1712",
          borderRadius: "10px",
          fontFamily: "var(--font-inter)",
        },
        elements: {
          card: "shadow-none bg-transparent",
          cardBox: "shadow-none",
          headerTitle: "font-[family-name:var(--font-display)] tracking-tight",
          formButtonPrimary:
            "bg-[#1a1712] hover:bg-[#c2542a] transition-colors text-[#fffcf6] shadow-none",
          footerActionLink: "text-[#c2542a] hover:text-[#a9461f]",
        },
      }}
    >
      <ConvexProviderWithClerk client={client} useAuth={useAuth}>
        {children}
        <Toaster
          position="bottom-right"
          theme="light"
          toastOptions={{
            style: {
              background: "var(--surface)",
              border: "1px solid var(--line)",
              color: "var(--ink)",
              borderRadius: "12px",
              boxShadow: "var(--shadow-card)",
            },
          }}
        />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

function SetupNotice({ hasConvex, hasClerk }: { hasConvex: boolean; hasClerk: boolean }) {
  const missing = [!hasConvex && "NEXT_PUBLIC_CONVEX_URL", !hasClerk && "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]
    .filter(Boolean)
    .join(", ");

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="w-full max-w-xl">
        <p className="eyebrow mb-3">LendLoop · setup</p>
        <h1 className="text-3xl leading-tight sm:text-4xl">
          Almost there — the app needs its two service keys.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
          Missing <code className="rounded bg-paper-deep px-1.5 py-0.5 font-mono text-[13px]">{missing}</code>.
          Copy <code className="rounded bg-paper-deep px-1.5 py-0.5 font-mono text-[13px]">.env.example</code> to{" "}
          <code className="rounded bg-paper-deep px-1.5 py-0.5 font-mono text-[13px]">.env.local</code>, fill in the
          Clerk keys, then run:
        </p>
        <pre className="mt-5 overflow-x-auto rounded-xl border border-line bg-[#1a1712] p-4 font-mono text-[13px] leading-relaxed text-[#f5efe3]">
          <code>{`npx convex dev   # writes NEXT_PUBLIC_CONVEX_URL
npm run dev      # http://localhost:3000`}</code>
        </pre>
        <p className="mt-5 text-sm text-ink-soft">
          Full instructions live in the <span className="link-underline">README</span>.
        </p>
      </div>
    </main>
  );
}
