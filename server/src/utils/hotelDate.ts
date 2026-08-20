/** Hotel timezone for calendar “today” (India). */
export const HOTEL_TIMEZONE = 'Asia/Kolkata';

/** YYYY-MM-DD in the hotel timezone. */
export function hotelTodayIso(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HOTEL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
