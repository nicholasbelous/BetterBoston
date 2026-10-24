import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getPlan, getReport } from '../api';
import { ActionCard } from '../components/ActionCard';
import { Aerial } from '../components/Aerial';
import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';
import { ScaleBar } from '../components/ScaleBar';
import { HEAT_COLORS, TREE_COLORS, heatBadgeClass, heatLine, treeBadgeClass } from '../lib/scale';
import type { Plan, Report, Role } from '../types';

export default function ReportPage() {
  const { blockId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const role: Role = params.get('role') === 'owner' ? 'owner' : 'renter';

  const [report, setReport] = useState<Report | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getReport(blockId).then(setReport).catch(() => setError(true));
  }, [blockId]);

  useEffect(() => {
    setPlan(null);
    getPlan(blockId, role).then(setPlan).catch(() => setError(true));
  }, [blockId, role]);

  const setRole = (r: Role) => setParams(r === 'owner' ? { role: 'owner' } : {}, { replace: true });

  if (error) {
    return (
      <Page>
        <main className="center-main">
          <div className="center-card">
            <h1 className="h1">We couldn't load this report</h1>
            <p className="body">The block may not be in our data yet, or the server isn't running.</p>
            <Link to="/" className="btn btn-primary btn-lg">Back to search</Link>
          </div>
        </main>
      </Page>
    );
  }

  return (
    <Page>
      <main className="container stack" style={{ gap: 24, paddingTop: 24, paddingBottom: 64 }}>
        <Link to="/" className="text-link" style={{ alignSelf: 'flex-start' }}>
          <Icon name="back" size={18} /> New search
        </Link>

        {!report ? (
          <div className="skeleton" style={{ height: 520 }} aria-label="Loading report" />
        ) : (
          <>
            <div className="report-top">
              <div className="stack" style={{ gap: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--teal)' }}>Your climate report</span>
                <h1 className="h1">{report.location.label}</h1>
                <span className="muted" style={{ fontSize: 17 }}>{report.location.city_line}</span>
              </div>
              <a href="#plan" className="btn btn-primary">See your action plan <Icon name="arrowDown" size={18} /></a>
            </div>

            <div className="overview">
              <Aerial height={440} showLegend />
              <div className="scores">
                <div className="wrap" style={{ gap: 16 }}>
                  <Link to={`/report/${encodeURIComponent(blockId)}/heat`} className="score-card">
                    <div className="score-head">
                      <span className="icon-tile sm tint-heat"><Icon name="thermometer" strokeWidth={2.2} /></span>
                      Heat risk
                    </div>
                    <div className="score-value">
                      <span><span className="score-number">{report.heat.score}</span><span className="score-out-of">/100</span></span>
                      <span className={heatBadgeClass(report.heat.label)}>{report.heat.label}</span>
                    </div>
                    <ScaleBar score={report.heat.score} colors={HEAT_COLORS} label="Heat risk" />
                    <p className="body">{heatLine(report.heat.delta_vs_city_f)}</p>
                    <span className="see-details">See details <Icon name="chevron" size={16} strokeWidth={2.4} /></span>
                  </Link>

                  <div className="score-card">
                    <div className="score-head">
                      <span className="icon-tile sm tint-tree"><Icon name="tree" strokeWidth={2.2} /></span>
                      Tree cover
                    </div>
                    <div className="score-value">
                      <span><span className="score-number">{report.trees.score}</span><span className="score-out-of">/100</span></span>
                      <span className={treeBadgeClass(report.trees.label)}>{report.trees.label}</span>
                    </div>
                    <ScaleBar score={report.trees.score} colors={TREE_COLORS} label="Tree cover" />
                    <p className="body">About {Math.round(report.trees.canopy_pct)}% of your block is covered by trees or greenery</p>
                  </div>
                </div>

                <div className="card-dashed" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px' }}>
                  <span className="icon-tile tint-neutral" style={{ width: 40, height: 40 }}><Icon name="sun" size={22} /></span>
                  <div className="stack" style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-3)' }}>Solar potential</span>
                    <span className="muted" style={{ fontSize: 15 }}>How much sun your roof gets</span>
                  </div>
                  <span className="badge badge-neutral">Coming soon</span>
                </div>

                <div className="data-note">
                  <Icon name="info" size={18} />
                  <p className="small">
                    Ground temperature from {report.data_notes.surface_temp_source}. Aerial imagery from {report.data_notes.imagery_source}.
                    {' '}Scores compare your block with {report.data_notes.comparison_area}.{' '}
                    <Link to="/about" className="underline" style={{ fontWeight: 700 }}>About the data</Link>
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        <section id="plan" className="stack" style={{ marginTop: 32, gap: 20, scrollMarginTop: 24 }}>
          <div className="wrap" style={{ alignItems: 'center', justifyContent: 'space-between', gap: '16px 24px' }}>
            <h2 className="h2">Your plan for a cooler block</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span id="role-label" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-3)' }}>I'm a…</span>
              <div className="segmented" role="group" aria-labelledby="role-label">
                <button type="button" aria-pressed={role === 'renter'} onClick={() => setRole('renter')}>Renter</button>
                <button type="button" aria-pressed={role === 'owner'} onClick={() => setRole('owner')}>Owner</button>
              </div>
            </div>
          </div>

          {!plan ? (
            <div className="stack" style={{ gap: 16 }} aria-label="Loading your plan">
              <div className="skeleton" style={{ height: 130 }} />
              <div className="action-grid">
                {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ flex: '1 1 420px', height: 200 }} />)}
              </div>
            </div>
          ) : (
            <>
              <div className="stack" style={{ gap: 8 }}>
                <div className="summary-card" aria-live="polite">
                  <div className="head"><Icon name="sparkle" size={18} /> Summary for your {role === 'owner' ? 'home' : 'block'}</div>
                  <p>{plan.summary}</p>
                </div>
                <Link to="/about" className="ai-label">
                  <Icon name="info" size={16} />
                  {plan.generated_by === 'claude' ? 'AI-generated from verified Massachusetts programs' : 'Built from verified Massachusetts programs'}
                </Link>
              </div>
              <div className="action-grid">
                {plan.actions.map((a) => <ActionCard key={a.program_id} action={a} />)}
              </div>
            </>
          )}
          <p className="small muted">Programs, rebates and rules can change. Check details with each program before you apply.</p>
        </section>
      </main>
    </Page>
  );
}
