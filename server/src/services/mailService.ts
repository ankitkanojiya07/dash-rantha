import nodemailer from 'nodemailer';
import type { Booking } from '../types.js';

function mailConfig() {
  const from = process.env.MAIL_FROM || 'ranthambhoreregency@gmail.com';
  const user = process.env.MAIL_USER || process.env.MAIL_FROM || from;
  const pass = (process.env.MAIL_PASS || process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  return { from, user, pass };
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
  bookingCount: number;
  guestOrGroup?: string;
}) {
  assertMailConfigured();
  const { from, user, pass } = mailConfig();

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  const guestSuffix = opts.guestOrGroup
    ? `_guest_${opts.guestOrGroup.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40)}`
    : '';
  const filename = `${opts.agentName.replace(/[^a-zA-Z0-9_-]+/g, '_')}_bookings_${opts.fromDate}_to_${opts.toDate}${guestSuffix}.csv`;
  const guestLabel = opts.guestOrGroup ? ` — ${opts.guestOrGroup}` : '';
  const subject = `Booking report — ${opts.agentName}${guestLabel} (${opts.fromDate} to ${opts.toDate})`;
  const text = [
    `Dear ${opts.agentName},`,
    '',
    `Please find attached the booking details for ${opts.fromDate} to ${opts.toDate}.`,
    opts.guestOrGroup ? `Filtered guest/group: ${opts.guestOrGroup}.` : '',
    `Total bookings in this period: ${opts.bookingCount}.`,
    '',
    opts.bookingCount === 1
      ? "What's the update on this booking?"
      : "What's the update on these bookings?",
    '',
    'Regards,',
    'Ranthambhore Regency',
  ]
    .filter(Boolean)
    .join('\n');

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

  return { from, to: opts.to, filename, bookingCount: opts.bookingCount };
}
