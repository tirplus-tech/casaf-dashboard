import React from 'react';

const PERSONAS = [
  { id: 'executive', label: 'Diretoria', accent: 'Executivo', description: 'Risco, carteira e decisões do dia.' },
  { id: 'engineering', label: 'Engenharia', accent: 'Técnico', description: 'Prazo, frente ativa e liberação.' },
  { id: 'finance', label: 'Financeiro', accent: 'Financeiro', description: 'Medições, caixa e marcos de faturamento.' },
  { id: 'field', label: 'Campo', accent: 'Campo', description: 'Equipe, checklist e evidências da frente.' },
];

function getSyncMeta(syncStatus) {
  if (syncStatus === 'saving') {
    return { label: 'Salvando alterações...', tone: 'saving' };
  }

  if (syncStatus === 'saved') {
    return { label: 'Sincronizado com sucesso', tone: 'saved' };
  }

  if (syncStatus === 'error') {
    return { label: 'Falha ao sincronizar', tone: 'error' };
  }

  return { label: 'Pronto para operar', tone: 'idle' };
}

function getObraHealth(obra) {
  const criticalPendencias = obra?.operacao?.pendencias?.filter((item) => item.status === 'critico').length || 0;
  const checklistPendings = obra?.operacao?.checklist?.filter((item) => item.status !== 'done').length || 0;

  if (criticalPendencias > 0) {
    return { label: `${criticalPendencias} alerta(s) crítico(s)`, tone: 'critical' };
  }

  if (checklistPendings > 0) {
    return { label: `${checklistPendings} item(ns) para fechar`, tone: 'warning' };
  }

  return { label: 'Frente estável para hoje', tone: 'stable' };
}

function getPersonaConfig(persona, obra, portfolioSummary) {
  const configMap = {
    executive: {
      headline: obra ? 'Prioridade e decisão da obra' : 'Centro executivo do portfólio',
      description: obra
        ? `Veja risco, checkpoint e próxima decisão da ${obra.nomeCurto} sem navegar em excesso.`
        : 'Veja o que exige atenção agora e aprofunde só quando precisar.',
      badge: obra ? `Pendências abertas: ${obra.pendenciasAbertas}` : `Carteira ativa: ${portfolioSummary?.totalObras || 0} obra(s)`,
    },
    engineering: {
      headline: obra ? 'Coordenação técnica da frente' : 'Radar técnico das obras',
      description: obra
        ? `Abra prazo, liberação, MTEs e sequência de execução da ${obra.nomeCurto} sem depender de leitura dispersa.`
        : 'Use a home para localizar desvio de prazo, frente crítica e obra que exige revisão técnica imediata.',
      badge: obra ? `Checkpoint: ${obra.proximaData}` : `Próximo marco: ${portfolioSummary?.nextVisit ? `${portfolioSummary.nextVisit.nome} • ${portfolioSummary.nextVisit.data}` : 'Sem agenda'}`,
    },
    finance: {
      headline: obra ? 'Leitura financeira da obra' : 'Visão financeira consolidada',
      description: obra
        ? `Acompanhe medição, ritmo de execução e próximos marcos de liberação da ${obra.nomeCurto}.`
        : 'Enxergue a carteira sob gestão com foco em previsão, fechamento e marcos que afetam o caixa.',
      badge: obra ? `Status da obra: ${obra.status}` : `Pendências totais: ${portfolioSummary?.totalPendencias || 0}`,
    },
    field: {
      headline: obra ? 'Operação de campo da frente' : 'Ritmo operacional do sistema',
      description: obra
        ? `Use a obra como base para cobrar checklist, apontamento e evidência do que aconteceu em campo.`
        : 'A entrada do sistema orienta o dia da equipe com foco em prioridade, execução e fechamento com evidência.',
      badge: obra ? `Próxima ação: ${obra.proximaAcao}` : 'Fluxo recomendado: priorizar, executar, fechar',
    },
  };

  return configMap[persona] || configMap.executive;
}

