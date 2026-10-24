import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { OUTSIDE_SAMPLE, SAMPLE_ADDRESSES } from '../api';
import { Aerial } from '../components/Aerial';
import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>((location.state as { error?: string } | null)?.error ?? null);
  const [locating, setLocating] = useState(false);

  const go = (query: string) => navigate(`/loading?address=${encodeURIComponent(query)}`);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!address.trim()) {
      setError('Type an address to get started.');
      return;
    }
    go(address.trim());
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Your browser can't share your location. Type your address instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        navigate(`/loading?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
      },
      () => {
        setLocating(false);
        setError("We couldn't get your location. Type your address instead.");
      },
      { timeout: 10000 },
    );
  };

  return (
    <Page>
      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">Climate report card for Massachusetts homes</p>
              <h1 className="display">See how climate change shows up on your block, and what you can do about it.</h1>
              <p className="lead" style={{ maxWidth: 560 }}>
                Find out how hot your block gets in summer and how much tree cover it has. Then get a short plan that uses real Massachusetts programs.
              </p>

              <form id="search" className="search-form" onSubmit={onSubmit} noValidate>
                <label htmlFor="address" style={{ fontSize: 15, fontWeight: 700 }}>Your address</label>
                <div className="search-row">
                  <div className="input-wrap">
                    <Icon name="search" size={22} />
                    <input
                      id="address"
                      type="text"
                      autoComplete="street-address"
                      placeholder="Enter a Massachusetts address"
                      value={address}
                      onChange={(e) => { setAddress(e.target.value); setError(null); }}
                      aria-describedby={error ? 'address-error' : undefined}
                      aria-invalid={!!error}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-lg">Get my report</button>
                </div>
                {error && <p id="address-error" className="form-error" role="alert">{error}</p>}

                <div className="wrap" style={{ alignItems: 'center', gap: '8px 10px', marginTop: 6 }}>
                  <button type="button" className="btn btn-outline" style={{ borderRadius: 22, minHeight: 44 }} onClick={useMyLocation} disabled={locating}>
                    <Icon name="locate" size={18} />
                    {locating ? 'Finding you…' : 'Use my location'}
                  </button>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-3)', padding: '0 4px' }}>or try:</span>
                  {SAMPLE_ADDRESSES.map((s) => (
                    <button key={s.label} type="button" className="chip" onClick={() => go(s.query)}>
                      <span style={{ color: 'var(--teal)', display: 'flex' }}><Icon name="pin" size={18} /></span>
                      {s.label}
                    </button>
                  ))}
                </div>
                <Link to={`/loading?address=${encodeURIComponent(OUTSIDE_SAMPLE)}`} className="text-link underline" style={{ alignSelf: 'flex-start', fontWeight: 600 }}>
                  Try an address outside Boston
                </Link>
              </form>
            </div>

            <div className="hero-preview" aria-label="Sample report preview">
              <div className="wrap" style={{ justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-3)' }}>Sample report</span>
                <span className="muted" style={{ fontSize: 14 }}>Hudson St, Chinatown</span>
              </div>
              <Aerial height={220} />
              <div className="wrap" style={{ gap: 12 }}>
                <MiniScore value={82} name="Heat risk" badge="badge badge-heat-very-high" label="Very high" />
                <MiniScore value={18} name="Tree cover" badge="badge badge-tree-low" label="Low" />
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="container section stack" style={{ gap: 28 }}>
          <h2 className="h2">How it works</h2>
          <div className="steps-grid">
            {[
              ['Enter your address', 'We look at your whole block, not just your building. We start with Boston.'],
              ['We read the imagery', 'Landsat satellite data shows how hot the ground gets. MassGIS aerial photos show trees and roofs.'],
              ['Get your plan', 'See your scores and a short plan with real programs for renters and owners, like Mass Save rebates.'],
            ].map(([title, text], i) => (
              <div key={title} className="card stack" style={{ gap: 10 }}>
                <span className="step-num">{i + 1}</span>
                <h3 style={{ fontSize: 20, fontWeight: 800 }}>{title}</h3>
                <p className="body">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="band">
          <div className="container inner">
            <div className="stack" style={{ flex: '1 1 520px', gap: 8 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800 }}>Built on public data</h2>
              <p className="body" style={{ color: 'var(--ink-2)' }}>
                Scores compare your block with the rest of the city. They show ground temperature from one summer day. They are not official assessments.
              </p>
            </div>
            <Link to="/about" className="btn btn-outline">About the data <Icon name="arrowRight" size={18} /></Link>
          </div>
        </section>
      </main>
    </Page>
  );
}

function MiniScore({ value, name, badge, label }: { value: number; name: string; badge: string; label: string }) {
  return (
    <div style={{ flex: '1 1 160px', display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, background: 'var(--bg)' }}>
      <span style={{ fontSize: 32, fontWeight: 800 }}>{value}</span>
      <div className="stack" style={{ gap: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{name}</span>
        <span className={badge} style={{ fontSize: 12, padding: '2px 8px', alignSelf: 'flex-start' }}>{label}</span>
      </div>
    </div>
  );
}
