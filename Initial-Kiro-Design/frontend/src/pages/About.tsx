import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';
import { SCALE_RANGES } from '../lib/scale';

const SOURCES = [
  {
    icon: 'image',
    title: 'MassGIS aerial imagery, 2025',
    text: 'Detailed photos of Massachusetts taken from airplanes in spring 2025. We use them to measure trees and greenery and to find roofs.',
    usedFor: 'Tree cover',
  },
  {
    icon: 'layers',
    title: 'NASA/USGS Landsat',
    text: 'A satellite that measures how hot the ground is. We use an image from a summer afternoon in July 2025.',
    usedFor: 'Heat risk',
  },
];

const LIMITS = [
  ['Ground temperature, not air temperature', 'Roofs and pavement get much hotter than the air you feel. The weather report measures air.'],
  ['One summer day', 'Heat risk comes from one clear July afternoon. Other days may be cooler or hotter.'],
  ['Comparisons, not official ratings', 'Scores compare your block with the rest of the city. They are not an official assessment of your home.'],
];

export default function About() {
  return (
    <Page>
      <main className="container stack" style={{ gap: 24, paddingTop: 'clamp(32px, 5vw, 64px)', paddingBottom: 72 }}>
        <div className="stack" style={{ gap: 10, maxWidth: 760 }}>
          <h1 className="display" style={{ fontSize: 'clamp(30px, 3.6vw, 46px)' }}>About the data</h1>
          <p className="lead">Where your report comes from, and what it can and can't tell you.</p>
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 800, marginTop: 16 }}>Where the data comes from</h2>
        <div className="wrap" style={{ gap: 20 }}>
          {SOURCES.map((s) => (
            <div key={s.title} className="card" style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', gap: 16 }}>
              <span className="icon-tile tint-teal" style={{ width: 48, height: 48 }}><Icon name={s.icon} size={24} /></span>
              <div className="stack" style={{ gap: 8, minWidth: 0 }}>
                <h3 style={{ fontSize: 19, lineHeight: '25px', fontWeight: 800 }}>{s.title}</h3>
                <p className="body">{s.text}</p>
                <span className="badge badge-neutral" style={{ alignSelf: 'flex-start' }}>Used for: {s.usedFor}</span>
              </div>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 800, marginTop: 16 }}>What the scores mean</h2>
        <div className="card stack" style={{ gap: 20 }}>
          <div className="wrap" style={{ gap: '20px 32px' }}>
            <ScoreExplainer icon="thermometer" tint="tint-heat" title="Heat risk" text="How hot your block's ground got compared with the rest of the city. Higher means hotter." />
            <ScoreExplainer icon="tree" tint="tint-tree" title="Tree cover" text="How much of your block has trees or greenery compared with the rest of the city. Higher means more shade." />
          </div>
          <div className="stack" style={{ gap: 10, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-3)' }}>Every score is 0 to 100</span>
            <div className="wrap" style={{ gap: 8 }}>
              {SCALE_RANGES.map((s) => (
                <div key={s.label} className="stack" style={{ flex: '1 1 120px', alignItems: 'center', gap: 2, padding: '10px 4px', borderRadius: 12, background: '#F3F5F6' }}>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>{s.label}</span>
                  <span className="muted" style={{ fontSize: 13 }}>{s.range}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 800, marginTop: 16 }}>Good to know</h2>
        <div className="wrap" style={{ gap: 20 }}>
          {LIMITS.map(([title, text], i) => (
            <div key={title} className="card stack" style={{ flex: '1 1 300px', minWidth: 0, gap: 10 }}>
              <span style={{ width: 32, height: 32, borderRadius: 16, background: 'var(--surface-2)', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{i + 1}</span>
              <h3 style={{ fontSize: 18, lineHeight: '24px', fontWeight: 800 }}>{title}</h3>
              <p className="body">{text}</p>
            </div>
          ))}
        </div>
      </main>
    </Page>
  );
}

function ScoreExplainer({ icon, tint, title, text }: { icon: string; tint: string; title: string; text: string }) {
  return (
    <div style={{ flex: '1 1 380px', display: 'flex', gap: 14 }}>
      <span className={`icon-tile sm ${tint}`} style={{ width: 40, height: 40 }}><Icon name={icon} strokeWidth={2.2} /></span>
      <div className="stack" style={{ gap: 4 }}>
        <span style={{ fontSize: 18, fontWeight: 800 }}>{title}</span>
        <span className="body">{text}</span>
      </div>
    </div>
  );
}
