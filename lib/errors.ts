import { ConvexError } from "convex/values";

export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    const data = error.data;
    if (data && typeof data === "object" && "message" in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message;
    }
    if (typeof data === "string") return data;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}
