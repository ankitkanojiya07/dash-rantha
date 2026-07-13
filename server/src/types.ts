export interface Booking {
  _id: string;
  bookingRef: string;
  monthSheet: string;
  guestOrGroupName: string;
  finalRoom: string;
  noOfRooms: number;
  agentName: string;
  arrivalDate: string;
  departureDate: string;
  nights: number;
  roomCategoryOrStatus: string;
  remarks: string;
  syncedAt: string;
  sourceRow: number;
}

export interface Agent {
  _id: string;
  agentName: string;
  totalBookings: number;
  totalRoomNights: number;
  totalRooms: number;
}

export interface DailyOccupancy {
  _id: string;
  date: string;
  roomsOccupied: number;
}

export interface SyncMismatch {
  date: string;
  expectedTotal: number;
  actualSum: number;
}

export interface SyncLog {
  _id: string;
  syncedAt: string;
  sheetsProcessed: number;
  rowsProcessed: number;
  mismatches: SyncMismatch[];
  status: 'success' | 'warning' | 'error';
  /** Always Google Drive for this dashboard. */
  source: 'google';
}

export interface DashboardKPIs {
  occupancyToday: number;
  occupancyThisWeek: number;
  totalRoomNightsMTD: number;
  activeBookings: number;
  topAgentThisMonth: { name: string; roomNights: number };
  lastSyncAt: string;
  totalRooms: number;
}

export interface BookingOverlap {
  booking1: Booking;
  booking2: Booking;
  room: string;
  overlapStart: string;
  overlapEnd: string;
}
