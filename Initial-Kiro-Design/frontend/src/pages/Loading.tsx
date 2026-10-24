import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getPlan, getReport, lookupAddress, lookupCoords } from '../api';
import { Aerial } from '../components/Aerial';
import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';
import type { LookupResponse } from '../types';

const STEPS = ['Finding your block…', 'Reading satellite data…', 'Building your plan…'];
const MIN_STEP_MS = 700; // keeps each step visible long enough to read, even when the API is fast

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function atLeast<T>(p: Promise<T>): Promise<T> {
  const [v] = await Promise.all([p, wait(MIN_STEP_MS)]);
  return v;
}

export default function Loading() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [label, setLabel] = useState(params.get('address') ?? 'Your location');
  const [blockId, setBlockId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  const address = params.get('address');
  const lat = params.get('lat');
  const lon = params.get('lon');

  useEffect(() => {
    if (started.current) return; // React StrictMode runs effects twice in dev
    started.current = true;
    (async () => {
      try {
        const found: LookupResponse = await atLeast(
          lat && lon ? lookupCoords(lat, lon) : lookupAddress(address ?? ''),
        );
        if (found.status === 'out_of_coverage') {
          navigate(`/out-of-coverage?address=${encodeURIComponent(found.searched)}`, { replace: true });
          return;
        }
        if (found.status === 'not_found' || !found.location) {
          navigate('/', { replace: true, state: { error: "We couldn't find that address. Try adding the street and city." } });
          return;
        }
        const loc = found.location;
        setLabel(`${loc.label} · ${loc.city_line}`);
        setStep(1);
        await atLeast(getReport(loc.block_id));
        setStep(2);
        await atLeast(getPlan(loc.block_id, 'renter'));
        setStep(3);
        setBlockId(loc.block_id);
        await wait(600);
        navigate(`/report/${encodeURIComponent(loc.block_id)}`, { replace: true });
      } catch {
        setFailed(true);
      }
    })();
  }, [address, lat, lon, navigate]);

  const pct = step >= 3 ? 100 : Math.round(((step + 0.5) / 3) * 100);

  return (
    <Page minimalHeader footer={false}>
      <main className="center-main">
        <div className="center-card">
          <Aerial height={200} scanTop={[30, 100, 170, 100][step]} />
          <div className="stack" style={{ gap: 6 }}>
            <h1 style={{ fontSize: 28, lineHeight: '34px', fontWeight: 800 }} aria-live="polite">
              {failed ? 'Something went wrong' : step >= 3 ? 'Your report is ready' : 'Building your climate report'}
            </h1>
            <p className="muted" style={{ fontSize: 17 }}>{label}</p>
          </div>

          {failed ? (
            <>
              <p className="body">We couldn't reach the server. Check that the backend is running, then try again.</p>
              <Link to="/" className="btn btn-primary btn-lg">Back to search</Link>
            </>
          ) : (
            <>
              <div className="progress" role="progressbar" aria-label="Report progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                <div style={{ width: `${pct}%` }} />
              </div>
              <ol className="step-list">
                {STEPS.map((s, i) => (
                  <li key={s} style={{ fontWeight: i === step ? 700 : 500, color: i > step ? 'var(--muted-2)' : 'var(--ink)' }}>
                    {i < step && <span style={{ color: 'var(--teal)', display: 'flex' }}><Icon name="check" size={26} strokeWidth={2.2} label="Done" /></span>}
                    {i === step && (
                      <svg className="spin" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0B5563" strokeWidth="2.4" strokeLinecap="round" role="img" aria-label="In progress">
                        <circle cx="12" cy="12" r="10" stroke="#D3E4E8" />
                        <path d="M22 12a10 10 0 0 0-10-10" />
                      </svg>
                    )}
                    {i > step && <span style={{ color: '#9AA6B0', display: 'flex' }}><Icon name="circle" size={26} label="Waiting" /></span>}
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              {blockId ? (
                <Link to={`/report/${encodeURIComponent(blockId)}`} className="btn btn-primary btn-lg">
                  See my report <Icon name="arrowRight" />
                </Link>
              ) : (
                <p className="muted" style={{ textAlign: 'center', minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  This takes a few seconds.
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </Page>
  );
}
