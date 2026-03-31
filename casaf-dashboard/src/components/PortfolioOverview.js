import React, { useEffect, useRef, useState } from 'react';
import { getPortfolioAssistantSuggestions, getPortfolioSnapshot, parseDashboardDateLabel } from '../services/obraAssistant';

function formatCompactCurrency(valor) {
  if (valor >= 1000000) {
    return `R$ ${(valor / 1000000).toFixed(2).replace('.', ',')} mi`;
  }

  return `R$ ${(valor / 1000).toFixed(0)}k`;
}

function getWorkloadLabel(obra) {
  if (obra.pendenciasAbertas >= 4 || obra.prioridade === 'Alta') {
    return 'Alta atenção';
  }

  if (obra.pendenciasAbertas >= 2 || obra.risco === 'Moderado') {
    return 'Monitorar';
  }

  return 'Estável';
}

function getPersonaExperience(persona, todayFocus, nextVisit, obraPrioritaria, totalPendencias, criticalWorks) {
  const experienceMap = {
    executive: {
      label: 'Leitura para diretoria',
      title: 'Veja primeiro a decisão, depois o detalhe',
      description: 'A home foi reorganizada para mostrar o foco do dia, o próximo checkpoint e a obra que pede atuação da liderança.',
      bullets: [
        `Obra foco: ${todayFocus ? todayFocus.nomeCurto : 'Sem foco dominante'}`,
        `Checkpoint-chave: ${nextVisit ? `${nextVisit.nome} • ${nextVisit.data}` : 'Sem agenda definida'}`,
        `Pendências no conjunto: ${totalPendencias}`,
      ],
    },
    engineering: {
      label: 'Leitura para engenharia',
      title: 'Abra a frente certa e aprofunde só quando precisar',
      description: 'O fluxo técnico prioriza obra crítica, checkpoint e próximos passos antes de expor a camada analítica completa.',
      bullets: [
        `Frente prioritária: ${obraPrioritaria ? obraPrioritaria.nomeCurto : 'Sem desvio concentrado'}`,
        `Próxima entrega: ${nextVisit ? `${nextVisit.nome} • ${nextVisit.data}` : 'Sem marco iminente'}`,
        `Obras em alta atenção: ${criticalWorks}`,
      ],
    },
    finance: {
      label: 'Leitura para financeiro',
      title: 'Veja o que afeta fechamento e comunicação externa',
      description: 'A experiência destaca as obras que puxam risco e deixa resumo para cliente e carteira mais rápidos de acessar.',
      bullets: [
        `Obra com mais pressão: ${obraPrioritaria ? obraPrioritaria.nomeCurto : 'Sem pressão dominante'}`,
        `Próximo marco: ${nextVisit ? nextVisit.data : 'Sem agenda definida'}`,
        `Pendências com impacto potencial: ${totalPendencias}`,
      ],
    },
    field: {
      label: 'Leitura para campo',
      title: 'Priorize, execute e feche com menos distração',
      description: 'O sistema agora tenta mostrar primeiro o que precisa acontecer hoje e esconder o excesso até que a equipe realmente precise dele.',
      bullets: [
        `Frente do dia: ${todayFocus ? todayFocus.nomeCurto : 'Sem frente dominante'}`,
        `Checkpoint operacional: ${nextVisit ? `${nextVisit.nome} • ${nextVisit.data}` : 'Sem agenda'}`,
        `Pendências ainda abertas: ${totalPendencias}`,
      ],
    },
  };

  return experienceMap[persona] || experienceMap.executive;
}

function countCriticalWorks(obras) {
  return obras.filter((obra) => obra.prioridade === 'Alta' || obra.pendenciasAbertas >= 3).length;
}

function buildGapScanner(obras) {
  return obras
    .map((obra) => {
      const gaps = [];

      if (obra.fotosObra.length === 0) {
        gaps.push('Sem evidência visual');
      }

      if (obra.operacao.checklist.some((item) => item.status !== 'done')) {
        gaps.push('Checklist aberto');
      }

      if (obra.operacao.pendencias.some((item) => item.status === 'critico')) {
        gaps.push('Pendência crítica');
      }

      return {
        obra,
        gaps,
      };
    })
    .filter((item) => item.gaps.length > 0)
    .slice(0, 4);
}

