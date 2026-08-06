## Learned User Preferences

- Always show the SGL segment in Rooms Booked alongside DBL and TPL, including when the count is 0
- Prefer Rooms Booked day totals to match the spreadsheet’s day-block room counts rather than stay-range inference alone

## Learned Workspace Facts

- Booking data syncs from a Google Sheet downloaded as XLSX via `/export?format=xlsx`, not a separate Google Drive API; override with `BOOKING_GOOGLE_SHEETS_ID` or `BOOKING_GOOGLE_SHEETS_URL`
- The booking Google Sheet must be shared as “Anyone with the link can view,” or sync receives a login HTML page instead of the spreadsheet
- Room types include DBL, SGL, and TPL; labels like SINGLE/SG should map to SGL
- Spreadsheet arrival cells may be text dates (e.g. DD/MM/YYYY) as well as Excel serials; the parser must accept both
- Departure dates are derived from arrival plus nights when sheet dates are unreliable
