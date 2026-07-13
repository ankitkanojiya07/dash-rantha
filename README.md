# Rantha Hotel — Booking Dashboard

Read-only hotel booking dashboard built from the spec in `doc.md`.

## Stack

- **Frontend:** React + TypeScript + TanStack (Router, Table, Query) + Recharts
- **Backend:** Express read-only API (Google Sheets → in-memory store)
- **Deploy:** Vercel (static client + serverless `/api`)

## Data source (Google Drive)

Live bookings come only from the shared Google Sheet (view access is enough):

`https://docs.google.com/spreadsheets/d/1hI1iarIdg9U0Qiy7RBwhIG6IiArv8PTz/edit?usp=sharing`

On startup and when you click **Trigger Sync**, the server downloads the latest `.xlsx` export and reloads bookings. There is no local Excel file in the repo.

Optional env vars:

| Variable | Purpose |
|---|---|
| `BOOKING_GOOGLE_SHEETS_ID` | Spreadsheet ID (default: the shared chart above) |
| `BOOKING_GOOGLE_SHEETS_URL` | Full Sheets URL (ID is parsed from it) |

Keep the Google file shared as **Anyone with the link can view**.

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
4. Deploy. Data is always pulled live from Google Sheets.

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
