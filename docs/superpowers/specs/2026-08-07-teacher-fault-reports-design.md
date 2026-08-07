# Teacher Fault Reports — Design Spec

**Date:** 2026-08-07
**Status:** Approved

## Overview

Teachers (USER-role accounts) get a dedicated fault-reporting page at `/report` — separate from the admin dashboard. They select their location, pick the faulty item, and describe the problem. Reports go into a review queue visible to admins inside the existing Faults tab. Admins can approve (with edits) or reject each report. Approval creates a real Fault record with the existing auto-escalation logic. The feature is multi-tenant and works in demo mode.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Auth model | Logged-in USER accounts only | Teacher identity comes from session; no public/anonymous access |
| Admin direct reporting | Unchanged | Admins keep instant fault creation; only USER submissions go through review |
| Data model | New `FaultReport` table (Approach A) | Clean separation from confirmed faults; no risk of polluting existing queries or stats |
| Review location | Inside existing Faults tab | No new tab; pending reports appear above confirmed faults |
| Review actions | Approve (with edits) or Reject | Admin can adjust severity/fault type before confirming; rejection includes a reason |
| Teacher UI | Separate `/report` page | Teachers do NOT access the dashboard; focused experience only |

## 1. Data Model

New Prisma model:

```prisma
model FaultReport {
  id          String   @id @default(cuid())
  schoolId    String
  school      School   @relation(fields: [schoolId], references: [id])
  itemId      String
  item        Item     @relation(fields: [itemId], references: [id], onDelete: Cascade)
  roomName    String
  faultType   String
  severity    String   @default("Medium")
  description String?
  photos      String[]
  reportedBy  String
  reporterId  String
  status      String   @default("Pending") // Pending | Approved | Rejected
  reviewedBy  String?
  reviewNote  String?
  reviewedAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([schoolId])
  @@index([status])
}
```

- `roomName` — the room the teacher selected (denormalized string, same as `item.locationName`)
- `reportedBy` — teacher's display name from session
- `reporterId` — user ID for audit trail
- `status` — lifecycle: Pending → Approved or Rejected
- `reviewedBy` / `reviewNote` / `reviewedAt` — populated on admin review

Relations to add: `School.faultReports FaultReport[]` and `Item.faultReports FaultReport[]`.

On **approval**, the server creates a real `Fault` record in a transaction (triggering auto-escalation) and marks the report Approved. On **rejection**, the report is marked Rejected with the admin's reason. FaultReport records are never deleted — they serve as an audit trail.

## 2. Auth & Routing

### Current behavior

All authenticated users → `/dashboard`.

### New behavior

| Role | Login destination | `/dashboard` access | `/report` access |
|---|---|---|---|
| USER | `/report` | Redirected to `/report` | Yes |
| SCHOOL_ADMIN | `/dashboard` | Yes | Yes (but not primary) |
| SUPER_ADMIN | `/dashboard` | Yes | Yes (but not primary) |

### Changes

1. **Middleware** (`src/middleware.ts`): If authenticated USER hits `/dashboard/*`, redirect to `/report`.
2. **NextAuth config** (`src/lib/auth.config.ts`): Default post-login redirect for USER role → `/report`.
3. **New route** `/report`: Server component with auth guard, renders the teacher form.

Existing API endpoints (`/api/items`, `/api/sections`, `/api/upload`) remain accessible to all authenticated users — the teacher form needs them.

## 3. Teacher Report Page (`/report`)

A standalone page — clean, focused, no dashboard chrome.

### Header

School name, teacher's name, logout button. No tabs, stats, or action buttons.

### Form

Three-step cascading flow in a single page (not a multi-page wizard):

1. **Where are you?** — Dropdown of all rooms, grouped by section. Selecting a room reveals step 2.
2. **Which item is faulty?** — Searchable list of items in the selected room. Each item shows label, type icon, current status. Selecting an item reveals step 3.
3. **What's wrong?** — Fault type dropdown (from school's configurable `faultTypes`), severity selector (Low/Medium/High/Critical, default Medium), description textarea, optional photo upload (reuses existing S3 upload logic).

### Submit

Creates a `FaultReport` with status "Pending". Shows success confirmation: "Your report has been submitted. The admin team will review it." with a "Report Another" button.

### My Reports

Below the form, teachers see their own past submissions with status badges (Pending/Approved/Rejected) and any admin review notes. Read-only.

### Edge cases

