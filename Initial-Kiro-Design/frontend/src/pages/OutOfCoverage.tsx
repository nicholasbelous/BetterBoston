import { Link, useSearchParams } from 'react-router-dom';
import { SAMPLE_ADDRESSES } from '../api';
import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';

export default function OutOfCoverage() {
  const [params] = useSearchParams();
  const searched = params.get('address');

  return (
    <Page>
      <main className="center-main">
        <div className="center-card" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: 104, height: 104, borderRadius: 52, background: 'var(--surface-2)', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="map" size={48} strokeWidth={1.8} />
          </div>
          <h1 className="h1" style={{ fontSize: 'clamp(26px, 3vw, 34px)' }}>We don't have data for this area yet</h1>
          <p className="lead">We're starting with Boston and expanding across Massachusetts.</p>
          {searched && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, background: '#F3F5F6', fontSize: 15, color: 'var(--ink-3)' }}>
              <Icon name="search" size={16} />
              You searched: {searched}
            </div>
          )}
          <div className="wrap" style={{ justifyContent: 'center', gap: 12, marginTop: 8 }}>
            <Link to={`/loading?address=${encodeURIComponent(SAMPLE_ADDRESSES[0].query)}`} className="btn btn-primary btn-lg">Try a sample address</Link>
            <Link to="/" className="btn btn-outline btn-lg">Search a different address</Link>
          </div>
        </div>
      </main>
    </Page>
  );
}
