import Link from "next/link";
import { ArrowLeft, BellRing, ShieldCheck } from "lucide-react";
import { LogoMark } from "@/components/brand";

export function AuthShell({
  children,
  eyebrow,
  title,
  copy,
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink px-12 py-14 text-paper lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-32 h-[520px] w-[520px] rounded-full border border-paper/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-10 h-[360px] w-[360px] rounded-full border border-accent/40"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -left-24 h-[420px] w-[420px] rounded-full border border-paper/10"
        />

        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2.5 text-paper">
            <LogoMark className="h-7 w-7" />
            <span className="font-display text-[19px] font-semibold tracking-tight">
              Lend<span className="text-accent">Loop</span>
            </span>
          </Link>
          <p className="eyebrow mt-16 text-paper/50">{eyebrow}</p>
          <h1 className="mt-4 max-w-md text-balance font-display text-[40px] leading-[1.05] text-paper">
            {title}
          </h1>
          <p className="mt-5 max-w-sm text-[14px] leading-relaxed text-paper/65">{copy}</p>
        </div>

        <div className="relative space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-paper/15 bg-paper/5 p-4">
            <BellRing className="mt-0.5 h-4 w-4 text-accent" />
            <div>
              <p className="text-[12px] font-medium text-paper">Automated, not nagging</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-paper/55">
                Approvals and overdue reminders are signed, retried, and logged on the loan.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-paper/15 bg-paper/5 p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-moss-soft" />
            <div>
              <p className="text-[12px] font-medium text-paper">Private public board</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-paper/55">
                Signed out, you see a tool&apos;s name and category. Never its owner.
              </p>
            </div>
          </div>
          <p className="pt-4 text-[11px] text-paper/40">
            Built by Peace Jinadu-Paul · A fictional product for a take-home exercise.
          </p>
        </div>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft transition hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to the board
          </Link>
          <div className="lg:hidden">
            <LogoMark className="h-6 w-6" />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  );
}
