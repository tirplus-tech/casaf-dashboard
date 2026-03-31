import React from 'react';

const portfolioActions = [
  { id: 'prioritaria', label: 'Abrir obra prioritária' },
  { id: 'alerts', label: 'Ir para alertas' },
  { id: 'updates', label: 'Ver atualizações' },
  { id: 'library', label: 'Abrir biblioteca' },
];

const sectionHints = {
  visao: 'Resumo executivo e decisões do dia',
  assistente_portfolio: 'IA geral do sistema com leitura executiva do portfólio',
  assistente: 'IA Assistente Especialista com leitura e ação contextual',
  operacao: 'Equipe, pendências, checklist e produção',
  planejamento: 'Cronograma, indicadores e MTEs',
  etapas: 'Linha macro do avanço da obra',
  financeiro: 'Medições, contrato e liberações',
  fotos: 'Evidências visuais e registros de campo',
  documentos: 'Arquivos técnicos e materiais compartilhados',
};

const personaCopy = {
  executive: {
    title: 'Diretoria ativa',
    description: 'Use o sistema para decidir prioridade, remover bloqueios e conduzir checkpoints executivos.',
  },
  engineering: {
    title: 'Engenharia ativa',
    description: 'Acompanhe frente, prazo, liberação e sequência técnica sem perder o contexto do portfólio.',
  },
  finance: {
    title: 'Financeiro ativo',
    description: 'Conecte avanço da obra com medição, fechamento e próximos marcos de liberação.',
  },
  field: {
    title: 'Campo ativo',
    description: 'Abra o dia com checklist, apontamento e evidência antes do fechamento da frente.',
  },
};

export default function Sidebar({ items, navAtiva, onSelect, portfolioPanel, obra, account, onOpenAccount, onLogout, productPersona }) {
  const criticalPendencias = obra?.operacao?.pendencias?.filter((item) => item.status === 'critico').length || 0;
  const pendingChecklist = obra?.operacao?.checklist?.filter((item) => item.status !== 'done').length || 0;
  const currentPersona = personaCopy[productPersona] || personaCopy.executive;

  return (
    <div className="dashboard-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-row">
          <img className="sidebar-logo-symbol" src={`${process.env.PUBLIC_URL}/casaf-logo.png`} alt="CASAF" />
          <div className="sidebar-brand-copy">
            <span className="sidebar-brand-name">CASAF</span>
          </div>
        </div>
        <div className="sidebar-brand-subtitle">
          Painel executivo para acompanhamento de obras com clareza, confiança e apresentação elegante.
        </div>
        <div className="sidebar-workspace-card">
          <div className="sidebar-workspace-label">Workspace ativo</div>
          <strong>CASAF Engenharia • Operação Brasília</strong>
          <div className="sidebar-workspace-meta">
            <span>Multiobra</span>
            <span>IA especialista</span>
          </div>
        </div>
        <div className="sidebar-workspace-card sidebar-workspace-card-accent">
          <div className="sidebar-workspace-label">{currentPersona.title}</div>
          <strong>{currentPersona.description}</strong>
        </div>
      </div>
      <div className="sidebar-account-zone sidebar-account-zone-top">
        <button type="button" className="sidebar-account-card" onClick={onOpenAccount}>
          <span className="sidebar-account-avatar">
            {account?.profile?.photo ? (
              <img className="sidebar-account-avatar-image" src={account.profile.photo} alt={account.displayName} />
            ) : (
              <span>{account?.initials || 'CA'}</span>
            )}
          </span>
          <span className="sidebar-account-copy">
            <strong>{account?.displayName || 'Equipe CASAF'}</strong>
            <span>{account?.profile?.sector || account?.profile?.role || 'Conta da equipe'}</span>
          </span>
        </button>
        <button type="button" className="sidebar-account-logout" onClick={onLogout}>Sair</button>
      </div>
      {items.length > 0 ? (
        <div className="sidebar-nav">
          <div className="sidebar-nav-label">Navegação principal</div>
          {items.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`sidebar-item animate-in ${navAtiva === item.id ? 'active' : ''}`}
            >
              <span className="sidebar-item-label">{item.label}</span>
              {item.id === navAtiva ? <span className="sidebar-item-hint">{sectionHints[item.id]}</span> : null}
            </button>
          ))}

          {obra ? (
            <div className="sidebar-workboard-card animate-in">
              <div className="sidebar-workboard-label">Pulso da obra</div>
              <strong>{obra.nomeCurto}</strong>
              <div className="sidebar-workboard-metrics">
                <div>
                  <span>Progresso</span>
                  <strong>{obra.metricas[0].valor}</strong>
                </div>
                <div>
                  <span>Risco</span>
                  <strong>{obra.risco}</strong>
                </div>
              </div>
              <div className="sidebar-workboard-tags">
                <span className={`sidebar-workboard-tag ${criticalPendencias > 0 ? 'critical' : 'stable'}`}>
                  {criticalPendencias > 0 ? `${criticalPendencias} crítico(s)` : 'Sem crítico'}
                </span>
                <span className="sidebar-workboard-tag">{pendingChecklist} no checklist</span>
                <span className="sidebar-workboard-tag">{obra.proximaData}</span>
              </div>
              <p>{obra.proximaAcao}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="sidebar-empty-state">
          <div className="sidebar-empty-title">Portfólio geral</div>
          <div className="sidebar-empty-copy">
            Comece pelo foco do dia ou use os atalhos rápidos para chegar na área certa sem navegar demais.
          </div>
          {portfolioPanel ? (
            <>
              <div className="sidebar-portfolio-stats">
                <div className="sidebar-portfolio-stat">
                  <span>Obras ativas</span>
                  <strong>{portfolioPanel.totalObras}</strong>
                </div>
                <div className="sidebar-portfolio-stat">
                  <span>Pendências abertas</span>
                  <strong>{portfolioPanel.totalPendencias}</strong>
                </div>
                <div className="sidebar-portfolio-stat">
                  <span>Próxima agenda</span>
                  <strong>{portfolioPanel.nextVisit}</strong>
                </div>
              </div>

              <div className="sidebar-quick-actions">
                {portfolioActions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => portfolioPanel.onQuickAction(item.id)}
                    className={`sidebar-quick-action ${portfolioPanel.focusTarget === item.id ? 'active' : ''}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="sidebar-focus-card">
                <div className="sidebar-focus-label">Obra em maior atenção</div>
                <strong>{portfolioPanel.obraPrioritaria}</strong>
                <span>Use este atalho para abrir rapidamente o projeto que exige decisão mais urgente.</span>
              </div>

              <div className="sidebar-focus-card sidebar-focus-card-secondary">
                <div className="sidebar-focus-label">Ritmo do dia</div>
                <strong>{portfolioPanel.nextVisit}</strong>
                <span>Esse é o próximo marco visível do portfólio. A equipe consegue usar esse bloco como checkpoint operacional rápido.</span>
              </div>

              <div className="sidebar-focus-card sidebar-focus-card-tertiary">
                <div className="sidebar-focus-label">Fluxo recomendado</div>
                <strong>Prioridade • Evidência • Fechamento</strong>
                <span>Use o sistema primeiro para decidir, depois para executar e por fim para consolidar o fechamento da frente.</span>
              </div>
            </>
          ) : null}
        </div>
      )}

    </div>
  );
}
