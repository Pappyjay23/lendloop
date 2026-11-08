"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  ArrowUpRight,
  BellRing,
  CalendarCheck2,
  Check,
  ClipboardList,
  Repeat2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Wordmark } from "@/components/brand";
import { buttonClasses } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_META, type Category } from "@/lib/tool-meta";
import { cn } from "@/lib/cn";

export default function HomePage() {
  const { isSignedIn } = useAuth();
  const tools = useQuery(api.tools.listPublic);
  const [filter, setFilter] = useState<Category | "all">("all");

  const categoriesPresent = useMemo(() => {
    const seen = new Set<Category>();
    for (const tool of tools ?? []) seen.add(tool.category);
    return Array.from(seen);
  }, [tools]);

  const visible = (tools ?? []).filter((tool) => filter === "all" || tool.category === filter);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <Wordmark />
          <nav className="hidden items-center gap-7 text-[13px] text-ink-soft sm:flex">
            <a href="#how" className="link-underline">
              How it works
            </a>
            <a href="#tools" className="link-underline">
              Available tools
            </a>
            <a href="#trust" className="link-underline">
              Privacy &amp; automation
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {isSignedIn ? (
              <Link href="/browse" className={buttonClasses("primary", "sm")}>
                Open the board
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className={cn(buttonClasses("ghost", "sm"), "hidden sm:inline-flex")}
                >
                  Sign in
                </Link>
                <Link href="/sign-up" className={buttonClasses("primary", "sm")}>
                  Join LendLoop
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-14 px-5 pb-20 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20">
          <div className="animate-rise">
            <p className="eyebrow flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              A neighbourhood tool library
            </p>
            <h1 className="mt-5 text-balance text-[42px] leading-[1.02] sm:text-[56px] lg:text-[62px]">
              Borrow what you need.
              <br />
              <span className="italic text-accent">Lend what you don&apos;t.</span>
            </h1>
            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-ink-soft sm:text-base">
              The drill you use twice a year. The ladder taking up half the shed. LendLoop
              connects neighbours who have tools with neighbours who need them — and handles
              the reminders so nobody has to chase anyone.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {isSignedIn ? (
                <Link href="/browse" className={buttonClasses("primary", "lg")}>
                  Open the board
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link href="/sign-in" className={buttonClasses("primary", "lg")}>
                  Sign in to lend or borrow
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <a href="#tools" className={buttonClasses("outline", "lg")}>
                See what&apos;s available
              </a>
            </div>

            <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-ink-soft">
              {["No fees, ever", "Neighbour-run", "Reminders handled for you"].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-moss" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <HeroCard />
        </section>

        <section className="border-y border-line bg-surface/50">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-2 divide-line px-5 sm:grid-cols-4 sm:divide-x">
            <Stat label="Tools on the board" value={tools ? String(tools.length) : "—"} />
            <Stat label="Categories" value={tools ? String(categoriesPresent.length) : "—"} />
            <Stat label="Fees to borrow" value="£0" />
            <Stat label="Chasing you'll do" value="None" />
          </div>
        </section>

        <section id="how" className="mx-auto w-full max-w-6xl px-5 py-20">
          <div className="max-w-xl">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-3 text-3xl leading-tight sm:text-4xl">
              Three steps, then it runs itself.
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              {
                icon: ClipboardList,
                step: "01",
                title: "List what you have",
                copy: "Name it, pick a category, note the condition. Two minutes, no photos required to start.",
              },
              {
                icon: CalendarCheck2,
                step: "02",
                title: "Ask for the dates",
                copy: "Browse the board, pick a range, and send a request. The lender approves or declines in one tap.",
              },
              {
                icon: BellRing,
                step: "03",
                title: "Let the loop close itself",
                copy: "Approvals notify both sides instantly. Overdue loans get a daily nudge until the tool is back.",
              },
            ].map(({ icon: Icon, step, title, copy }) => (
              <article key={step} className="card-surface flex flex-col p-6">
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-paper-deep text-ink">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-[11px] tracking-[0.18em] text-ink-faint">{step}</span>
                </div>
                <h3 className="mt-6 text-lg">{title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="tools" className="border-t border-line bg-surface/40 py-20">
          <div className="mx-auto w-full max-w-6xl px-5">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="eyebrow">On the board right now</p>
                <h2 className="mt-3 text-3xl leading-tight sm:text-4xl">Available near you.</h2>
              </div>
              <p className="max-w-sm text-[13px] leading-relaxed text-ink-soft">
                The public board is deliberately anonymous — you&apos;ll see names and
                categories, never owners or addresses.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
                All categories
              </FilterChip>
              {categoriesPresent.map((category) => (
                <FilterChip
                  key={category}
                  active={filter === category}
                  onClick={() => setFilter(category)}
                >
                  {CATEGORY_META[category].label}
                </FilterChip>
              ))}
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {tools === undefined
                ? Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="card-surface p-5">
                      <Skeleton className="h-9 w-9 rounded-lg" />
                      <Skeleton className="mt-5 h-4 w-3/4" />
                      <Skeleton className="mt-2 h-3 w-1/2" />
                    </div>
                  ))
                : visible.slice(0, 8).map((tool) => {
                    const meta = CATEGORY_META[tool.category];
                    const Icon = meta.icon;
                    return (
                      <article
                        key={tool._id}
                        className="group card-surface flex flex-col p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
                      >
                        <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-paper-deep text-ink-soft transition-colors group-hover:border-accent/30 group-hover:text-accent">
                          <Icon className="h-4 w-4" />
                        </span>
                        <h3 className="mt-5 text-[15px] font-medium leading-snug text-ink">
                          {tool.name}
                        </h3>
                        <p className="mt-1 text-[12px] text-ink-faint">{meta.label}</p>
                      </article>
                    );
                  })}
            </div>

            {tools !== undefined && visible.length === 0 ? (
              <p className="mt-8 rounded-xl border border-dashed border-line-strong px-5 py-8 text-center text-sm text-ink-soft">
                Nothing in this category yet. Be the first to list one.
              </p>
            ) : null}

            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-6 py-5">
              <p className="text-[13px] text-ink-soft">
                Owners and descriptions are only visible to signed-in neighbours.
              </p>
              <Link href={isSignedIn ? "/browse" : "/sign-in"} className={buttonClasses("outline", "sm")}>
                {isSignedIn ? "Open the board" : "Sign in to see the full board"}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section id="trust" className="mx-auto w-full max-w-6xl px-5 py-20">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="eyebrow">Small print that matters</p>
              <h2 className="mt-3 text-3xl leading-tight sm:text-4xl">
                Private by default.
                <br />
                <span className="italic text-accent">Reliable by design.</span>
              </h2>
              <p className="mt-4 max-w-md text-[14px] leading-relaxed text-ink-soft">
                LendLoop keeps the public board anonymous and moves only the fields each
                reminder needs. Every automated message is signed, retried, and recorded
                in the loan timeline — so a failed run is visible, never silent.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Feature icon={ShieldCheck} title="Role-checked in the backend">
                Admins can moderate and verify lenders. Everyone else can only touch their
                own listings and their own loans — enforced in the database layer, not the UI.
              </Feature>
              <Feature icon={BellRing} title="Reminders on autopilot">
                A daily job finds overdue loans, sends one reminder, and writes the result
                back. Retries are idempotent, so nobody gets the same nudge twice.
              </Feature>
              <Feature icon={Repeat2} title="A timeline you can trust">
                Requests, approvals, and reminders all land on the loan&apos;s activity
                trail. No more “did you ever send that?”.
              </Feature>
              <Feature icon={Sparkles} title="Nothing to install">
                It runs in the browser. Sign in with your email, list a tool, and get back
                to your weekend.
              </Feature>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Wordmark />
            <span className="text-[12px] text-ink-faint">Neighbours helping neighbours.</span>
          </div>
          <p className="text-[12px] text-ink-faint">
            Built by Peace Jinadu-Paul · A fictional product for a take-home exercise.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-1 py-6 sm:px-6">
      <p className="font-display text-2xl text-ink">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-ink-faint">{label}</p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition",
        active
          ? "border-ink bg-ink text-surface"
          : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function Feature({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-surface p-5">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent">
        <Icon className="h-4 w-4" />
      </span>
      <h3 className="mt-4 text-[15px]">{title}</h3>
      <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">{children}</p>
    </div>
  );
}

function HeroCard() {
  return (
    <div className="relative mx-auto hidden w-full max-w-md lg:block">
      <div className="animate-rise card-surface relative z-10 p-6" style={{ animationDelay: "120ms" }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-paper-deep text-ink">
              <Repeat2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[15px] font-medium text-ink">DeWalt 20V drill</p>
              <p className="text-[11px] uppercase tracking-[0.12em] text-ink-faint">Power tools</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-moss/25 bg-moss-soft px-2.5 py-1 text-[11px] font-medium text-moss">
            <span className="h-1.5 w-1.5 rounded-full bg-moss" />
            Approved
          </span>
        </div>

        <div className="mt-5 rounded-xl border border-line bg-paper/60 px-4 py-3">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-ink-faint">Loan window</span>
            <span className="font-medium text-ink">12 – 14 Nov</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[12px]">
            <span className="text-ink-faint">Borrower</span>
            <span className="font-medium text-ink">Amara O.</span>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {[
            { label: "Request sent", detail: "Mon 09:12", tone: "moss" },
            { label: "Approved by you", detail: "Mon 09:20", tone: "moss" },
            { label: "Reminder scheduled", detail: "Sun 09:00", tone: "gold" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  item.tone === "moss" ? "bg-moss" : "bg-gold",
                )}
              />
              <span className="flex-1 text-[12px] text-ink-soft">{item.label}</span>
              <span className="font-mono text-[10px] text-ink-faint">{item.detail}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="animate-rise absolute -bottom-14 -left-3 z-20 rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-[var(--shadow-card)]" style={{ animationDelay: "260ms" }}>
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink">
          <BellRing className="h-3.5 w-3.5 text-accent" />
          Reminder sent
        </p>
        <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">2 days ago</p>
      </div>

      <div className="animate-rise absolute -bottom-14 -right-3 z-20 rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-[var(--shadow-card)]" style={{ animationDelay: "380ms" }}>
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink">
          <ShieldCheck className="h-3.5 w-3.5 text-moss" />
          Trusted lender
        </p>
      </div>

      <div className="absolute -inset-6 -z-10 rounded-[32px] border border-line/60 bg-surface/40" />
    </div>
  );
}
