import nodemailer from 'nodemailer';
import type { Booking } from '../types.js';

function mailConfig() {
  const from = process.env.MAIL_FROM || 'ranthambhoreregency@gmail.com';
  const user = process.env.MAIL_USER || process.env.MAIL_FROM || from;
  const pass = (process.env.MAIL_PASS || process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  return { from, user, pass };
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Format YYYY-MM-DD as "1 August 2026". */
export function formatMailDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function bookingStayLine(b: Booking): string {
  return `${b.guestOrGroupName}, scheduled to stay with us from ${formatMailDate(b.arrivalDate)} to ${formatMailDate(b.departureDate)}`;
}

export function buildReservationUpdateBody(bookings: Booking[]): string {
  const intro =
    bookings.length === 1
      ? `We are reviewing our upcoming reservations and would appreciate an update regarding the booking for ${bookingStayLine(bookings[0])}.`
      : [
          'We are reviewing our upcoming reservations and would appreciate an update regarding the following bookings:',
          '',
          ...bookings.map((b, i) => `${i + 1}. ${bookingStayLine(b)}`),
        ].join('\n');

  return [
    'Dear Sir',
    '',
    'I hope you are doing well.',
    '',
    intro,
    '',
    'Could you please provide us with:',
    '',
    'The current status of booking',
    'The final rooming list and room requirements.',
    'Any special requests or dietary preferences.',
    'The expected arrival time, if available.',
    '',
    'Receiving these details at your earliest convenience will help us ensure a smooth check-in experience and make all necessary arrangements for your guests.',
    '',
    'Thank you for your continued support. We look forward to your response.',
    '',
    'Kind regards,',
    '',
    'Reservations Team',
    'Ranthambhore Regency',
    'Ranthambore, Rajasthan, India',
  ].join('\n');
}

export function csvEscape(value: string | number): string {
  const s = String(value ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

export function bookingsToCsv(bookings: Booking[]): string {
  const headers = [
    'Ref',
    'Guest / Group',
    'Room',
    'No. of Rooms',
    'Agent',
    'Arrival',
    'Departure',
    'Nights',
    'Room Nights',
    'Category',
    'Month',
    'Remarks',
  ];
  const rows = bookings.map((b) =>
    [
      b.bookingRef,
      b.guestOrGroupName,
      b.finalRoom,
      b.noOfRooms,
      b.agentName,
      b.arrivalDate,
      b.departureDate,
      b.nights,
      b.nights * b.noOfRooms,
      b.roomCategoryOrStatus,
      b.monthSheet,
      b.remarks,
    ]
      .map(csvEscape)
      .join(','),
  );
  return [headers.map(csvEscape).join(','), ...rows].join('\n');
}

export function assertMailConfigured() {
  const { pass } = mailConfig();
  if (!pass) {
    throw new Error(
      'Mail not configured. Set MAIL_PASS (Gmail App Password) for ranthambhoreregency@gmail.com',
    );
  }
}

export async function sendBookingsCsvMail(opts: {
  to: string;
  agentName: string;
  fromDate: string;
  toDate: string;
  csv: string;
  bookings: Booking[];
  guestOrGroup?: string;
}) {
  assertMailConfigured();
  const { from, user, pass } = mailConfig();
  const bookingCount = opts.bookings.length;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  const guestSuffix = opts.guestOrGroup
    ? `_guest_${opts.guestOrGroup.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40)}`
    : '';
  const filename = `${opts.agentName.replace(/[^a-zA-Z0-9_-]+/g, '_')}_bookings_${opts.fromDate}_to_${opts.toDate}${guestSuffix}.csv`;
  const guestLabel = opts.guestOrGroup ? ` — ${opts.guestOrGroup}` : '';
  const subject = `Booking update request — ${opts.agentName}${guestLabel} (${opts.fromDate} to ${opts.toDate})`;
  const text = buildReservationUpdateBody(opts.bookings);

  await transporter.sendMail({
    from: `"Ranthambhore Regency" <${from}>`,
    to: opts.to,
    subject,
    text,
    attachments: [
      {
        filename,
        content: opts.csv,
        contentType: 'text/csv',
      },
    ],
  });

  return { from, to: opts.to, filename, bookingCount };
}
