## Learned User Preferences

- Use `@solar-icons/react` with `BoldDuotone` weight for dashboard icons (not lucide-react).
- Use gold accent `#c9a227` for page/section titles and primary UI highlights (charts, badges)—not slate/`--text-primary`.
- Prefer a curved floating white main content panel (24px rounded corners, subtle shadow, no sidebar border).
- When matching UI from reference images, replicate layout and styling only—do not copy text from the image.
- Keep the sidebar minimal; avoid footer clutter such as a "Read-only dashboard" label.
- Keep calendar day numbers and overlaid booking text readable (sufficient contrast).

## Learned Workspace Facts

- Hotel booking read-only dashboard for Ranthambhore Regency Hotel (sidebar branding: "Regency Hotel").
- `doc.md` is the authoritative build specification for features, data model, and architecture.
- Frontend lives in `client/` (React, TanStack Router, React Query, Recharts).
- Backend/API lives in `server/` (Excel sync and booking routes).
- Brand accent color is `#c9a227` (CSS variable `--accent` in `globals.css`).
- Dashboard is read-only by design (no write routes or edit forms in the UI).
- Live booking data is loaded from `booking chart 2026-27.xlsx` at the project root via `server/src/sync/excelParser.ts` (mock data removed).
- Real Excel columns: date, group name, no of rooms, final room, company name, arrival, nights, status, remarks.
- Room types (DBL, TPL, SGL, etc.) are parsed from the `finalRoom` field (e.g. `"21 DBL"`).
- Deploy target is Vercel: static `client/dist` + serverless `api/index.ts` (Express app); Excel bundled via `data/bookings.xlsx`.
