import { z } from "zod";
import { FAULT_SEVERITIES } from "./faults";

export const FAULT_REPORT_STATUSES = ["Pending", "Approved", "Rejected"] as const;

export const FaultReportCreateSchema = z.object({
  itemId: z.string().min(1),
  roomName: z.string().min(1),
  faultType: z.string().min(1),
  severity: z
    .enum(FAULT_SEVERITIES as unknown as [string, ...string[]])
    .default("Medium"),
  description: z.string().optional().nullable(),
  photos: z.array(z.string()).optional().default([]),
});

export const FaultReportReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  severity: z
    .enum(FAULT_SEVERITIES as unknown as [string, ...string[]])
    .optional(),
  faultType: z.string().min(1).optional(),
  reviewNote: z.string().optional().nullable(),
});

export type FaultReportCreateInput = z.infer<typeof FaultReportCreateSchema>;
export type FaultReportReviewInput = z.infer<typeof FaultReportReviewSchema>;