function buildClientSummary(obras, obraPrioritaria, nextVisit, totalPendencias) {
  return [
    `${obras.length} obra(s) seguem em acompanhamento ativo no portfólio.`,
    obraPrioritaria
      ? `${obraPrioritaria.nomeCurto} concentra a maior atenção do momento.`
      : 'O portfólio está sem uma frente dominante de risco neste momento.',
    nextVisit
      ? `O próximo checkpoint relevante está em ${nextVisit.nome} na data ${nextVisit.data}.`
      : 'Não há checkpoint imediato registrado neste momento.',
    `O conjunto mantém ${totalPendencias} pendência(s) aberta(s) sob gestão.`,
  ];
}

function sortByDashboardDateDesc(items) {
  return [...items].sort((a, b) => {
    const left = parseDashboardDateLabel(a.data)?.getTime() || 0;
    const right = parseDashboardDateLabel(b.data)?.getTime() || 0;

    return right - left;
  });
}

function getPendingChecklistCount(obra) {
  return obra.operacao.checklist.filter((item) => item.status !== 'done').length;
}

function getOpenDecisionCount(obra) {
  return (obra.decisoes || []).filter((item) => item.status !== 'Concluída').length;
}

function getAwaitingResponseCount(obra) {
  const pendencias = obra.operacao.pendencias.filter((item) => ['aguardando', 'aguardando_retorno', 'em_tratativa'].includes(item.status)).length;
  const decisions = (obra.decisoes || []).filter((item) => ['A decidir', 'Em tratativa', 'Aguardando retorno', 'Em andamento'].includes(item.status)).length;

  return pendencias + decisions;
}

function buildPersonaDutyBoard(persona, obras) {
  const sortedByPressure = [...obras].sort((a, b) => {
    const leftScore = (a.pendenciasAbertas * 2) + getOpenDecisionCount(a);
    const rightScore = (b.pendenciasAbertas * 2) + getOpenDecisionCount(b);

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    const leftDate = parseDashboardDateLabel(a.proximaData)?.getTime() || Number.POSITIVE_INFINITY;
    const rightDate = parseDashboardDateLabel(b.proximaData)?.getTime() || Number.POSITIVE_INFINITY;
    return leftDate - rightDate;
  });

  const openFinanceRows = obras.flatMap((obra) => (obra.financeiroOperacional?.colaboradores || [])
    .filter((item) => item.nfStatus !== 'Emitida' || item.cobrancaStatus === 'Alta')
    .map((item) => ({
      obraId: obra.id,
      obraNome: obra.nomeCurto,
      title: item.nome,
      subtitle: item.motivoCobranca || item.observacaoFinanceira || 'Fechamento ainda exige atuação.',
      meta: item.fechamentoStatus || item.pagamentoStatus || 'Em apuração',
    })));

  const boardMap = {
    executive: {
      title: 'Fila da liderança hoje',
      helper: 'O que a diretoria precisa destravar para o sistema continuar vivo no dia a dia.',
      items: sortedByPressure.slice(0, 3).map((obra) => ({
        obraId: obra.id,
        title: obra.nomeCurto,
        subtitle: obra.proximaAcao,
        meta: `${getOpenDecisionCount(obra)} decisão(ões) abertas • ${obra.pendenciasAbertas} pendência(s)`,
      })),
    },
    engineering: {
      title: 'Fila técnica do dia',
      helper: 'Aberturas e bloqueios que a engenharia precisa resolver antes de entrar em detalhe.',
      items: sortedByPressure.slice(0, 3).map((obra) => ({
        obraId: obra.id,
        title: obra.nomeCurto,
        subtitle: obra.operacao.pendencias.find((item) => item.status === 'critico')?.titulo || obra.proximaAcao,
        meta: `${getPendingChecklistCount(obra)} item(ns) de checklist • checkpoint ${obra.proximaData}`,
      })),
    },
    finance: {
      title: 'Fila financeira do dia',
      helper: 'Casos que mais podem virar cobrança, atraso de pagamento ou ruído com fornecedor.',
      items: (openFinanceRows.length > 0 ? openFinanceRows : sortedByPressure.slice(0, 3).map((obra) => ({
        obraId: obra.id,
        obraNome: obra.nomeCurto,
        title: obra.nomeCurto,
        subtitle: obra.financeiroResumo[2]?.sub || obra.proximaAcao,
        meta: `${obra.financeiroResumo[2]?.valor || 'Sem valor'} • ${obra.proximaData}`,
      }))).slice(0, 3),
    },
    field: {
      title: 'Fila operacional do campo',
      helper: 'O que a equipe precisa usar todos os dias para não perder prioridade, disciplina e fechamento.',
      items: sortedByPressure.slice(0, 3).map((obra) => ({
        obraId: obra.id,
        title: obra.nomeCurto,
        subtitle: obra.operacao.tarefasDia.find((item) => item.status === 'prioridade')?.titulo || obra.proximaAcao,
        meta: `${getPendingChecklistCount(obra)} checklist aberto(s) • ${obra.fotosObra.length} evidência(s)`,
      })),
    },
  };

  return boardMap[persona] || boardMap.executive;
}

