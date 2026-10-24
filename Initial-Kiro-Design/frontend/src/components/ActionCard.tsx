import type { PlanAction } from '../types';
import { Icon } from './Icon';

const TINT: Record<string, string> = {
  snowflake: 'tint-blue',
  wind: 'tint-blue',
  tree: 'tint-tree',
  sun: 'tint-sun',
  bell: 'tint-alert',
  roof: 'tint-dark',
};

export function ActionCard({ action }: { action: PlanAction }) {
  const external = !!action.cta_url;
  return (
    <div className="action-card">
      <div className="top">
        <div className={`icon-tile ${TINT[action.icon] ?? 'tint-teal'}`} style={{ width: 48, height: 48 }}>
          <Icon name={action.icon} size={24} />
        </div>
        <div className="stack" style={{ gap: 6, minWidth: 0 }}>
          <h3>{action.title}</h3>
          {action.tag && <span className="tag">{action.tag}</span>}
          <p className="body">{action.why}</p>
        </div>
      </div>
      <a
        className="btn btn-outline"
        href={action.cta_url ?? '#'}
        target={external ? '_blank' : undefined}
        rel={external ? 'noreferrer' : undefined}
        aria-disabled={external ? undefined : true}
      >
        {action.icon === 'snowflake' && <Icon name="locate" size={18} />}
        {action.cta_label}
        <Icon name={external ? 'external' : 'chevron'} size={16} strokeWidth={2.4} />
        {external && <span className="sr-only">(opens in a new tab)</span>}
      </a>
    </div>
  );
}
