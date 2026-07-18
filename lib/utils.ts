import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { TRPCClientError } from "@trpc/client"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Safe to show a user: tRPC errors carry an intentional message, anything else doesn't. */
export function getSafeErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (error instanceof TRPCClientError) return error.message
  return fallback
}
