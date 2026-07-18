import { useEffect, useState, type ComponentType } from 'react';
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
  HamburgerMenu,
  CloseSquare,
} from '@solar-icons/react';

const ICON = { weight: 'BoldDuotone' as const };
const MOBILE_MQ = '(max-width: 768px)';

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const update = () => {
      setIsMobile(mq.matches);
      if (mq.matches) setMobileOpen(false);
    };
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const sidebarClass = [
    'sidebar',
    !isMobile && collapsed ? 'collapsed' : '',
    isMobile && mobileOpen ? 'mobile-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="app-layout">
      {isMobile && mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={sidebarClass}>
        <button
          className="collapse-btn"
          onClick={() => {
            if (isMobile) setMobileOpen(false);
            else setCollapsed(!collapsed);
          }}
          aria-label={isMobile ? 'Close menu' : 'Toggle sidebar'}
        >
          {isMobile ? (
            <CloseSquare size={18} {...ICON} />
          ) : collapsed ? (
            <AltArrowRight size={18} {...ICON} />
          ) : (
            <AltArrowLeft size={18} {...ICON} />
          )}
        </button>

        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Buildings size={20} {...ICON} />
          </div>
          <span className="sidebar-title">Regency Hotel</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`nav-item ${pathname === to ? 'active' : ''}`}
              onClick={() => {
                if (isMobile) setMobileOpen(false);
              }}
            >
              <Icon size={20} {...ICON} />
              <span className="nav-label">{label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        {isMobile && (
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <HamburgerMenu size={20} {...ICON} />
          </button>
        )}
        {children}
      </main>
    </div>
  );
}
