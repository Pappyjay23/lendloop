import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-line/60", className)} />;
}

export function CardSkeleton() {
  return (
    <div className="card-surface p-5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-6 w-3/4" />
      <Skeleton className="mt-2 h-4 w-1/2" />
      <div className="mt-6 flex justify-between">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
}

export function RowSkeleton() {
  return (
    <div className="card-surface flex items-center gap-4 p-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-2 h-3 w-1/2" />
      </div>
      <Skeleton className="h-7 w-20" />
    </div>
  );
}
