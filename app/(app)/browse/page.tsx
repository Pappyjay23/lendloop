"use client";

import { useQuery } from "convex/react";
import { Compass, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/page-header";
import { ToolCard, ToolCardSkeleton, type ToolCardData } from "@/components/tool-card";
import { RequestModal } from "@/components/request-modal";
import { ListingFormModal } from "@/components/listing-form-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { CATEGORIES, CATEGORY_META, type Category } from "@/lib/tool-meta";
import { cn } from "@/lib/cn";

type Filter = Category | "all";

export default function BrowsePage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [requestTool, setRequestTool] = useState<ToolCardData | null>(null);
  const [listingOpen, setListingOpen] = useState(false);

  const tools = useQuery(api.tools.browse, {
    category: filter === "all" ? undefined : filter,
  });

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (tools ?? []).filter((tool) => {
      if (onlyAvailable && tool.availability !== "available") return false;
      if (!term) return true;
      return (
        tool.name.toLowerCase().includes(term) ||
        tool.description.toLowerCase().includes(term) ||
        tool.ownerName.toLowerCase().includes(term)
      );
    });
  }, [tools, search, onlyAvailable]);

  return (
    <>
      <PageHeader
        eyebrow="The board"
        title="Borrow from your neighbourhood."
        description="Every tool is listed by a real neighbour. Pick your dates, send a request, and let the reminders handle the rest."
        action={
          <Button onClick={() => setListingOpen(true)}>
            <Plus className="h-4 w-4" />
            List a tool
          </Button>
        }
      />

      <div className="mb-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tools, descriptions, or neighbours"
              className="pl-9"
              aria-label="Search tools"
            />
          </div>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] text-ink-soft">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(event) => setOnlyAvailable(event.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--accent)]"
            />
            Available now
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </Chip>
          {CATEGORIES.map((category) => (
            <Chip key={category} active={filter === category} onClick={() => setFilter(category)}>
              {CATEGORY_META[category].label}
            </Chip>
          ))}
        </div>
      </div>

      {tools === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <ToolCardSkeleton key={index} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="Nothing matches that yet"
          description="Try a different category or clear the search. If you own a tool that fits, list it — someone nearby is probably looking for it."
          action={<Button onClick={() => setListingOpen(true)}>List a tool</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((tool) => (
            <ToolCard key={tool._id} tool={tool} onRequest={setRequestTool} />
          ))}
        </div>
      )}

      <p className="mt-8 text-center text-[11px] text-ink-faint">
        {tools ? `${visible.length} of ${tools.length} listings shown` : "Loading the board…"}
      </p>

      {requestTool ? (
        <RequestModal
          open
          onClose={() => setRequestTool(null)}
          tool={{
            ...requestTool,
            categoryLabel: CATEGORY_META[requestTool.category].label,
          }}
        />
      ) : null}
      {listingOpen ? (
        <ListingFormModal open onClose={() => setListingOpen(false)} />
      ) : null}
    </>
  );
}

function Chip({
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
        "rounded-full border px-3 py-1.5 text-[12px] font-medium transition",
        active
          ? "border-ink bg-ink text-surface"
          : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
