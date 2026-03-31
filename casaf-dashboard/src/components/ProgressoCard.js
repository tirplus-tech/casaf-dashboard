import React from 'react';

function getBarColor(valor) {
  return valor < 20 ? '#f59e0b' : '#1a6fd4';
}

export default function ProgressoCard({ progresso }) {
  return (
    <div className="surface-card animate-in stagger-3">
      <div className="card-title">Progresso por área</div>
      {progresso.map((item) => (
        <div key={item.area} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 7 }}>
            <span>{item.area}</span>
            <span>{item.valor}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-bar" style={{ width: `${item.valor}%`, background: getBarColor(item.valor) }} />
          </div>
        </div>
      ))}
    </div>
  );
}