function buildResponseDebtBoard(persona, obras) {
  const ranked = [...obras]
    .map((obra) => ({
      obra,
      count: getAwaitingResponseCount(obra),
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const labelMap = {
    executive: 'Sem resposta da liderança',
    engineering: 'Sem resposta técnica',
    finance: 'Sem resposta financeira',
    field: 'Sem resposta da operação',
  };

  return {
    title: labelMap[persona] || labelMap.executive,
    helper: 'Esses itens envelhecem rápido e viram ruído operacional quando o sistema não é usado todos os dias.',
    items: ranked.map(({ obra, count }) => ({
      obraId: obra.id,
      title: obra.nomeCurto,
      subtitle: obra.operacao.pendencias.find((item) => ['aguardando', 'aguardando_retorno', 'em_tratativa'].includes(item.status))?.titulo
        || obra.decisoes?.find((item) => item.status !== 'Concluída')?.titulo
        || obra.proximaAcao,
      meta: `${count} item(ns) aguardando ação ou retorno`,
    })),
  };
}

function buildDailyRitual(persona) {
  const ritualMap = {
    executive: [
      'Entre vendo a fila de decisões e escolha uma obra foco.',
      'Confirme quem ficou responsável e qual prazo vale hoje.',
      'Saia com um checkpoint claro para a equipe e para o cliente.',
    ],
    engineering: [
      'Abra primeiro a obra com bloqueio crítico ou checklist aberto.',
      'Atualize pendência, decisão e liberação no mesmo fluxo.',
      'Feche o dia com frente liberada ou impedimento formalizado.',
    ],
    finance: [
      'Comece pelos casos com NF pendente ou cobrança alta.',
      'Atualize o status do fechamento antes de responder fora do sistema.',
      'Saia da tela com previsão, dono e resposta registrada.',
    ],
    field: [
      'Abra a operação e alinhe a prioridade da frente logo cedo.',
      'Registre apontamento, checklist e evidência durante o dia.',
      'Feche a frente sem deixar pendência sem dono ou sem alinhamento.',
    ],
  };

  return ritualMap[persona] || ritualMap.executive;
}

export default function PortfolioOverview({ obras, onSelect, onOpenAssistant, onQuickAction, focusTarget, productPersona }) {
  const [assistantDraft, setAssistantDraft] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showSecondaryInsights, setShowSecondaryInsights] = useState(false);
  const portfolioSnapshot = getPortfolioSnapshot(obras);
  const totalBudget = portfolioSnapshot.totalBudget;
  const averageProgress = obras.length ? Math.round(portfolioSnapshot.totalProgress / obras.length) : 0;
  const nextVisit = portfolioSnapshot.nextVisit;
  const totalPendencias = portfolioSnapshot.totalPendencias;
  const obraPrioritaria = portfolioSnapshot.obraPrioritaria;
  const updates = sortByDashboardDateDesc(obras.flatMap((obra) => obra.timeline.map((item) => ({ ...item, obra: obra.nomeCurto })))).slice(0, 4);
  const recentAssets = sortByDashboardDateDesc(obras.flatMap((obra) => obra.arquivosRecentes.map((item) => ({ ...item, obra: obra.nomeCurto })))).slice(0, 4);
  const assistantSpotlight = getPortfolioAssistantSuggestions(obras);
  const heroRef = useRef(null);
  const alertsRef = useRef(null);
  const cardsRef = useRef(null);
  const updatesRef = useRef(null);

  const filteredObras = obras.filter((obra) => {
    const normalizedSearch = search.trim().toLowerCase();
    const matchesSearch = !normalizedSearch
      || [obra.nome, obra.nomeCurto, obra.cliente, obra.local, obra.tipo].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));

    const matchesFilter = filter === 'all'
      || (filter === 'critical' && (obra.prioridade === 'Alta' || obra.pendenciasAbertas >= 3))
      || (filter === 'stable' && obra.pendenciasAbertas < 3 && obra.prioridade !== 'Alta');

    return matchesSearch && matchesFilter;
  });

  const leadershipQueue = [...obras]
    .sort((a, b) => {
      if (b.pendenciasAbertas !== a.pendenciasAbertas) {
        return b.pendenciasAbertas - a.pendenciasAbertas;
      }

      const leftDate = parseDashboardDateLabel(a.proximaData)?.getTime() || Number.POSITIVE_INFINITY;
      const rightDate = parseDashboardDateLabel(b.proximaData)?.getTime() || Number.POSITIVE_INFINITY;

      return leftDate - rightDate;
    })
    .slice(0, 3);

  const todayFocus = leadershipQueue[0] || null;
  const criticalWorks = countCriticalWorks(obras);
  const personaExperience = getPersonaExperience(productPersona, todayFocus, nextVisit, obraPrioritaria, totalPendencias, criticalWorks);
  const gapScanner = buildGapScanner(obras);
  const clientSummary = buildClientSummary(obras, obraPrioritaria, nextVisit, totalPendencias);
  const primaryQueue = leadershipQueue.slice(0, 2);
  const dutyBoard = buildPersonaDutyBoard(productPersona, obras);
  const responseDebtBoard = buildResponseDebtBoard(productPersona, obras);
  const dailyRitual = buildDailyRitual(productPersona);
  const workflowCards = [
    {
      title: 'Reunião diária',
      description: 'Monte a pauta da liderança sem navegar em todas as obras.',
      action: () => openPortfolioAssistant('Monte a pauta da reunião diária com prioridade, risco e próximo passo.'),
      cta: 'Gerar pauta',
    },
    {
      title: 'Resumo para cliente',
      description: 'Transforme a leitura interna em mensagem clara e profissional.',
      action: () => openPortfolioAssistant('Monte um resumo executivo do portfólio para cliente.'),
      cta: 'Criar resumo',
    },
    {
      title: 'Aprofundar análise',
      description: 'Abra a camada mais analítica só quando precisar de mais contexto.',
      action: () => setShowSecondaryInsights((current) => !current),
      cta: showSecondaryInsights ? 'Ocultar análises' : 'Mostrar análises',
    },
  ];

  useEffect(() => {
    const map = {
      hero: heroRef,
      alerts: alertsRef,
      prioritaria: cardsRef,
      updates: updatesRef,
      library: updatesRef,
    };

    const target = map[focusTarget];

    if (target?.current && typeof target.current.scrollIntoView === 'function') {
      target.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [focusTarget]);

  function openPortfolioAssistant(question = '') {
    onOpenAssistant(String(question || '').trim());
    setAssistantDraft('');
  }

  function handleAssistantLauncherKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      openPortfolioAssistant(assistantDraft);
    }
  }

  return (
    <>
      <div ref={heroRef} className="portfolio-hero section-card animate-in">
        <div className="portfolio-eyebrow">Painel central de obras</div>
        <div className="portfolio-hero-grid">
          <div>
            <div className="section-card-title">Veja primeiro o que pede ação hoje</div>
            <div className="section-card-description">
              Em vez de abrir o sistema por excesso de informação, a home agora tenta responder três perguntas: o que fazer agora, onde agir primeiro e quando vale aprofundar a análise.
            </div>
            <div className="portfolio-action-strip">
              <button type="button" className="portfolio-card-button" onClick={() => onQuickAction('prioritaria')}>
                Abrir obra prioritária
              </button>
              <button type="button" className="inline-action-button portfolio-inline-button" onClick={() => onQuickAction('alerts')}>
                Ver alertas do dia
              </button>
            </div>
          </div>
          <div className="portfolio-summary-card">
            <div className="portfolio-summary-label">Resumo do dia</div>
            <div className="portfolio-summary-row">
              <span>Foco do dia</span>
              <strong>{todayFocus ? todayFocus.nomeCurto : 'Sem foco crítico'}</strong>
            </div>
            <div className="portfolio-summary-row">
              <span>Próximo checkpoint</span>
              <strong>{nextVisit ? `${nextVisit.nome} • ${nextVisit.data}` : 'Sem agenda'}</strong>
            </div>
            <div className="portfolio-summary-row">
              <span>Alta atenção</span>
              <strong>{criticalWorks}</strong>
            </div>
            <div className="portfolio-summary-row">
              <span>Carteira sob gestão</span>
              <strong>{formatCompactCurrency(totalBudget)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="portfolio-priority-strip animate-in">
        {primaryQueue.map((obra, index) => (
          <button key={`${obra.id}-priority`} type="button" className={`surface-card portfolio-priority-card ${index === 0 ? 'primary' : ''}`} onClick={() => onSelect(obra.id)}>
            <span>{index === 0 ? 'Prioridade número 1' : 'Próxima da fila'}</span>
            <strong>{obra.nomeCurto}</strong>
            <p>{obra.proximaAcao}</p>
          </button>
        ))}
        <div className="surface-card portfolio-priority-card portfolio-priority-summary">
          <span>Leitura rápida</span>
          <strong>{averageProgress}% de progresso médio</strong>
          <p>{totalPendencias} pendência(s) sob gestão no portfólio.</p>
        </div>
      </div>

      <div className="portfolio-day-board animate-in">
        <div className="portfolio-day-board-head">
          <div>
            <div className="card-title">Rotina que faz o sistema virar hábito</div>
            <div className="card-helper-text">Esse bloco organiza o uso diário por papel: onde entrar, o que não pode envelhecer e como sair da plataforma com o dia controlado.</div>
          </div>
        </div>
        <div className="portfolio-day-board-grid">
          <div className="portfolio-day-item">
            <span>{dutyBoard.title}</span>
            <strong>{dutyBoard.items[0]?.title || 'Sem fila dominante agora'}</strong>
            <p>{dutyBoard.helper}</p>
            <div className="portfolio-duty-list">
              {dutyBoard.items.map((item) => (
                <button key={`${item.obraId}-${item.title}`} type="button" className="portfolio-duty-row" onClick={() => onSelect(item.obraId)}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.subtitle}</span>
                  </div>
                  <small>{item.meta}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="portfolio-day-item portfolio-day-item-warning">
            <span>{responseDebtBoard.title}</span>
            <strong>{responseDebtBoard.items[0]?.title || 'Nada sem resposta agora'}</strong>
            <p>{responseDebtBoard.helper}</p>
            <div className="portfolio-duty-list">
              {responseDebtBoard.items.length > 0 ? responseDebtBoard.items.map((item) => (
                <button key={`${item.obraId}-${item.meta}`} type="button" className="portfolio-duty-row" onClick={() => onSelect(item.obraId)}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.subtitle}</span>
                  </div>
                  <small>{item.meta}</small>
                </button>
              )) : (
                <div className="portfolio-duty-empty">O portfólio está sem débitos claros de resposta neste momento.</div>
              )}
            </div>
          </div>

          <div className="portfolio-day-item portfolio-day-item-ritual">
            <span>Rito obrigatório do dia</span>
            <strong>Como usar sem sobrecarga</strong>
            <p>Se o time seguir esse roteiro, o sistema deixa de ser só consulta e vira gestão diária.</p>
            <div className="portfolio-ritual-list">
              {dailyRitual.map((item, index) => (
                <div key={item} className="portfolio-ritual-item">
                  <strong>{index + 1}</strong>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="assistant-launch-card assistant-launch-card-priority surface-card animate-in">
        <div className="assistant-launch-copy">
          <div className="assistant-eyebrow">IA Assistente Especialista</div>
          <div className="assistant-launch-title">{assistantSpotlight.title}</div>
          <div className="assistant-launch-description">{assistantSpotlight.description}</div>
        </div>
        <div className="assistant-launch-side">
          <div
            className="assistant-launch-open"
            role="button"
            tabIndex={0}
            onClick={() => openPortfolioAssistant('Faça uma leitura executiva do portfólio com prioridade, risco e próxima ação.')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openPortfolioAssistant('Faça uma leitura executiva do portfólio com prioridade, risco e próxima ação.');
              }
            }}
          >
            <div className="assistant-launch-open-label">Abrir a IA como central de decisão</div>
            <div className="assistant-launch-open-copy">Use o assistente para reunião diária, resumo para cliente e priorização do sistema inteiro.</div>
          </div>
          <div className="assistant-launch-mini">
            <textarea
              className="assistant-launch-input"
              value={assistantDraft}
              onChange={(event) => setAssistantDraft(event.target.value)}
              onKeyDown={handleAssistantLauncherKeyDown}
              placeholder="Pergunte algo como: qual obra exige decisão agora?"
            />
            <div className="assistant-launch-mini-actions">
              <button type="button" className="portfolio-card-button" onClick={() => openPortfolioAssistant(assistantDraft)}>
                Perguntar na IA
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="portfolio-start-strip animate-in">
        <div className="surface-card portfolio-persona-card">
          <div className="portfolio-start-label">{personaExperience.label}</div>
          <strong>{personaExperience.title}</strong>
          <p>{personaExperience.description}</p>
          <div className="portfolio-persona-bullets">
            {personaExperience.bullets.map((item) => (
              <span key={item} className="portfolio-persona-bullet">{item}</span>
            ))}
          </div>
        </div>

        {workflowCards.map((item) => (
          <div key={item.title} className="surface-card portfolio-start-card">
            <div className="portfolio-start-label">Fluxo recomendado</div>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
            <button type="button" className="inline-action-button" onClick={item.action}>
              {item.cta}
            </button>
          </div>
        ))}
      </div>

      <div className="surface-card portfolio-command-card animate-in">
        <div className="portfolio-command-head">
          <div>
            <div className="card-title">Onde agir agora</div>
            <div className="card-helper-text">Busque uma obra específica ou filtre o que realmente precisa de atenção.</div>
          </div>
          <div className="portfolio-command-actions">
            <button type="button" className={`history-filter-chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Tudo</button>
            <button type="button" className={`history-filter-chip ${filter === 'critical' ? 'active' : ''}`} onClick={() => setFilter('critical')}>Alta atenção</button>
            <button type="button" className={`history-filter-chip ${filter === 'stable' ? 'active' : ''}`} onClick={() => setFilter('stable')}>Estáveis</button>
            <button type="button" className={`history-filter-chip ${showSecondaryInsights ? 'active' : ''}`} onClick={() => setShowSecondaryInsights((current) => !current)}>
              {showSecondaryInsights ? 'Ocultar análises' : 'Mostrar análises'}
            </button>
          </div>
        </div>
        <div className="portfolio-command-grid">
          <div className="portfolio-command-search">
            <input
              className="operation-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por obra, cliente, local ou tipo"
            />
            <div className="portfolio-command-hint">{filteredObras.length} obra(s) aparecem com o recorte atual.</div>
          </div>
          <div className="portfolio-command-summary">
            <div>
              <span>Prioridade executiva</span>
              <strong>{obraPrioritaria ? obraPrioritaria.nomeCurto : 'Sem foco crítico'}</strong>
            </div>
            <div>
              <span>Próximo checkpoint</span>
              <strong>{nextVisit ? `${nextVisit.nome} • ${nextVisit.data}` : 'Sem agenda'}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="portfolio-alerts-grid" ref={alertsRef}>
        <div className="surface-card portfolio-alert-card animate-in">
          <div className="card-title">Ações prioritárias de hoje</div>
          {obras.map((obra) => (
            <div key={obra.id} className="portfolio-alert-row">
              <div>
                <div className="portfolio-alert-title">{obra.nomeCurto}</div>
                <div className="portfolio-alert-copy">{obra.proximaAcao}</div>
              </div>
              <div className="portfolio-alert-meta">
                <span className={`portfolio-chip ${obra.prioridade === 'Alta' ? 'critical' : ''}`}>{obra.prioridade}</span>
                <strong>{obra.proximaData}</strong>
                <button type="button" className="inline-action-button" onClick={() => onSelect(obra.id)}>
                  Abrir
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="surface-card portfolio-attention-card animate-in">
          <div className="card-title">Obra que mais pede decisão</div>
          {obraPrioritaria ? (
            <>
              <div className="portfolio-attention-main">
                <span className="portfolio-attention-label">Leitura principal</span>
                <strong>{obraPrioritaria.nome}</strong>
                <p>{obraPrioritaria.destaque}</p>
              </div>
              <div className="portfolio-attention-stats">
                <div>
                  <span>Risco</span>
                  <strong>{obraPrioritaria.risco}</strong>
                </div>
                <div>
                  <span>Pendências</span>
                  <strong>{obraPrioritaria.pendenciasAbertas}</strong>
                </div>
                <div>
                  <span>Atualizado em</span>
                  <strong>{obraPrioritaria.ultimaAtualizacao}</strong>
                </div>
              </div>
            </>
          ) : (
            <div className="portfolio-attention-main">
              <strong>Nenhuma obra disponível</strong>
              <p>Assim que houver projetos cadastrados, essa área destacará a frente mais sensível.</p>
            </div>
          )}
        </div>
      </div>

      <div ref={cardsRef} className="portfolio-cards-grid">
        {filteredObras.map((obra) => (
          <button type="button" key={obra.id} className="surface-card portfolio-card animate-in" onClick={() => onSelect(obra.id)}>
            <div className="portfolio-card-top">
              <div>
                <div className="portfolio-card-title">{obra.nome}</div>
                <div className="portfolio-card-subtitle">{obra.tipo} • {obra.local}</div>
              </div>
              <span className="portfolio-card-status" style={{ color: obra.corDestaque, borderColor: `${obra.corDestaque}33`, background: `${obra.corDestaque}14` }}>
                {obra.status}
              </span>
            </div>
            <div className="portfolio-card-highlight">{obra.proximaAcao}</div>
            <div className="portfolio-card-meta-row">
              <span>Prioridade: <strong>{obra.prioridade}</strong></span>
              <span>Risco: <strong>{obra.risco}</strong></span>
              <span>Ritmo: <strong>{getWorkloadLabel(obra)}</strong></span>
              <span>Atualizado: <strong>{obra.ultimaAtualizacao}</strong></span>
            </div>
            <div className="portfolio-card-kpis">
              <div>
                <span>Progresso</span>
                <strong>{obra.metricas[0].valor}</strong>
              </div>
              <div>
                <span>Prazo</span>
                <strong>{obra.metricas[1].valor}</strong>
              </div>
              <div>
                <span>Equipe</span>
                <strong>{obra.equipe}</strong>
              </div>
            </div>
            <div className="portfolio-card-footer">
              <div>
                <span>Próxima ação</span>
                <strong>{obra.proximaData}</strong>
              </div>
              <span className="portfolio-card-button">
                Entrar na obra
              </span>
            </div>
          </button>
        ))}
        {filteredObras.length === 0 ? (
          <div className="surface-card portfolio-empty-state animate-in">
            Nenhuma obra corresponde ao recorte atual. Ajuste a busca ou o filtro para voltar a visualizar o portfólio.
          </div>
        ) : null}
      </div>

      {showSecondaryInsights ? (
        <>
          <div className="content-grid">
            <div className="surface-card animate-in stagger-2">
              <div className="card-title">Fila de decisão da liderança</div>
              <div className="card-helper-text">Camada analítica para reunião diária ou checkpoint executivo.</div>
              {leadershipQueue.map((obra, index) => (
                <div key={`${obra.id}-queue`} className="portfolio-decision-row">
                  <div className="portfolio-decision-rank">{index + 1}</div>
                  <div className="portfolio-decision-copy">
                    <strong>{obra.nomeCurto}</strong>
                    <span>{obra.proximaAcao}</span>
                  </div>
                  <div className="portfolio-decision-meta">
                    <span className={`portfolio-chip ${obra.prioridade === 'Alta' ? 'critical' : ''}`}>{getWorkloadLabel(obra)}</span>
                    <strong>{obra.proximaData}</strong>
                    <button type="button" className="inline-action-button" onClick={() => onSelect(obra.id)}>Abrir</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="surface-card animate-in stagger-3">
              <div className="card-title">Scanner de gaps operacionais</div>
              <div className="card-helper-text">O que ainda está faltando para o portfólio ficar limpo e confiável.</div>
              <div className="portfolio-gap-list">
                {gapScanner.length > 0 ? gapScanner.map((item) => (
                  <div key={`${item.obra.id}-gap`} className="portfolio-gap-item">
                    <div>
                      <strong>{item.obra.nomeCurto}</strong>
                      <p>{item.gaps.join(' • ')}</p>
                    </div>
                    <button type="button" className="inline-action-button" onClick={() => onSelect(item.obra.id)}>
                      Corrigir
                    </button>
                  </div>
                )) : (
                  <div className="portfolio-gap-empty">Nenhuma lacuna operacional dominante foi encontrada agora.</div>
                )}
              </div>
            </div>
          </div>

          <div className="content-grid">
            <div ref={updatesRef} className="surface-card animate-in stagger-2">
              <div className="card-title">Atualizações e biblioteca recente</div>
              {updates.map((item) => (
                <div key={`${item.obra}-${item.data}-${item.titulo}`} className="doc-row" style={{ padding: '14px 0', borderBottom: '0.5px solid #f1f5f9' }}>
                  <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 500, marginBottom: 4 }}>{item.obra}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{item.titulo}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{item.descricao}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.data}</div>
                </div>
              ))}
              {recentAssets.map((item) => (
                <div key={`${item.obra}-${item.data}-${item.titulo}`} className="doc-row" style={{ padding: '14px 0', borderBottom: '0.5px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span className="mini-badge" style={{ background: item.tipo === 'Foto' ? '#dcfce7' : '#e0ecff', color: item.tipo === 'Foto' ? '#15803d' : '#1d4ed8', fontSize: 10, padding: '5px 8px' }}>
                      {item.tipo}
                    </span>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{item.obra}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{item.titulo}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.data}</div>
                </div>
              ))}
            </div>

            <div className="surface-card animate-in stagger-3">
              <div className="card-title">Resumo pronto para cliente</div>
              <div className="card-helper-text">Base pronta para transformar a leitura interna em comunicação externa.</div>
              <div className="portfolio-client-summary">
                {clientSummary.map((item) => (
                  <div key={item} className="portfolio-client-summary-item">{item}</div>
                ))}
              </div>
              <div className="portfolio-client-summary-actions">
                <button
                  type="button"
                  className="portfolio-card-button"
                  onClick={() => openPortfolioAssistant('Monte um resumo executivo do portfólio para cliente com tom profissional e objetivo.')}
                >
                  Gerar versão com IA
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