export default function Topbar({
  obra,
  onBackToPortfolio,
  sectionLabel,
  syncStatus,
  portfolioSummary,
  productPersona,
  onChangePersona,
}) {
  const syncMeta = getSyncMeta(syncStatus);
  const currentPersona = PERSONAS.find((item) => item.id === productPersona) || PERSONAS[0];
  const personaConfig = getPersonaConfig(productPersona, obra, portfolioSummary);

  if (!obra) {
    const isAssistantView = sectionLabel === 'IA Assistente Especialista';

    return (
      <div className="topbar animate-in">
        <div className="topbar-left">
          <div className="topbar-brand-lockup">
            <img className="topbar-brand-symbol" src={`${process.env.PUBLIC_URL}/casaf-logo.png`} alt="CASAF" />
            <span className="topbar-brand-text">CASAF</span>
          </div>
          <div>
            {isAssistantView ? (
              <button type="button" className="topbar-backlink" onClick={onBackToPortfolio}>
                Voltar ao portfólio
              </button>
            ) : null}
            <div className="topbar-title">{isAssistantView ? 'IA Assistente Especialista' : personaConfig.headline}</div>
            <div className="topbar-subtitle">
              {isAssistantView
                ? 'Converse com a IA sobre o sistema inteiro, prioridades, riscos e decisões executivas.'
                : personaConfig.description}
            </div>
            <div className="topbar-context-row">
              <span className="topbar-context-pill active">{isAssistantView ? 'Aba dedicada da IA' : currentPersona.accent}</span>
              <span className="topbar-context-pill">{personaConfig.badge}</span>
            </div>
          </div>
        </div>
        <div className="topbar-right-zone">
          <div className="topbar-persona-switch">
            {PERSONAS.map((persona) => (
              <button
                key={persona.id}
                type="button"
                className={`topbar-persona-pill ${productPersona === persona.id ? 'active' : ''}`}
                onClick={() => onChangePersona(persona.id)}
              >
                {persona.label}
              </button>
            ))}
          </div>
          <div className="topbar-meta">
            <span className={`sync-pill ${syncMeta.tone}`}>{syncMeta.label}</span>
            <span className="status-pill">● Gestão ativa</span>
            <span className="client-pill">{portfolioSummary?.totalObras || 0} obras em acompanhamento</span>
            <span className="client-pill">
              Próximo checkpoint: {portfolioSummary?.nextVisit ? `${portfolioSummary.nextVisit.nome} • ${portfolioSummary.nextVisit.data}` : 'Sem agenda'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const obraHealth = getObraHealth(obra);

  return (
    <div className="topbar animate-in">
      <div className="topbar-left">
        <div className="topbar-brand-lockup">
          <img className="topbar-brand-symbol" src={`${process.env.PUBLIC_URL}/casaf-logo.png`} alt="CASAF" />
          <span className="topbar-brand-text">CASAF</span>
        </div>
        <div>
          <button type="button" className="topbar-backlink" onClick={onBackToPortfolio}>
            Portfólio geral
          </button>
          <div className="topbar-title">{obra.nome}</div>
          <div className="topbar-subtitle">{personaConfig.headline}</div>
          <div className="topbar-context-row">
            <span className="topbar-context-pill active">{sectionLabel || 'Visão geral'}</span>
            <span className="topbar-context-pill">{currentPersona.label}</span>
            <span className="topbar-context-pill">Atualizado em {obra.ultimaAtualizacao}</span>
            <span className={`topbar-context-pill topbar-health-pill ${obraHealth.tone}`}>{obraHealth.label}</span>
          </div>
        </div>
      </div>
      <div className="topbar-right-zone">
        <div className="topbar-persona-switch">
          {PERSONAS.map((persona) => (
            <button
              key={persona.id}
              type="button"
              className={`topbar-persona-pill ${productPersona === persona.id ? 'active' : ''}`}
              onClick={() => onChangePersona(persona.id)}
            >
              {persona.label}
            </button>
          ))}
        </div>
        <div className="topbar-meta">
          <span className={`sync-pill ${syncMeta.tone}`}>{syncMeta.label}</span>
          <span className="status-pill">● {obra.status}</span>
          <span className="client-pill">Cliente: {obra.cliente}</span>
          <span className="client-pill">Próximo checkpoint: {obra.proximaData}</span>
        </div>
      </div>
    </div>
  );
}
