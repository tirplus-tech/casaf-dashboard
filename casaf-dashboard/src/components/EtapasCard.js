import React from 'react';

function getBadgeStyles(status) {
  if (status === 'done') {
    return { background: '#dcfce7', color: '#16a34a', label: 'Concluído' };
  }

  if (status === 'active') {
    return { background: '#dbeafe', color: '#1d4ed8', label: 'Em andamento' };
  }

  return { background: '#f1f5f9', color: '#94a3b8', label: 'Pendente' };
}

function getStepStyles(status) {
  if (status === 'done') {
    return { background: '#dcfce7', color: '#16a34a', content: '✓' };
  }

  if (status === 'active') {
    return { background: '#0A1F44', color: 'white' };
  }

  return { background: '#f1f5f9', color: '#94a3b8' };
}

export default function EtapasCard({ etapas }) {
  return (
    <div className="surface-card animate-in stagger-2">
      <div className="card-title">Etapas da obra</div>
      {etapas.map((etapa) => {
        const badge = getBadgeStyles(etapa.status);
        const step = getStepStyles(etapa.status);

        return (
          <div key={etapa.num} className="step-row" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '0.5px solid #f1f5f9', borderRadius: 16 }}>
            <div
              className="step-index"
              style={{
                background: step.background,
                color: step.color,
              }}
            >
              {step.content || etapa.num}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{etapa.nome}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{etapa.data}</div>
            </div>
            <span className="step-badge" style={{ fontSize: 11, padding: '6px 10px', background: badge.background, color: badge.color }}>
              {badge.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
