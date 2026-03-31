import React, { useState } from 'react';

const PERSONA_COPY = {
  executive: 'Veja aqui a fila de decisões que move prazo, percepção do cliente e caixa sem abrir várias telas.',
  engineering: 'Use esta fila para destravar frente, liberação técnica e sequência da obra com rapidez.',
  finance: 'Esta fila concentra o que ainda segura fechamento, pagamento ou resposta para cobrança.',
  field: 'Essa leitura mostra o que cobrar hoje no canteiro e o que precisa sair com evidência e dono claro.',
};

function getStatusTone(status) {
  if (status === 'Concluída') {
    return 'done';
  }

  if (status === 'Em andamento' || status === 'Em tratativa' || status === 'Aguardando retorno') {
    return 'active';
  }

  return 'pending';
}

function getCounts(decisions) {
  return decisions.reduce((acc, item) => {
    if (item.status === 'Concluída') {
      acc.done += 1;
    } else if (item.status === 'Em andamento' || item.status === 'Em tratativa' || item.status === 'Aguardando retorno') {
      acc.active += 1;
    } else {
      acc.pending += 1;
    }

    return acc;
  }, { pending: 0, active: 0, done: 0 });
}

export default function DecisionBoard({
  title = 'Decisões da obra',
  helper,
  decisions,
  onAdvance,
  onAddAlignment,
  onOpenSection,
  productPersona = 'executive',
}) {
  const [alignmentDrafts, setAlignmentDrafts] = useState({});
  const counts = getCounts(decisions);
  const personaCopy = PERSONA_COPY[productPersona] || PERSONA_COPY.executive;

  return (
    <div className="surface-card animate-in decision-board-card">
      <div className="card-header-row">
        <div>
          <div className="card-title">{title}</div>
          <div className="card-helper-text">{helper || personaCopy}</div>
        </div>
        <div className="decision-summary-row">
          <div className="decision-summary-pill">
            <span>A decidir</span>
            <strong>{counts.pending}</strong>
          </div>
          <div className="decision-summary-pill active">
            <span>Em andamento</span>
            <strong>{counts.active}</strong>
          </div>
          <div className="decision-summary-pill done">
            <span>Concluídas</span>
            <strong>{counts.done}</strong>
          </div>
        </div>
      </div>

      {decisions.length > 0 ? (
        <div className="decision-board-list">
          {decisions.map((item, index) => {
            const tone = getStatusTone(item.status);

            return (
              <div key={item.id || `${item.titulo}-${index}`} className="decision-board-row">
                <div className="decision-board-main">
                  <div className="decision-board-topline">
                    <span className="decision-area-chip">{item.area}</span>
                    <span className={`decision-status-pill ${tone}`}>{item.status}</span>
                  </div>
                  <div className="decision-board-title">{item.titulo}</div>
                  <div className="decision-board-copy">{item.contexto}</div>
                  <div className="decision-board-meta">
                    <span><strong>Dono:</strong> {item.responsavel}</span>
                    <span><strong>Prazo:</strong> {item.prazo}</span>
                    <span><strong>Última movimentação:</strong> {item.ultimaMovimentacao}</span>
                  </div>
                  {item.alinhamento ? <div className="decision-board-note">{item.alinhamento}</div> : null}
                  <div className="decision-board-inline-note">
                    <input
                      className="operation-input"
                      value={alignmentDrafts[item.id || index] || ''}
                      onChange={(event) => setAlignmentDrafts((current) => ({ ...current, [item.id || index]: event.target.value }))}
                      placeholder="Registrar alinhamento rápido desta decisão..."
                    />
                    <button
                      type="button"
                      className="inline-action-button"
                      onClick={() => {
                        onAddAlignment?.(item.id || index, alignmentDrafts[item.id || index] || '');
                        setAlignmentDrafts((current) => ({ ...current, [item.id || index]: '' }));
                      }}
                    >
                      Salvar alinhamento
                    </button>
                  </div>
                </div>
                <div className="decision-board-actions">
                  {item.targetSection ? (
                    <button
                      type="button"
                      className="inline-action-button"
                      onClick={() => onOpenSection(item.targetSection)}
                    >
                      Abrir área
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="portfolio-card-button decision-action-button"
                    onClick={() => onAdvance(item.id || index)}
                  >
                    Avançar decisão
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="collapsed-summary">Sem decisões formais abertas nesta obra. Esse é um bom sinal de estabilidade e alinhamento.</div>
      )}
    </div>
  );
}
