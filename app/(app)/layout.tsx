"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/app-shell";
import { LogoMark } from "@/components/brand";
import { buttonClasses } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const sync = useMutation(api.users.sync);
  const me = useQuery(api.users.me);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    sync({}).catch((error) => {
      if (!cancelled) setSyncError(errorMessage(error));
    });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, sync]);

  if (syncError) {
    return (
      <Centered>
        <div className="card-surface max-w-md p-7 text-center">
          <h1 className="font-display text-xl">We couldn&apos;t finish setting up your account</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{syncError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={`${buttonClasses("primary", "sm")} mt-5`}
          >
            Try again
          </button>
        </div>
      </Centered>
    );
  }

  if (!isLoaded || me === undefined || me === null) {
    return (
      <Centered>
        <div className="flex flex-col items-center gap-3 text-ink-faint">
          <LogoMark className="h-9 w-9 animate-pulse" />
          <p className="font-mono text-[11px] uppercase tracking-[0.18em]">Opening the loop</p>
        </div>
      </Centered>
    );
  }

  return <AppShell user={me}>{children}</AppShell>;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-dvh place-items-center px-6">{children}</div>;
}
