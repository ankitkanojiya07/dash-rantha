# Hotel Booking Dashboard — Full Build Plan (Single Release)

## 1. Data Source Reality (from your uploaded file)

`booking_chart_2026-27.xlsx` — 12 month-tabs (Sep→Aug) + 1 helper tab (`Sheet4`).

Each month tab is a **day-block layout**: a `TOTAL` row, followed by that day's booking rows, repeating for every day of the month. No fixed header row — it's built for humans reading it visually, not for direct table import.

**Confirmed field mapping** (Excel → system):

| Excel column | System field | Notes |
|---|---|---|
| Weekday (col A) | — | Not stored, derivable from date |
| "Date" (col B) | — | **Discarded** — contains corrupted years, not usable |
| Group/Client/User Name (col C) | `guestOrGroupName` | |
| Final Room (col D) | `finalRoom` | e.g. "21 DBL" — room no. + type combined |
| No. of Rooms (col E) | `noOfRooms` | Numeric, sums to daily `TOTAL` |
| Company Name (col F) | `agentName` | This is your **Agent** for all agent tracking/reporting |
| Arrival Date (col G) | `arrivalDate` | Reliable date field |
| *(unlabeled second date)* (col H) | `departureDate` | = arrival + nights, confirmed by checking your data |
| Nights (col I) | `nights` | Confirmed = departure − arrival |
| Status (col J) | `roomCategoryOrStatus` | **Needs your confirmation** — values look like room category/meal plan (e.g. "Super deluxe/Map"), not confirmed/cancelled. If you also mark cancellations somewhere (color, strike-through, a word in remarks), tell me — I'll add a proper `status` field for that. |
| Remarks (col K, L) | `remarks` | Free text — advances, phone numbers, special notes |
| Daily `TOTAL` row | used to validate `noOfRooms` sum per day | Not stored as a booking — used as a sync integrity check |
| `Sheet4` (Date, Rooms) | `daily_occupancy` collection | Ready-made daily room-count table — feeds the occupancy chart directly |

**No unique Booking No. exists in the source.** The sync job will generate one (e.g. `OCT26-0001`) unless you tell me one exists elsewhere.

---

## 2. Architecture (unchanged from before, confirmed)

```
You edit Excel (as today) → OneDrive/Google Drive auto-sync
        ↓
Sync Service (scheduled) — parses each month tab's day-blocks,
   derives real stay-date from arrival date, validates against TOTAL rows
        ↓
PostgreSQL — the operational database the app actually queries
        ↓
Dashboard (TanStack + TypeScript) — READ-ONLY, always
```

Read-only is enforced at 3 layers (UI has no forms, API has no write routes, and the dashboard's DB user is a PostgreSQL role granted `SELECT` only) — same as before, non-negotiable.

---

## 3. PostgreSQL Schema (finalized against your real columns)

### `bookings`
```
{
  _id,
  bookingRef: string,          // system-generated, e.g. "OCT26-0001"
  monthSheet: string,           // "Oct", "Nov"... traceability back to source tab
  guestOrGroupName: string,
  finalRoom: string,            // "21 DBL"
  noOfRooms: number,
  agentName: string,             // from "Company Name" column
  arrivalDate: Date,
  departureDate: Date,
  nights: number,
  roomCategoryOrStatus: string,  // pending your confirmation of meaning
  remarks: string,
  syncedAt: Date,
  sourceRow: number             // row number in source sheet, for debugging/traceability
}
```

### `agents` (aggregated from `agentName` in bookings)
```
{ _id, agentName, totalBookings, totalRoomNights, totalRooms }
```

### `daily_occupancy` (from Sheet4, cross-checked with TOTAL rows)
```
{ _id, date: Date, roomsOccupied: number }
```

### `sync_logs`
```
{ _id, syncedAt, sheetsProcessed, rowsProcessed, mismatches: [ {date, expectedTotal, actualSum} ], status }
```

---

## 4. Full Feature Set (everything in one build, no phase gating)

### Reservation Calendar
- Month/week calendar, one view per room or per day.
- Color-coded by agent or by room category.
- Click any booking → detail panel (guest/group name, agent, room, dates, nights, remarks) — view only.
- Overlap highlighting: since a specific room ("final room") is recorded, the calendar flags two bookings assigned the same room on overlapping dates — visible to you before you fix it in Excel.

### Room Nights & Agent Tracking
- Full bookings table (TanStack Table): filter by agent, month, room category, date range.
- Auto-calculated: room-nights (`nights × noOfRooms`), and per-agent rollups.
- Agent leaderboard: total bookings, total room-nights, share of business, month-over-month change.

### Live Dashboard (home page)
- KPI cards: occupancy % (today, this week — from `daily_occupancy`), total room-nights (MTD), active bookings, top agent this month.
- Occupancy trend chart (last 30/90 days) straight from `Sheet4`-derived data.
- Arrivals-today / departures-today lists.
- Last sync time + manual refresh button.

### Reports & Analytics
- Monthly business summary (replaces your manual Excel report): bookings, room-nights, and room-count by month, by agent, by room category.
- Filterable date range reports.
- Export to PDF/CSV (export is fine — it's not a write-back to your data).

### Guest/Group History
- Since there's no persistent guest ID, history is grouped by matching `guestOrGroupName` — shows repeat groups/clients and their past stays.

### Sync Health
- A small "Data Health" panel showing last sync time, rows processed, and any day where the sum of `noOfRooms` didn't match the sheet's `TOTAL` row — so data issues in your Excel are visible, not silently swallowed.

---

## 5. Things I still need from you

1. **Confirm the "status" column meaning** — room category/meal plan (as it looks), or do you track booking status (confirmed/cancelled) some other way (color fill, a word, a separate mark) that I should also capture?
2. **OneDrive or Google Drive** — determines which sync API (Microsoft Graph vs Google Drive API).
3. **Sync frequency** — every 5–15 min, or manual refresh button only?
4. **Accent color** — for buttons/highlights, to pair with the sidebar `#f1f5f9` and background `#332928`.
5. Confirm there's genuinely no Booking No. elsewhere (a hidden column, a separate ID sheet) — otherwise I'll auto-generate references as described above.

---

## 6. Build Order (internal sequencing — delivered as one complete dashboard, not staged releases)

| Step | Deliverable |
|---|---|
| 1 | PostgreSQL set up: `sync_writer` role (write) + `dashboard_reader` role (SELECT-only) |
| 2 | Sync parser: day-block walker per month tab, TOTAL-row validation, writes to `bookings` + `daily_occupancy` |
| 3 | Backend read-only API: bookings, agents, occupancy, reports endpoints |
| 4 | Dashboard shell: collapsible left sidebar/theme (`#f1f5f9` / `#332928`), routing, auth |
| 5 | Live Dashboard (KPIs + occupancy chart) |
| 6 | Reservation Calendar + overlap highlighting |
| 7 | Bookings table + agent tracking/filters |
| 8 | Reports & analytics + export |
| 9 | Sync health panel + QA pass confirming read-only enforcement at all 3 layers |

Once you confirm the 5 items in §5, this becomes a locked spec and I can start on the sync parser first, since it's the foundation everything else reads from.