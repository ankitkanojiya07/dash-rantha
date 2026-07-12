-- Rantha Hotel Booking Dashboard — PostgreSQL Schema
-- Roles: sync_writer (INSERT/UPDATE) + dashboard_reader (SELECT only)

-- Create roles
-- CREATE ROLE sync_writer WITH LOGIN PASSWORD 'changeme';
-- CREATE ROLE dashboard_reader WITH LOGIN PASSWORD 'changeme';

CREATE TABLE IF NOT EXISTS bookings (
  _id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref VARCHAR(20) NOT NULL UNIQUE,
  month_sheet VARCHAR(10) NOT NULL,
  guest_or_group_name VARCHAR(255) NOT NULL,
  final_room VARCHAR(50) NOT NULL,
  no_of_rooms INTEGER NOT NULL CHECK (no_of_rooms > 0),
  agent_name VARCHAR(255) NOT NULL,
  arrival_date DATE NOT NULL,
  departure_date DATE NOT NULL,
  nights INTEGER NOT NULL CHECK (nights > 0),
  room_category_or_status VARCHAR(100),
  remarks TEXT DEFAULT '',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_row INTEGER,
  CONSTRAINT valid_dates CHECK (departure_date > arrival_date)
);

CREATE INDEX idx_bookings_arrival ON bookings(arrival_date);
CREATE INDEX idx_bookings_departure ON bookings(departure_date);
CREATE INDEX idx_bookings_agent ON bookings(agent_name);
CREATE INDEX idx_bookings_month ON bookings(month_sheet);
CREATE INDEX idx_bookings_room ON bookings(final_room);

CREATE TABLE IF NOT EXISTS daily_occupancy (
  _id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  rooms_occupied INTEGER NOT NULL CHECK (rooms_occupied >= 0)
);

CREATE INDEX idx_occupancy_date ON daily_occupancy(date);

CREATE TABLE IF NOT EXISTS sync_logs (
  _id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sheets_processed INTEGER NOT NULL,
  rows_processed INTEGER NOT NULL,
  mismatches JSONB DEFAULT '[]',
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'warning', 'error'))
);

-- Materialized view for agent aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS agents_summary AS
SELECT
  agent_name,
  COUNT(*) AS total_bookings,
  SUM(nights * no_of_rooms) AS total_room_nights,
  SUM(no_of_rooms) AS total_rooms
FROM bookings
GROUP BY agent_name;

CREATE UNIQUE INDEX idx_agents_summary_name ON agents_summary(agent_name);

-- Permissions (run after creating roles)
-- GRANT SELECT ON bookings, daily_occupancy, sync_logs, agents_summary TO dashboard_reader;
-- GRANT INSERT, UPDATE, DELETE ON bookings, daily_occupancy, sync_logs TO sync_writer;
-- GRANT SELECT ON agents_summary TO dashboard_reader;
-- REVOKE ALL ON bookings FROM dashboard_reader; -- then re-grant SELECT only
