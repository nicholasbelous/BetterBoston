import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Icon } from './Icon';

export const APP_NAME = 'BetterBoston';

export function Header({ minimal = false }: { minimal?: boolean }) {
  return (
    <header className="site-header">
      <Link to="/" className="brand">
        <span className="brand-mark"><Icon name="sun" /></span>
        {APP_NAME}
      </Link>
      {minimal ? (
        <Link to="/" className="nav-link">Cancel</Link>
      ) : (
        <nav aria-label="Main" className="nav">
          <Link to="/#how" className="nav-link">How it works</Link>
          <NavLink to="/about" className="nav-link">About the data</NavLink>
          <Link to="/#search" className="btn btn-primary">Check an address</Link>
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="inner">
        <span className="credit">
          <Icon name="layers" size={18} />
          Built with MassGIS aerial imagery and NASA/USGS Landsat data
        </span>
        <span>{APP_NAME} · Hackathon prototype</span>
      </div>
    </footer>
  );
}

export function Page({ children, minimalHeader = false, footer = true }: { children: ReactNode; minimalHeader?: boolean; footer?: boolean }) {
  return (
    <div className="page">
      <Header minimal={minimalHeader} />
      {children}
      {footer && <Footer />}
    </div>
  );
}
