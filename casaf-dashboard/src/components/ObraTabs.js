import React from 'react';

export default function ObraTabs({ obras, obraAtiva, onSelect }) {
  return (
    <div className="obra-tabs animate-in stagger-1">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`obra-tab ${obraAtiva === null ? 'active' : ''}`}
      >
        <span className="obra-tab-title">Portfólio geral</span>
        <span className="obra-tab-meta">Visão consolidada das obras e prioridades</span>
      </button>
      {obras.map((obra, index) => (
        <button
          type="button"
          key={obra.id}
          onClick={() => onSelect(obra.id)}
          className={`obra-tab ${obraAtiva === index ? 'active' : ''}`}
        >
          <span className="obra-tab-title">{obra.nomeCurto || obra.nome}</span>
          <span className="obra-tab-meta">
            <span className="obra-tab-dot" style={{ background: obra.corDestaque }} />
            {obra.metricas[0].valor} • {obra.risco} • {obra.pendenciasAbertas} pendência(s)
          </span>
          <span className="obra-tab-kicker">{obra.proximaData}</span>
        </button>
      ))}
    </div>
  );
}
