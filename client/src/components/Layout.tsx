import { useState, type ComponentType } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import type { IconProps } from '@solar-icons/react';
import {
  Widget,
  Calendar,
  ClipboardList,
  Chart,
  UsersGroupTwoRounded,
  Pulse,
  AltArrowLeft,
  AltArrowRight,
  Buildings,
} from '@solar-icons/react';

const ICON = { weight: 'BoldDuotone' as const };

const NAV_ITEMS: { to: string; label: string; icon: ComponentType<IconProps> }[] = [
  { to: '/', label: 'Dashboard', icon: Widget },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/bookings', label: 'Bookings', icon: ClipboardList },
  { to: '/agents', label: 'Agents', icon: Chart },
  { to: '/reports', label: 'Reports', icon: Chart },
  { to: '/guests', label: 'Guests', icon: UsersGroupTwoRounded },
  { to: '/sync', label: 'Data Health', icon: Pulse },
];

interface SidebarProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="app-layout">
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Buildings size={20} {...ICON} />
          </div>
          <span className="sidebar-title">Regency Hotel</span>
          <button
            className="collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            aria-label="Toggle sidebar"
          >
            {collapsed ? <AltArrowRight size={18} {...ICON} /> : <AltArrowLeft size={18} {...ICON} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`nav-item ${pathname === to ? 'active' : ''}`}
            >
              <Icon size={20} {...ICON} />
              <span className="nav-label">{label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
}
