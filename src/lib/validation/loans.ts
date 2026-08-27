import { z } from "zod";

// Condition options come from the v1 UI (LoanEntry.condition is captured on
// return). Keep in sync with the modal's dropdown.
export const LOAN_CONDITIONS = [
  "Good",
  "Fair",
  "Damaged",
  "Missing Parts",
] as const;

export const LoanOutSchema = z.object({
  action: z.literal("loan-out"),
  borrowerName: z.string().min(1),
  borrowerId: z.string().optional().nullable(),
  issuedBy: z.string().optional().nullable(),
  expectedReturn: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  signature: z.string().optional().nullable(),
  issuerSignature: z.string().optional().nullable(),
});

export const LoanReturnSchema = z.object({
  action: z.literal("return"),
  returnLocation: z.string().optional().default("Spare"),
  receivedBy: z.string().optional().nullable(),
  condition: z.enum(LOAN_CONDITIONS).optional().default("Good"),
});

// Discriminated union — zod picks the correct branch based on `action` and
// surfaces structured issues when an unknown action value is posted.
export const LoanActionSchema = z.discriminatedUnion("action", [
  LoanOutSchema,
  LoanReturnSchema,
]);

export type LoanOutInput = z.infer<typeof LoanOutSchema>;
export type LoanReturnInput = z.infer<typeof LoanReturnSchema>;
export type LoanActionInput = z.infer<typeof LoanActionSchema>;
