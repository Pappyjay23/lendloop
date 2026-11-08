import { cn } from "@/lib/cn";

type Variant = "primary" | "accent" | "outline" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-surface hover:bg-accent shadow-[0_1px_0_rgba(0,0,0,0.08)]",
  accent: "bg-accent text-white hover:bg-accent-hover shadow-[0_1px_0_rgba(0,0,0,0.08)]",
  outline: "border border-line-strong bg-surface text-ink hover:bg-paper-deep",
  ghost: "text-ink-soft hover:bg-paper-deep hover:text-ink",
  danger: "bg-danger text-white hover:bg-[#8a2b1f]",
  subtle: "bg-paper-deep text-ink hover:bg-line",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-[15px]",
  icon: "h-9 w-9",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 rounded-[10px] font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}
