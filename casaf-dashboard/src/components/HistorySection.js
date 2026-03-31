import React, { useState } from 'react';

function getFilterCount(filterId, timeline) {
  if (filterId === 'all') {
    return timeline.length;
  }

  if (filterId === 'operacao') {
    return timeline.filter((item) => ['tarefa', 'pendencia', 'checklist', 'apontamento', 'fechamento', 'decisao'].includes(item.type)).length;
  }

  return timeline.filter((item) => item.type === filterId).length;
}

export default function HistorySection({ timeline, defaultExpanded = true }) {
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(defaultExpanded);
  const options = [
    { id: 'all', label: 'Tudo' },
    { id: 'operacao', label: 'Operação' },
    { id: 'planejamento', label: 'Planejamento' },
    { id: 'foto', label: 'Fotos' },
    { id: 'solicitacao', label: 'Alertas' },
  ];

  const filteredTimeline = timeline.filter((item) => (
    filter === 'all'
      ? true
      : filter === 'operacao'
        ? ['tarefa', 'pendencia', 'checklist', 'apontamento', 'fechamento', 'decisao'].includes(item.type)
        : item.type === filter
  ));

  return (
    <div className="surface-card animate-in stagger-2 history-card">
      <div className="card-header-row">
        <div>
          <div className="card-title">Histórico da obra</div>
          <div className="card-helper-text">{filteredTimeline.length} eventos ajudam a reconstruir a tomada de decisão da obra.</div>
        </div>
        <button type="button" className="section-toggle-button" onClick={() => setExpanded((current) => !current)}>
          {expanded ? 'Recolher' : 'Expandir'}
        </button>
      </div>
      {expanded ? (
        <>
          <div className="history-summary-strip">
            <div className="history-summary-item">
              <span>Total</span>
              <strong>{timeline.length}</strong>
            </div>
            <div className="history-summary-item">
              <span>Operação</span>
              <strong>{getFilterCount('operacao', timeline)}</strong>
            </div>
            <div className="history-summary-item">
              <span>Alertas</span>
              <strong>{getFilterCount('solicitacao', timeline)}</strong>
            </div>
            <div className="history-summary-item">
              <span>Fotos</span>
              <strong>{getFilterCount('foto', timeline)}</strong>
            </div>
          </div>
          <div className="history-filters">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`history-filter-chip ${filter === option.id ? 'active' : ''}`}
                onClick={() => setFilter(option.id)}
              >
                {option.label} <span>{getFilterCount(option.id, timeline)}</span>
              </button>
            ))}
          </div>
          <div className="history-list">
            {filteredTimeline.length > 0 ? filteredTimeline.map((item, index) => (
              <div key={`${item.data}-${item.titulo}-${index}`} className="history-row">
                <div className="history-rail">
                  <div className={`history-dot ${item.type || 'default'}`} />
                  {index < filteredTimeline.length - 1 ? <div className="history-line" /> : null}
                </div>
                <div className="history-content">
                  <div className="history-meta">
                    <span className={`history-type-chip ${item.type || 'default'}`}>{item.origem || 'Sistema'}</span>
                    {item.autor ? <span className="history-author">{item.autor}</span> : null}
                    <span className="history-date-inline">{item.data}</span>
                  </div>
                  <div className="history-title">{item.titulo}</div>
                  <div className="history-copy">{item.descricao}</div>
                </div>
                <div className="history-date">{item.data}</div>
              </div>
            )) : (
              <div className="history-empty-state">
                Nenhum evento corresponde a esse filtro agora. Mude o recorte para revisar outras decisões e movimentações da obra.
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="collapsed-summary">
          Use este bloco para revisar decisões, alertas, evidências e movimentações recentes sem ocupar tanto espaço na visão geral.
        </div>
      )}
    </div>
  );
}
