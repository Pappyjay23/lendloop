import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const palettes = [
  "bg-[#e8d9c4] text-[#6b4f2a]",
  "bg-moss-soft text-moss",
  "bg-accent-soft text-accent",
  "bg-gold-soft text-gold",
];

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const index = name.split("").reduce((total, char) => total + char.charCodeAt(0), 0) % palettes.length;
  const sizes = {
    sm: "h-7 w-7 text-[10px]",
    md: "h-9 w-9 text-[11px]",
    lg: "h-11 w-11 text-[13px]",
  };
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold tracking-wide",
        palettes[index],
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
