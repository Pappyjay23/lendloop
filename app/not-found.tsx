import Link from "next/link";
import { LogoMark } from "@/components/brand";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md text-center">
        <LogoMark className="mx-auto h-10 w-10" />
        <p className="eyebrow mt-6">404</p>
        <h1 className="mt-2 font-display text-3xl">This loop is closed.</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
          The page you were looking for isn&apos;t here. The board is still open, though.
        </p>
        <Link href="/" className={`${buttonClasses("primary", "md")} mt-6`}>
          Back to LendLoop
        </Link>
      </div>
    </main>
  );
}
