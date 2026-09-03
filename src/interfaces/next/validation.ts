import { z } from "zod";

import { MISTAKE_CATEGORIES } from "@/src/domain/analysis";
import { NewPassword } from "@/src/domain/user";

const passwordSchema = z.string().superRefine((value, context) => {
  const length = Array.from(value).length;
  if (length < NewPassword.MIN_LENGTH || length > NewPassword.MAX_LENGTH) {
    context.addIssue({
      code: "custom",
      message: `Password must be between ${NewPassword.MIN_LENGTH} and ${NewPassword.MAX_LENGTH} characters`,
    });
  }
});

export const authFormSchema = z.object({
  mode: z.enum(["login", "register"]),
  email: z.email().max(320),
  password: passwordSchema,
});

export const passwordChangeSchema = z
  .object({
    currentPassword: passwordSchema,
    newPassword: passwordSchema,
    confirmation: passwordSchema,
  })
  .refine((value) => value.newPassword === value.confirmation, {
    path: ["confirmation"],
    message: "New passwords do not match.",
  });

export const speechIdSchema = z.uuid();

export const stagedAudioReferenceSchema = z.object({
  pathname: z.string().min(1).max(1_024),
  etag: z.string().min(1).max(512),
});

export const dateRangeSelectionSchema = z
  .enum(["all_time", "yearly", "monthly", "weekly"])
  .catch("monthly");

export const mistakeCategorySchema = z.enum(MISTAKE_CATEGORIES);

export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    (errors[field] ??= []).push(issue.message);
  }
  return errors;
}
