# Rantha Hotel — Booking Dashboard

Read-only hotel booking dashboard built from the spec in `doc.md`.

## Stack

- **Frontend:** React + TypeScript + TanStack (Router, Table, Query) + Recharts
- **Backend:** Express read-only API (Excel → in-memory store)
- **Deploy:** Vercel (static client + serverless `/api`)

## Quick Start

```bash
npm run install:all
npm run dev
```

- Dashboard: http://localhost:5173
- API: http://localhost:3001

## Deploy on Vercel

1. Push this repo to GitHub/GitLab/Bitbucket.
2. Import the project in [Vercel](https://vercel.com/new) — root directory stays the repo root (do not set Root Directory to `client`).
3. Vercel will use `vercel.json` (`install:all`, build client, serverless `api/`).
4. Deploy. The booking Excel file at the project root is bundled into the API function.

Optional: set `BOOKING_EXCEL_PATH` if you host the workbook elsewhere.

Local preview of the production build:

```bash
npm run install:all
npm run build:client
npx vercel dev
```

## Pages

| Route | Feature |
|---|---|
| `/` | Live Dashboard — KPIs, occupancy chart, arrivals/departures |
| `/calendar` | Reservation calendar with overlap detection |
| `/bookings` | Full bookings table with filters & CSV export |
| `/agents` | Agent leaderboard & room-night tracking |
| `/reports` | Monthly analytics with breakdowns |
| `/guests` | Guest/group repeat-stay history |
| `/sync` | Data health & sync integrity panel |

## Theme

- Background: `#332928`
- Sidebar: `#f1f5f9`
- Accent: `#c9a227`

## Next Steps (from doc.md)

1. Connect PostgreSQL and run `database/schema.sql`
2. Build Excel sync parser for `booking_chart_2026-27.xlsx`
3. Wire OneDrive/Google Drive sync
4. Confirm status column meaning & accent color preference
