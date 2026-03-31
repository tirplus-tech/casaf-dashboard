import React from 'react';

function MetricCard({ metrica }) {
  return (
    <div className="surface-card metric-card animate-in">
      <div className="metric-label">{metrica.label}</div>
      <div className="metric-value">{metrica.valor}</div>
      <div className="metric-sub" style={{ color: metrica.cor }}>{metrica.sub}</div>
    </div>
  );
}

export default function MetricsGrid({ metricas }) {
  return (
    <div className="metrics-grid">
      {metricas.map((metrica) => (
        <MetricCard key={metrica.label} metrica={metrica} />
      ))}
    </div>
  );
}
