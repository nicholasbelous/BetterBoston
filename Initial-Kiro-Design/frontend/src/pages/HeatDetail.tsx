import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getReport } from '../api';
import { Gauge } from '../components/Gauge';
import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';
import { HEAT_COLORS, SCALE_RANGES, heatBadgeClass } from '../lib/scale';
import type { Report } from '../types';

const REASON_STYLE: Record<string, { icon: string; tint: string }> = {
  pavement: { icon: 'road', tint: 'tint-neutral' },
  few_trees: { icon: 'tree', tint: 'tint-tree' },
  dark_roofs: { icon: 'roof', tint: 'tint-dark' },
  shade: { icon: 'tree', tint: 'tint-tree' },
};

// Bars run from 80°F (empty) to 110°F (full).
const barWidth = (f: number) => `${Math.max(4, Math.min(100, ((f - 80) / 30) * 100))}%`;

export default function HeatDetail() {
  const { blockId = '' } = useParams();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getReport(blockId).then(setReport).catch(() => setError(true));
  }, [blockId]);

  const reportUrl = `/report/${encodeURIComponent(blockId)}`;

  return (
    <Page>
      <main className="container stack" style={{ gap: 24, paddingTop: 24, paddingBottom: 64 }}>
        <Link to={reportUrl} className="text-link" style={{ alignSelf: 'flex-start' }}>
          <Icon name="back" size={18} /> Back to report
        </Link>

        {error && <p className="body">We couldn't load this report. <Link to="/">Back to search</Link></p>}
        {!report && !error && <div className="skeleton" style={{ height: 600 }} aria-label="Loading" />}

        {report && (() => {
          const h = report.heat;
          const levelIndex = SCALE_RANGES.findIndex((s) => s.label === h.label);
          const hotter = h.delta_vs_city_f >= 1;
          const cooler = h.delta_vs_city_f <= -1;
          return (
            <>
              <div className="stack" style={{ gap: 4 }}>
                <h1 className="h1">Heat risk</h1>
                <span className="muted" style={{ fontSize: 17 }}>{report.location.label} · {report.location.city_line}</span>
              </div>

              <div className="wrap" style={{ gap: 24 }}>
                <div className="card stack" style={{ flex: '1 1 360px', minWidth: 0, alignItems: 'center', gap: 16, padding: '28px 24px' }}>
                  <Gauge score={h.score} label={h.label} colors={HEAT_COLORS} />
                  <span className={heatBadgeClass(h.label)} style={{ fontSize: 15, padding: '6px 14px', fontWeight: 800 }}>{h.label}</span>
                  <div className="legend-grid">
                    {SCALE_RANGES.map((s, i) => (
                      <div key={s.label} className="stack" style={{ gap: 4 }}>
                        <div className="swatch" style={{ background: HEAT_COLORS[i] }} />
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{s.label}</span>
                        <span className="muted" style={{ fontSize: 13 }}>{s.range}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card stack" style={{ flex: '1.4 1 440px', minWidth: 0, gap: 20, padding: '28px 24px' }}>
                  <div className="stack" style={{ gap: 4 }}>
                    <h2 className="h3">How hot does the ground get?</h2>
                    <span className="muted" style={{ fontSize: 15 }}>Summer afternoon, {report.data_notes.surface_temp_source.replace('Landsat, ', '')}</span>
                  </div>
                  <CompareRow name="Your block" temp={h.block_surface_temp_f} color={HEAT_COLORS[Math.max(0, levelIndex)]} strong />
                  <CompareRow name="Boston average" temp={h.city_avg_surface_temp_f} color={HEAT_COLORS[1]} />
                  <CompareRow name="Coolest neighborhood" temp={h.coolest_neighborhood_surface_temp_f} color={HEAT_COLORS[0]} />
                  <div className={`delta-pill ${hotter ? 'delta-hot' : 'delta-cool'}`}>
                    <Icon name={hotter ? 'arrowUp' : 'arrowDown'} size={16} strokeWidth={2.4} />
                    {hotter && `About ${Math.round(h.delta_vs_city_f)}°F hotter than the Boston average`}
                    {cooler && `About ${Math.round(Math.abs(h.delta_vs_city_f))}°F cooler than the Boston average`}
                    {!hotter && !cooler && 'About the same as the Boston average'}
                  </div>
                </div>
              </div>

              <div className="wrap" style={{ gap: 24 }}>
                <div className="card stack" style={{ flex: '1 1 420px', minWidth: 0, gap: 12, padding: '28px 24px' }}>
                  <h2 className="h3">What does this mean?</h2>
                  <p style={{ fontSize: 17, lineHeight: '27px', color: 'var(--ink-2)' }}>
                    This score is about how hot the ground gets: roofs, streets and sidewalks in the sun. It is not the air temperature on the weather report.
                  </p>
                  <p style={{ fontSize: 17, lineHeight: '27px', color: 'var(--ink-2)' }}>
                    Hot ground keeps heating the air around your home, even at night. That makes it harder for your body to cool down. It matters most for older adults, babies and young kids, and people with health conditions.
                  </p>
                </div>

                <div className="card stack" style={{ flex: '1 1 420px', minWidth: 0, gap: 18, padding: '28px 24px' }}>
                  <h2 className="h3">{hotter ? 'Why is my block hot?' : 'What shapes heat on my block?'}</h2>
                  {h.reasons.map((r) => {
                    const style = REASON_STYLE[r.id] ?? { icon: 'info', tint: 'tint-neutral' };
                    return (
                      <div key={r.id} className="reason">
                        <span className={`icon-tile ${style.tint}`}><Icon name={style.icon} size={22} /></span>
                        <div className="stack" style={{ gap: 2 }}>
                          <span style={{ fontSize: 17, fontWeight: 700 }}>{r.title}</span>
                          <span className="body">{r.text}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="cta-band">
                <div className="stack" style={{ flex: '1 1 400px', gap: 4 }}>
                  <h2 className="h3">Ready to cool things down?</h2>
                  <p className="body" style={{ color: 'var(--ink-2)' }}>See steps you can take, for renters and owners, using real Massachusetts programs.</p>
                </div>
                <Link to={`${reportUrl}#plan`} className="btn btn-primary btn-lg">See your action plan <Icon name="arrowRight" /></Link>
              </div>
            </>
          );
        })()}
      </main>
    </Page>
  );
}

function CompareRow({ name, temp, color, strong = false }: { name: string; temp: number; color: string; strong?: boolean }) {
  return (
    <div className="compare-row">
      <div className="labels">
        <span style={{ fontWeight: strong ? 700 : 600 }}>{name}</span>
        <span style={{ fontWeight: strong ? 800 : 700 }}>{Math.round(temp)}°F</span>
      </div>
      <div className="bar-track" aria-hidden="true">
        <div className="bar-fill" style={{ width: barWidth(temp), background: color }} />
      </div>
    </div>
  );
}