- **Empty room** (no items in selected location): Show a message like "No items found in this room" and prevent advancing to step 3.
- **Already-faulty items**: Teachers can still report on items that are already in "Faulty" or "Under Maintenance" status — they may be reporting a different problem.
- **Existing admin "Report Fault" button**: The `ReportFaultModal` in the dashboard Header is unchanged. Admins continue to use it for direct fault creation. Teachers never see it because they can't access the dashboard.

## 4. API Routes

### `POST /api/fault-reports`

Create a fault report. Any authenticated user.

- **Input:** `{ itemId, roomName, faultType, severity?, description?, photos? }`
- **Validation:** Zod schema. Scoped to `session.schoolId`.
- **Sets:** `reportedBy` from session name, `reporterId` from session ID, `status: "Pending"`.
- **Returns:** Created FaultReport.

### `GET /api/fault-reports`

List fault reports. Role-aware response.

- **Admin:** All reports for the school, filterable by status. Includes item details (label, type, location).
- **USER:** Only their own reports (`reporterId === session.userId`).
- **Sorted:** Newest-first by default.

### `PUT /api/fault-reports/[reportId]`

Admin review. Admin-only (`requireAdmin()`).

- **Input:** `{ action: "approve" | "reject", severity?, faultType?, reviewNote? }`
- **Approve:** Transaction — creates a real `Fault` on the item (auto-escalation kicks in), marks report "Approved", records reviewer name and timestamp.
- **Reject:** Marks report "Rejected" with `reviewNote` as reason, records reviewer.
- **Guard:** Only works on "Pending" reports — returns 400 for already-reviewed.

## 5. Admin Review UI

### Faults tab badge

Tab label shows pending count when > 0: `Faults (3)`.

### Pending Reports section

Appears above the confirmed fault list inside FaultsView. Only visible to admins.

- Collapsible, expanded by default when pending items exist.
- Each card shows: reporter name, timestamp, room name, item label + type icon, fault type, severity badge, description, photo thumbnails.
- Visual treatment: Yellow/amber left border or background tint to distinguish from confirmed faults.

### Actions per card

- **Approve** — Expands inline edit area: admin can adjust severity, fault type, add a note. Confirm button creates the real Fault and marks report Approved.
- **Reject** — Expands textarea for rejection reason. Confirm button marks report Rejected.

### Data flow

Dashboard fetches fault reports via `GET /api/fault-reports` alongside existing data loads. Pending count is derived from response. On approve/reject, dashboard refreshes both fault reports and items (since approval may change item status via auto-escalation).

## 6. Demo Mode

### Teacher demo user

Demo reset (`/api/demo/reset`) creates a second user:

- Email: `teacher@demo.investorymap.com`
- Password: `demo`
- Role: USER
- Name: "Demo Teacher"

### Seed sample FaultReports

Demo reset seeds 2-3 pending FaultReports so admins see the review queue immediately:

- "Projector not turning on" — severity High
- "HDMI cable loose" — severity Low

### Landing page

Existing "Try Demo" button stays (logs in as admin, goes to dashboard). Add a second button: "Try as Teacher" — logs in as teacher demo user, lands on `/report`.

### Demo banner on `/report`

When school is "Demo School", show the same purple demo banner with "Reset Demo" button, matching the dashboard's demo banner style.

## Files Affected

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `FaultReport` model + relations on School and Item |
| `src/middleware.ts` | Redirect USER from `/dashboard` to `/report` |
| `src/lib/auth.config.ts` | USER post-login redirect to `/report` |
| `src/lib/validation/fault-reports.ts` | New Zod schemas for create/review |
| `src/app/api/fault-reports/route.ts` | GET + POST |
| `src/app/api/fault-reports/[reportId]/route.ts` | PUT (approve/reject) |
| `src/app/report/page.tsx` | New teacher report page (server component) |
| `src/app/report/layout.tsx` | Auth guard layout for `/report` |
| `src/components/ReportForm.tsx` | New client component — the 3-step form |
| `src/components/MyReports.tsx` | New client component — teacher's submission history |
| `src/components/FaultsView.tsx` | Add Pending Reports section (admin only) |
| `src/components/TabNav.tsx` | Badge count on Faults tab |
| `src/app/dashboard/page.tsx` | Fetch fault reports, pass to FaultsView, derive badge count |
| `src/lib/api-client.ts` | Add `faultReports` namespace (create, list, review) |
| `src/app/api/demo/reset/route.ts` | Add teacher user + seed FaultReports |
| `prisma/seed-demo.ts` | Same demo changes for CLI seeding |
| `src/app/page.tsx` | Add "Try as Teacher" demo button |
| `src/components/DemoButton.tsx` | Variant for teacher demo login |
