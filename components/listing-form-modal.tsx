"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { errorMessage } from "@/lib/errors";
import {
  CATEGORIES,
  CATEGORY_META,
  CONDITION_LABELS,
  type Category,
  type Condition,
} from "@/lib/tool-meta";

export type EditableListing = {
  _id: Id<"tools">;
  name: string;
  category: Category;
  condition: Condition;
  description: string;
};

const CONDITIONS: Condition[] = ["new", "excellent", "good", "fair"];

export function ListingFormModal({
  open,
  onClose,
  listing,
}: {
  open: boolean;
  onClose: () => void;
  listing?: EditableListing | null;
}) {
  const create = useMutation(api.tools.create);
  const update = useMutation(api.tools.update);

  const [name, setName] = useState(listing?.name ?? "");
  const [category, setCategory] = useState<Category>(listing?.category ?? "power-tools");
  const [condition, setCondition] = useState<Condition>(listing?.condition ?? "good");
  const [description, setDescription] = useState(listing?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Give the tool a name (at least 2 characters).");
      return;
    }
    if (description.trim().length < 5) {
      setError("Add a short description so neighbours know what to expect.");
      return;
    }
    setSaving(true);
    try {
      if (listing) {
        await update({
          toolId: listing._id,
          name,
          category,
          condition,
          description,
        });
        toast.success("Listing updated");
      } else {
        await create({ name, category, condition, description });
        toast.success("Listing added to the board");
      }
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={listing ? "Edit listing" : "List a tool"}
      description={
        listing
          ? "Update the details neighbours see when they browse."
          : "Only signed-in neighbours can see the description and your name."
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="listing-form" disabled={saving}>
            {saving ? "Saving…" : listing ? "Save changes" : "Add to the board"}
          </Button>
        </>
      }
    >
      <form id="listing-form" onSubmit={onSubmit} className="space-y-5">
        <div>
          <Label htmlFor="tool-name">Tool name</Label>
          <Input
            id="tool-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Bosch cordless drill"
            maxLength={80}
            aria-invalid={Boolean(error) && name.trim().length < 2}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="tool-category">Category</Label>
            <Select
              id="tool-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as Category)}
            >
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_META[value].label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="tool-condition">Condition</Label>
            <Select
              id="tool-condition"
              value={condition}
              onChange={(event) => setCondition(event.target.value as Condition)}
            >
              {CONDITIONS.map((value) => (
                <option key={value} value={value}>
                  {CONDITION_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="tool-description" hint={`${description.length}/400`}>
            Short description
          </Label>
          <Textarea
            id="tool-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What's included, any quirks, and what it's best for."
            maxLength={400}
            required
          />
        </div>

        <FieldError>{error}</FieldError>
      </form>
    </Modal>
  );
}
