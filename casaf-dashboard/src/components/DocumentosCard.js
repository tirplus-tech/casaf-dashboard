import React from 'react';

export default function DocumentosCard({ documentos, defaultExpanded = true }) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const visibleDocs = expanded ? documentos : documentos.slice(0, 2);

  return (
    <div className="surface-card animate-in stagger-2">
      <div className="card-header-row">
        <div>
          <div className="card-title">Documentos</div>
          <div className="card-helper-text">{documentos.length} arquivos relevantes para obra, cliente e equipe técnica.</div>
        </div>
        <button type="button" className="section-toggle-button" onClick={() => setExpanded((current) => !current)}>
          {expanded ? 'Mostrar menos' : 'Mostrar todos'}
        </button>
      </div>
      {visibleDocs.map((documento, index) => (
        <div
          key={documento.nome}
          className="doc-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 0',
            borderBottom: index < visibleDocs.length - 1 ? '0.5px solid #f1f5f9' : 'none',
            borderRadius: 16,
          }}
        >
          <div className="mini-badge" style={{ background: '#e0ecff', color: '#1d4ed8', fontSize: 10, padding: '6px 9px', flexShrink: 0 }}>
            {documento.tipo}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{documento.nome}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>Enviado em {documento.data}</div>
          </div>
        </div>
      ))}
      {!expanded && documentos.length > visibleDocs.length ? (
        <div className="collapsed-summary">Os demais arquivos continuam disponíveis aqui quando você expandir a seção.</div>
      ) : null}
    </div>
  );
}
