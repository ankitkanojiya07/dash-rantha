## Learned User Preferences

- Always show the SGL segment in Rooms Booked alongside DBL and TPL, including when the count is 0
- Prefer Rooms Booked day totals from in-house stay nights (arrival through departure−1), not spreadsheet day-block row sums (those mis-attribute New Year blocks across years)
- Bookings occupancy search should support fewer-than thresholds of 30, 40, 60, 80, 100, and 140 rooms
- Omit past years such as 2025 from the Bookings year filter
- Collapse category spelling variants (spaces, punctuation, capitalization, close typos) into one All Categories option

## Learned Workspace Facts

- Booking data syncs from a Google Sheet downloaded as XLSX via `/export?format=xlsx`, not a separate Google Drive API; override with `BOOKING_GOOGLE_SHEETS_ID` or `BOOKING_GOOGLE_SHEETS_URL`
- The booking Google Sheet must be shared as “Anyone with the link can view,” or sync receives a login HTML page instead of the spreadsheet
- Room types include DBL, SGL, and TPL; labels like SINGLE/SG should map to SGL
- Spreadsheet arrival cells may be text dates (e.g. DD/MM/YYYY) as well as Excel serials; the parser must accept both
- Departure dates are derived from arrival plus nights when sheet dates are unreliable
- Google Sheets XLSX export can be CDN-cached; production sync must cache-bust the export URL and use `cache: 'no-store'` or live can diverge from local/Excel
- Hotel calendar “today” uses Asia/Kolkata
- Spreadsheet day blocks re-list the same multi-night stay under each night; dedupe by guest+room+arrival+agent+nights (case/whitespace-insensitive), keeping the higher room count — otherwise Rooms Booked overcounts (e.g. Oct 1 Kapil Sharma 56 vs Excel 46)
