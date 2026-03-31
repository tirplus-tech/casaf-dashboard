import { hasSupabaseConfig, supabase } from '../lib/supabase';

const assistantMode = process.env.REACT_APP_OBRA_ASSISTANT_MODE || 'local';
const openAiModel = process.env.REACT_APP_OPENAI_MODEL || 'gpt-5.2';
const hasRemoteAssistant = assistantMode === 'openai';
const PT_MONTHS = {
  jan: 0,
  fev: 1,
  mar: 2,
  abr: 3,
  mai: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  set: 8,
  out: 9,
  nov: 10,
  dez: 11,
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parseCurrency(value) {
  const normalized = String(value || '')
    .replace('R$', '')
    .trim()
    .toLowerCase()
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  if (normalized.includes('mi')) {
    return (Number.parseFloat(normalized.replace('mi', '')) || 0) * 1000000;
  }

  if (normalized.includes('k')) {
    return (Number.parseFloat(normalized.replace('k', '')) || 0) * 1000;
  }

  return Number.parseFloat(normalized) || 0;
}

function getCriticalPendencias(obra) {
  return obra.operacao.pendencias.filter((item) => item.status === 'critico');
}

function getWaitingPendencias(obra) {
  return obra.operacao.pendencias.filter((item) => ['aguardando', 'aguardando_retorno', 'em_tratativa'].includes(item.status));
}

function getUnansweredTasks(obra) {
  return obra.operacao.tarefasDia.filter((item) => ['prioridade', 'aguardando_retorno'].includes(item.status));
}

function getPresenceAlerts(obra) {
  return obra.operacao.presencaHoje.filter((item) => item.status !== 'Presente');
}

function getReadyToPay(obra) {
  return (obra.financeiroOperacional?.colaboradores || []).filter((item) => {
    const status = item.fechamentoStatus || item.pagamentoStatus;
    return status === 'Pronto para pagar' || status === 'Liberado';
  });
}

function getPendingInvoices(obra) {
  return (obra.financeiroOperacional?.colaboradores || []).filter((item) => item.nfStatus !== 'Emitida');
}

function getBlockedMtes(obra) {
  return obra.planejamento.mtes.filter((item) => item.status !== 'Aprovado');
}

function getActivePhase(obra) {
  return obra.planejamento.cronograma.find((item) => item.status === 'Em andamento')
    || obra.planejamento.cronograma.find((item) => item.status !== 'Concluído')
    || null;
}

function buildRiskScore(obra) {
  const criticalPendencias = getCriticalPendencias(obra).length;
  const waitingPendencias = getWaitingPendencias(obra).length;
  const presenceAlerts = getPresenceAlerts(obra).length;
  const pendingInvoices = getPendingInvoices(obra).length;
  const blockedMtes = getBlockedMtes(obra).length;
  const unansweredTasks = getUnansweredTasks(obra).length;

  const score = Math.min(
    100,
    22
      + (criticalPendencias * 18)
      + (waitingPendencias * 8)
      + (presenceAlerts * 6)
      + (pendingInvoices * 4)
      + (blockedMtes * 5)
      + (unansweredTasks * 7),
  );

  if (score >= 75) {
    return { score, label: 'Alto' };
  }

  if (score >= 50) {
    return { score, label: 'Moderado' };
  }

  return { score, label: 'Controlado' };
}

function buildObraContext(obra) {
  const activePhase = getActivePhase(obra);
  const risk = buildRiskScore(obra);
  const totalContract = parseCurrency(obra.financeiroResumo[0]?.valor);
  const executed = parseCurrency(obra.financeiroResumo[1]?.valor);
  const nextTask = obra.operacao.tarefasDia.find((item) => item.status === 'prioridade') || obra.operacao.tarefasDia[0];

  return {
    activePhase,
    risk,
    criticalPendencias: getCriticalPendencias(obra),
    waitingPendencias: getWaitingPendencias(obra),
    unansweredTasks: getUnansweredTasks(obra),
    presenceAlerts: getPresenceAlerts(obra),
    pendingInvoices: getPendingInvoices(obra),
    blockedMtes: getBlockedMtes(obra),
    readyToPay: getReadyToPay(obra),
    totalContract,
    executed,
    nextTask,
  };
}

function buildBaseResponse(obra, tone, references, followUps) {
  return {
    title: '',
    message: '',
    references,
    followUps,
    agentPlan: [],
    watchouts: [],
    targets: [],
    confidence: 'Leitura contextual',
    displayMode: 'full',
    obraId: obra.id,
  };
}

function buildMessage(...paragraphs) {
  return paragraphs.filter(Boolean).join('\n\n');
}

function splitMessageParagraphs(message) {
  return String(message || '')
    .split('\n\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function dedupeParagraphs(paragraphs) {
  const accepted = [];
  const seen = new Set();

  paragraphs.forEach((paragraph) => {
    const normalized = normalizeText(paragraph)
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized || seen.has(normalized)) {
      return;
    }

    const isContained = accepted.some((current) => {
      const currentNormalized = normalizeText(current)
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      return currentNormalized.includes(normalized) || normalized.includes(currentNormalized);
    });

    if (isContained) {
      return;
    }

    seen.add(normalized);
    accepted.push(paragraph);
  });

  return accepted;
}

function getResponseStyle(question) {
  const content = normalizeText(question).trim();
  const wordCount = content.split(/\s+/).filter(Boolean).length;

  if (isGreeting(question) || isGenericHelp(question)) {
    return 'social';
  }

  if (/resumo|analise|análise|detalhe|detalhado|explica|explique|diagnostico|diagnóstico|compare|comparar|plano/.test(content)) {
    return 'deep';
  }

  if (wordCount <= 6 || content.length <= 42) {
    return 'quick';
  }

  return 'standard';
}

function finalizeAnswer(answer, question) {
  const style = getResponseStyle(question);
  const paragraphs = dedupeParagraphs(splitMessageParagraphs(answer.message));
  const maxParagraphs = style === 'deep' ? 4 : 2;
  const compact = style === 'social' || style === 'quick' || answer.displayMode === 'compact';

  return {
    ...answer,
    message: buildMessage(...paragraphs.slice(0, maxParagraphs)),
    followUps: uniqueStrings(answer.followUps).slice(0, compact ? 3 : 4),
    agentPlan: compact ? [] : uniqueStrings(answer.agentPlan).slice(0, style === 'deep' ? 4 : 3),
    watchouts: compact ? [] : uniqueStrings(answer.watchouts).slice(0, style === 'deep' ? 4 : 3),
    references: compact ? [] : uniqueStrings(answer.references).slice(0, 4),
    targets: uniqueTargets(answer.targets).slice(0, compact ? 2 : 3),
    displayMode: compact ? 'compact' : 'full',
  };
}

function buildConversationDigest(history = []) {
  return history
    .slice(-6)
    .map((item) => {
      if (item.role === 'user') {
        return `Usuário: ${String(item.question || item.message || '').trim()}`;
      }

      const answerMessage = item.answer?.message || item.message || '';
      const firstParagraph = splitMessageParagraphs(answerMessage)[0] || '';

      return `Assistente: ${firstParagraph}`;
    })
    .filter(Boolean)
    .join('\n');
}

function uniqueStrings(items) {
  return [...new Set((items || []).filter(Boolean).map((item) => String(item).trim()).filter(Boolean))];
}

function uniqueTargets(targets) {
  const seen = new Set();

  return (targets || []).filter((target) => {
    if (!target || !target.label) {
      return false;
    }

    const key = `${target.label}-${target.section || ''}-${target.obraId || ''}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function normalizeGreetingCandidate(question) {
  return normalizeText(question)
    .trim()
    .replace(/[!?.,;:]+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/([aeiou])\1+/g, '$1')
    .replace(/^(o)+(?=la\b)/, 'o');
}

function isGreeting(question) {
  const content = normalizeGreetingCandidate(question);

  return /^(oi|ola|eai|eae|opa|bom dia|boa tarde|boa noite|fala|hello|hey|salve)$/.test(content);
}

function isGenericHelp(question) {
  const content = normalizeText(question).trim();

  return /^(me ajuda|preciso de ajuda|o que voce faz|o que vc faz|como voce pode ajudar|como vc pode ajudar)[?.! ]*$/.test(content);
}

function getPortfolioPriorityObra(obras) {
  return [...obras].sort((a, b) => b.pendenciasAbertas - a.pendenciasAbertas)[0] || null;
}

function formatCompactCurrency(value) {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(2).replace('.', ',')} mi`;
  }

  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}k`;
  }

  return `R$ ${value}`;
}

export function parseDashboardDateLabel(value) {
  const normalized = normalizeText(String(value || '').split('•')[0]).trim();
  const match = normalized.match(/(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?(?:\s+(\d{1,2}):(\d{2}))?/i);

  if (!match) {
    return null;
  }

  const [, dayText, monthText, yearText, hourText, minuteText] = match;
  const monthIndex = PT_MONTHS[monthText];

  if (monthIndex === undefined) {
    return null;
  }

  const day = Number.parseInt(dayText, 10);
  const year = Number.parseInt(yearText || String(new Date().getFullYear()), 10);
  const hour = Number.parseInt(hourText || '12', 10);
  const minute = Number.parseInt(minuteText || '0', 10);

  return new Date(year, monthIndex, day, hour, minute);
}

export function getPortfolioSnapshot(obras) {
  return obras.reduce((snapshot, obra) => {
    const progress = Number.parseInt(String(obra.metricas[0]?.valor || '0').replace('%', ''), 10) || 0;
    const budget = parseCurrency(obra.financeiroResumo[0]?.valor);
    const visit = {
      nome: obra.nomeCurto,
      data: obra.proximaData,
      sortValue: parseDashboardDateLabel(obra.proximaData)?.getTime() || Number.POSITIVE_INFINITY,
    };

    if (!snapshot.obraPrioritaria || obra.pendenciasAbertas > snapshot.obraPrioritaria.pendenciasAbertas) {
      snapshot.obraPrioritaria = obra;
    }

    if (!snapshot.nextVisit || visit.sortValue < snapshot.nextVisit.sortValue) {
      snapshot.nextVisit = visit;
    }

    snapshot.totalPendencias += obra.pendenciasAbertas;
    snapshot.totalBudget += budget;
    snapshot.totalProgress += progress;

    return snapshot;
  }, {
    obraPrioritaria: null,
    nextVisit: null,
    totalPendencias: 0,
    totalBudget: 0,
    totalProgress: 0,
  });
}

function buildPortfolioContext(obras) {
  const snapshot = getPortfolioSnapshot(obras);
  const criticalObras = obras.filter((obra) => getCriticalPendencias(obra).length > 0);

  return {
    priorityObra: snapshot.obraPrioritaria,
    totalPendencias: snapshot.totalPendencias,
    progress: obras.length ? Math.round(snapshot.totalProgress / obras.length) : 0,
    budget: snapshot.totalBudget,
    criticalObras,
    nextVisit: snapshot.nextVisit,
  };
}

function getRecentTimelineHighlights(obra, limit = 3) {
  return (obra.timeline || []).slice(0, limit).map((item) => `${item.titulo} (${item.data})`);
}

function getRecentEvidenceHighlights(obra) {
  const photo = obra.fotosObra?.[0];
  const document = obra.documentos?.[0];
  const evidence = [];

  if (photo) {
    evidence.push(`foto mais recente "${photo.titulo}" em ${photo.data}`);
  }

  if (document) {
    evidence.push(`documento "${document.nome}" atualizado em ${document.data}`);
  }

  return evidence;
}

function buildObraDecisionSupport(obra) {
  const context = buildObraContext(obra);
  const activeChecklist = obra.operacao.checklist.filter((item) => item.status !== 'done');
  const recentTimeline = getRecentTimelineHighlights(obra);
  const evidenceHighlights = getRecentEvidenceHighlights(obra);
  const executionPercent = context.totalContract > 0 && context.executed > 0
    ? Math.round((context.executed / context.totalContract) * 100)
    : null;
  const executionGap = executionPercent !== null
    ? executionPercent - (Number.parseInt(String(obra.metricas[0]?.valor || '0').replace('%', ''), 10) || 0)
    : null;

  const actionPlan = uniqueStrings([
    context.nextTask ? `Travar dono, prazo e evidência para "${context.nextTask.titulo}" ainda neste ciclo.` : null,
    context.criticalPendencias[0] ? `Resolver ou escalar "${context.criticalPendencias[0].titulo}" antes do próximo checkpoint.` : null,
    context.blockedMtes[0] ? `Destravar ${context.blockedMtes[0].codigo} para não contaminar a frente seguinte.` : null,
    activeChecklist.length > 0 ? `Fechar ${activeChecklist.length} item(ns) de checklist pendente(s) antes do encerramento do dia.` : null,
    context.pendingInvoices[0] ? `Limpar a pendência financeira de ${context.pendingInvoices[0].nome} para reduzir atrito de fechamento.` : null,
    context.unansweredTasks[0] ? `Cobrar retorno da tarefa "${context.unansweredTasks[0].titulo}" antes de abrir novas frentes.` : null,
  ]).slice(0, 4);

  const watchouts = uniqueStrings([
    context.criticalPendencias[0] ? `${context.criticalPendencias[0].titulo} segue como risco mais agudo da obra.` : null,
    context.presenceAlerts[0] ? `A presença de ${context.presenceAlerts[0].nome} está fora do ideal e pode pressionar produtividade.` : null,
    context.blockedMtes.length > 0 ? `${context.blockedMtes.length} MTE(s) ainda não aprovado(s) podem limitar fluidez do cronograma.` : null,
    executionGap !== null && executionGap > 12 ? `A execução financeira está ${executionGap} ponto(s) acima do avanço físico e merece conferência.` : null,
    context.unansweredTasks[0] ? `A tarefa "${context.unansweredTasks[0].titulo}" ainda depende de retorno e pode envelhecer mal se não houver cobrança.` : null,
  ]).slice(0, 4);

  const decision = context.criticalPendencias[0]
    ? `Minha decisão agora seria concentrar gestão em ${obra.nomeCurto} para remover "${context.criticalPendencias[0].titulo}" antes de abrir novas frentes.`
    : context.nextTask
      ? `Minha decisão agora seria proteger a entrega de "${context.nextTask.titulo}" e usar o restante do dia para fechamento limpo da frente ativa.`
      : `Minha decisão agora seria usar ${obra.proximaData} como checkpoint e evitar dispersão de energia em frentes secundárias.`;

  return {
    context,
    activeChecklist,
    recentTimeline,
    evidenceHighlights,
    executionPercent,
    executionGap,
    actionPlan,
    watchouts,
    decision,
  };
}

function buildPortfolioDecisionSupport(obras) {
  const context = buildPortfolioContext(obras);
  const criticalObras = (context.criticalObras || []).slice().sort((a, b) => b.pendenciasAbertas - a.pendenciasAbertas);
  const actionPlan = uniqueStrings([
    context.priorityObra ? `Concentrar decisão executiva em ${context.priorityObra.nomeCurto} até aliviar o pico de pendências.` : null,
    criticalObras[1] ? `Manter vigilância curta em ${criticalObras[1].nomeCurto} para evitar segundo foco crítico simultâneo.` : null,
    context.nextVisit ? `Usar ${context.nextVisit.nome} em ${context.nextVisit.data} como checkpoint formal do portfólio.` : null,
  ]).slice(0, 4);

  const watchouts = uniqueStrings([
    context.priorityObra ? `${context.priorityObra.nomeCurto} concentra a maior pressão operacional do sistema.` : null,
    criticalObras.length > 1 ? `${criticalObras.length} obras carregam pendência crítica ao mesmo tempo.` : null,
    context.totalPendencias > obras.length * 2 ? `O volume total de pendências está alto para o tamanho atual do portfólio.` : null,
  ]).slice(0, 4);

  const decision = context.priorityObra
    ? `Minha decisão agora seria priorizar ${context.priorityObra.nomeCurto} como obra-foco do portfólio e gerir as demais em regime de vigilância objetiva.`
    : 'Minha decisão agora seria manter leitura executiva distribuída, sem abrir uma frente de crise artificial.';

  return {
    context,
    actionPlan,
    watchouts,
    decision,
  };
}

function buildDynamicFollowUps(intent, support, scope = 'obra') {
  if (scope === 'portfolio') {
    return uniqueStrings([
      support.context.priorityObra ? `Por que ${support.context.priorityObra.nomeCurto} virou a obra prioritária?` : null,
      'Qual o plano executivo para as próximas 24 horas?',
      'Existe risco de atraso no conjunto das obras?',
      'Monte um resumo para diretoria.',
    ]).slice(0, 4);
  }

  return uniqueStrings([
    intent !== 'risk' ? 'Quais são os maiores riscos desta obra hoje?' : null,
    intent !== 'priority' ? 'O que eu deveria priorizar agora?' : null,
    intent !== 'schedule' ? 'Existe risco de atraso neste projeto?' : null,
    intent !== 'finance' ? 'Como está o financeiro desta obra?' : null,
    'Monte um resumo para eu mandar ao cliente.',
  ]).slice(0, 4);
}

function enrichObraAnswer(answer, obra, intent) {
  const support = buildObraDecisionSupport(obra);
  const evidenceLine = uniqueStrings([
    support.recentTimeline[0] ? `Sinal recente de sistema: ${support.recentTimeline[0]}.` : null,
    support.evidenceHighlights[0] ? `Evidência disponível: ${support.evidenceHighlights[0]}.` : null,
  ]).join(' ');

  return {
    ...answer,
    message: buildMessage(
      answer.message,
      support.decision,
      evidenceLine || null,
    ),
    references: uniqueStrings([...(answer.references || []), 'Timeline', 'Fotos', 'Documentos']),
    followUps: buildDynamicFollowUps(intent, support),
    agentPlan: uniqueStrings([...(answer.agentPlan || []), ...support.actionPlan]).slice(0, 4),
    watchouts: uniqueStrings([...(answer.watchouts || []), ...support.watchouts]).slice(0, 4),
    targets: uniqueTargets([
      ...(answer.targets || []),
      { label: 'Abrir operação', section: 'operacao' },
      support.context.blockedMtes.length > 0 ? { label: 'Abrir planejamento', section: 'planejamento' } : null,
      support.context.pendingInvoices.length > 0 ? { label: 'Ir para financeiro', section: 'financeiro' } : null,
      support.evidenceHighlights.length > 0 ? { label: 'Ver evidências', section: 'fotos' } : null,
    ]).slice(0, 3),
    confidence: `Leitura decisiva (${support.context.risk.label})`,
  };
}

function enrichPortfolioAnswer(answer, obras, intent) {
  const support = buildPortfolioDecisionSupport(obras);

  return {
    ...answer,
    message: buildMessage(
      answer.message,
      support.decision,
    ),
    followUps: buildDynamicFollowUps(intent, support, 'portfolio'),
    agentPlan: uniqueStrings([...(answer.agentPlan || []), ...support.actionPlan]).slice(0, 4),
    watchouts: uniqueStrings([...(answer.watchouts || []), ...support.watchouts]).slice(0, 4),
    targets: uniqueTargets([
      ...(answer.targets || []),
      support.context.priorityObra ? { label: `Abrir ${support.context.priorityObra.nomeCurto}`, obraId: support.context.priorityObra.id } : null,
    ]).slice(0, 3),
    confidence: `Leitura executiva (${support.context.criticalObras.length > 0 ? 'com alertas' : 'estável'})`,
  };
}

function buildOverviewAnswer(obra) {
  const context = buildObraContext(obra);
  const response = buildBaseResponse(
    obra,
    `Leitura executiva de ${obra.nome}`,
    ['Operação', 'Planejamento', 'Financeiro'],
    [
      'Quais gargalos merecem atenção imediata?',
      'Existe risco de atraso nesta obra?',
      'Monte um resumo para eu mandar ao cliente.',
    ],
  );

  response.message = buildMessage(
    `${obra.nome} me parece em um ponto de avanço razoável, mas ainda pedindo gestão de perto. Hoje ela está em ${obra.status.toLowerCase()}, com ${obra.metricas[0].valor} de avanço físico, e o próximo marco registrado é ${obra.proximaData}.`,
    context.activePhase
      ? `O ponto mais sensível continua sendo a fase "${context.activePhase.fase}", porque é ela que está carregando o peso do cronograma agora. Com ${context.activePhase.percentual}% de avanço, essa frente ainda precisa de proteção para não contaminar o restante da obra.`
      : 'O cronograma não mostra uma fase ativa tão clara, então eu tomaria cuidado para não deixar a obra avançar sem um eixo de prioridade bem definido.',
    context.criticalPendencias.length > 0
      ? `O que mais me chama atenção é que ainda existem ${context.criticalPendencias.length} pendência(s) crítica(s). Em termos práticos, isso significa que o avanço depende menos de esforço e mais de remover bloqueios.`
      : 'Como não há pendência crítica explícita no sistema, o cenário é mais de organização fina e disciplina de execução do que de crise aberta.',
    `Se eu estivesse te apoiando na condução hoje, eu puxaria a conversa para ${obra.proximaAcao.toLowerCase()} e fecharia o ciclo do dia com evidência, atualização e leitura do impacto no prazo.`,
  );
  response.agentPlan = [
    'Validar a frente mais sensível do cronograma.',
    'Atacar a principal pendência que ameaça ritmo ou prazo.',
    'Fechar o dia com evidência, apontamento e atualização executiva.',
  ];
  response.targets = [
    { label: 'Abrir visão geral', section: 'visao' },
    { label: 'Ir para operação', section: 'operacao' },
    { label: 'Ir para planejamento', section: 'planejamento' },
  ];

  return response;
}

function buildRiskAnswer(obra) {
  const context = buildObraContext(obra);
  const topRisk = context.criticalPendencias[0] || context.waitingPendencias[0];
  const response = buildBaseResponse(
    obra,
    'Riscos e gargalos agora',
    ['Pendências', 'Presença', 'MTEs'],
    [
      'O que eu deveria priorizar agora?',
      'Como está o prazo desta obra?',
      'Resuma a situação para a engenharia.',
    ],
  );

  response.message = buildMessage(
    topRisk
      ? `Hoje eu olharia primeiro para "${topRisk.titulo}". Esse é o ponto que mais tem cara de travar a obra agora, porque ${topRisk.impacto.toLowerCase()}.`
      : 'Não vejo um único gargalo dominante registrado no sistema, mas ainda existe risco de desgaste operacional se a obra seguir sem uma frente claramente protegida.',
    context.criticalPendencias.length > 0
      ? `O quadro geral é de atenção real: ${context.criticalPendencias.length} pendência(s) crítica(s) deixam a obra numa faixa de risco ${context.risk.label.toLowerCase()}. Isso não quer dizer necessariamente atraso imediato, mas já é suficiente para pressionar produtividade e previsibilidade.`
      : `O risco hoje me parece mais moderado do que crítico. Ainda assim, eu não chamaria de cenário folgado, porque há dependências e pontos de fechamento que podem crescer se ficarem sem dono.`,
    context.presenceAlerts.length > 0
      ? `Também tem um componente de campo aí: ${context.presenceAlerts.length} pessoa(s) fora da condição ideal de presença tiram estabilidade da operação.`
      : 'Do lado do campo, a presença está estável, e isso ajuda bastante a segurar o plano do dia.',
    context.blockedMtes.length > 0
      ? `Além disso, os MTEs ainda merecem respeito. Com ${context.blockedMtes.length} item(ns) sem aprovação total, existe chance de a próxima frente perder fluidez.`
      : null,
  );
  response.agentPlan = [
    'Confirmar o gargalo mais crítico com o responsável da frente.',
    'Remover dependência externa ou de suprimentos ainda hoje.',
    'Reavaliar impacto em prazo e produtividade após a ação.',
  ];
  response.targets = [
    { label: 'Ver operação', section: 'operacao' },
    { label: 'Ver planejamento', section: 'planejamento' },
  ];

  return response;
}

function buildPriorityAnswer(obra) {
  const context = buildObraContext(obra);
  const response = buildBaseResponse(
    obra,
    'Prioridade recomendada',
    ['Plano do dia', 'Pendências', 'Timeline'],
    [
      'Quais são os maiores riscos desta obra hoje?',
      'Me dê um plano de ação para as próximas 24 horas.',
      'Existe risco financeiro na obra?',
    ],
  );

  response.message = buildMessage(
    context.nextTask
      ? `Se a prioridade for destravar avanço real, eu começaria por "${context.nextTask.titulo}". É a frente que está mais perto de converter esforço em progresso visível hoje.`
      : 'Como o sistema não deixa uma tarefa prioritária tão explícita, eu tomaria a decisão olhando para a combinação entre cronograma, bloqueio operacional e impacto no dia.',
    context.criticalPendencias[0]
      ? `Ao mesmo tempo, eu não deixaria "${context.criticalPendencias[0].titulo}" correr solta. Esse tipo de pendência vai drenando produtividade silenciosamente e, quando você percebe, o dia já perdeu tração.`
      : 'Como não há um bloqueio crítico tão marcado, o jogo aqui é proteger a frente ativa e não perder o fechamento do dia.',
    `Traduzindo isso para ação prática: eu colocaria o foco principal em ${obra.proximaAcao.toLowerCase()} e usaria o restante do acompanhamento para garantir que nada tire essa frente do eixo.`,
  );
  response.agentPlan = [
    'Concentrar a equipe na frente com maior impacto no avanço do dia.',
    'Tratar o principal impedimento em paralelo.',
    'Atualizar a leitura executiva após o fechamento da frente ativa.',
  ];
  response.targets = [
    { label: 'Abrir operação', section: 'operacao' },
    { label: 'Abrir visão geral', section: 'visao' },
  ];

  return response;
}

function buildFinanceAnswer(obra) {
  const context = buildObraContext(obra);
  const executionPercent = context.totalContract > 0 && context.executed > 0
    ? Math.round((context.executed / context.totalContract) * 100)
    : null;
  const response = buildBaseResponse(
    obra,
    'Leitura financeira da obra',
    ['Resumo financeiro', 'Colaboradores', 'Lançamentos'],
    [
      'Existe risco de prazo neste projeto?',
      'Quais pendências mais afetam o custo?',
      'Faça um resumo executivo da obra.',
    ],
  );

  response.message = buildMessage(
    `No financeiro, a leitura que eu faço é de uma obra que já carregou ${obra.financeiroResumo[1]?.valor || 'um volume relevante'} dentro de uma base de ${obra.financeiroResumo[0]?.valor || 'valor não informado'}.`,
    executionPercent !== null
      ? `Essa relação dá algo perto de ${executionPercent}% de execução financeira. Não está fora da curva em relação ao avanço físico de ${obra.metricas[0].valor}, então o cenário não me parece desorganizado, mas também não é um financeiro para deixar sem acompanhamento.`
      : 'Com os dados atuais eu não consigo fechar uma relação precisa entre contrato e execução, então eu trataria essa leitura com alguma cautela.',
    context.pendingInvoices.length > 0
      ? `O ponto que mais pede atenção agora são as notas fiscais pendentes. São ${context.pendingInvoices.length} registro(s) capazes de gerar ruído no fechamento e desgaste em pagamento.`
      : 'As notas fiscais não aparecem como foco crítico neste momento, o que já tira uma boa pressão do fechamento.',
    context.readyToPay.length > 0
      ? `Ao mesmo tempo, já existem ${context.readyToPay.length} registro(s) em condição mais madura de pagamento, o que ajuda a limpar fila e reduzir atrito operacional.`
      : null,
  );
  response.agentPlan = [
    'Conferir pendências de NF e fechamento antes da próxima liberação.',
    'Alinhar execução física com execução financeira.',
    'Preparar a próxima rodada de comunicação com cliente e financeiro.',
  ];
  response.targets = [
    { label: 'Ir para financeiro', section: 'financeiro' },
    { label: 'Abrir visão geral', section: 'visao' },
  ];

  return response;
}

function buildScheduleAnswer(obra) {
  const context = buildObraContext(obra);
  const response = buildBaseResponse(
    obra,
    'Prazo e cronograma',
    ['Cronograma', 'MTEs', 'Próxima agenda'],
    [
      'Quais ações evitam atraso nesta obra?',
      'O que eu deveria priorizar agora?',
      'Monte um resumo para cliente.',
    ],
  );

  response.message = buildMessage(
    context.activePhase
      ? `Se eu olhar só para prazo, a frente que mais merece proteção é "${context.activePhase.fase}". É ela que está segurando o ritmo do cronograma agora, com ${context.activePhase.percentual}% de avanço e horizonte em ${context.activePhase.prazo}.`
      : 'O cronograma não deixa uma fase dominante tão clara, então o risco maior passa a ser a obra seguir sem prioridade executiva bem definida.',
    context.blockedMtes.length > 0
      ? `Eu vejo sim espaço para atraso se os MTEs continuarem travando. Com ${context.blockedMtes.length} item(ns) ainda sem aprovação total, a obra pode perder fluidez entre uma frente e outra.`
      : 'Os MTEs, isoladamente, não me parecem o principal risco de atraso agora.',
    context.criticalPendencias.length > 0
      ? `O que mais pesa contra o prazo, na prática, é a mistura entre pendência crítica e frente ativa pressionada. Quando essas duas coisas se encontram, o cronograma sente.`
      : 'Como não há pendência crítica aberta no radar, o risco de prazo fica mais ligado à disciplina diária do que a um travamento formal.',
    `Eu usaria ${obra.proximaData} como checkpoint real de controle. Se a obra não chegar nesse marco mais limpa, o risco de desvio cresce.`,
  );
  response.agentPlan = [
    'Proteger a fase ativa antes do próximo marco.',
    'Destravar MTEs ou aprovações pendentes.',
    'Revisar se existe reflexo de prazo vindo das pendências operacionais.',
  ];
  response.targets = [
    { label: 'Abrir planejamento', section: 'planejamento' },
    { label: 'Ir para operação', section: 'operacao' },
  ];

  return response;
}

function buildClientAnswer(obra) {
  const response = buildBaseResponse(
    obra,
    'Resumo para cliente',
    ['Resumo da obra', 'Timeline', 'Próxima agenda'],
    [
      'Deixe esse resumo mais executivo.',
      'Quais são os riscos desta obra hoje?',
      'Como está o financeiro desta obra?',
    ],
  );

  response.message = buildMessage(
    `${obra.nome} segue em ${obra.status.toLowerCase()}, com ${obra.metricas[0].valor} de avanço físico e foco atual em ${obra.proximaAcao.toLowerCase()}.`,
    `Hoje o principal destaque é ${obra.destaque.charAt(0).toLowerCase()}${obra.destaque.slice(1)}, e a próxima referência de acompanhamento está marcada para ${obra.proximaData}.`,
    `Neste momento, a obra continua sob monitoramento de ${obra.pendenciasAbertas} pendência(s) aberta(s), com última atualização registrada em ${obra.ultimaAtualizacao}.`,
  );
  response.agentPlan = [
    'Usar esse texto como base de comunicação externa.',
    'Ajustar o tom conforme o cliente e o momento da obra.',
    'Atualizar a timeline antes do envio, se necessário.',
  ];
  response.targets = [
    { label: 'Abrir visão geral', section: 'visao' },
    { label: 'Ver documentos', section: 'documentos' },
  ];

  return response;
}

function buildOperationsAnswer(obra) {
  const context = buildObraContext(obra);
  const activeChecklist = obra.operacao.checklist.filter((item) => item.status !== 'done');
  const response = buildBaseResponse(
    obra,
    'Operação de campo',
    ['Tarefas do dia', 'Checklist', 'Equipe'],
    [
      'Quais riscos merecem atenção imediata?',
      'Me dê um plano de ação para hoje.',
      'Existe risco de atraso nesta obra?',
    ],
  );

  response.message = buildMessage(
    `No campo, a obra está estruturada em torno de ${obra.operacao.tarefasDia.length} tarefa(s) para o dia, e o foco prático continua sendo ${obra.proximaAcao.toLowerCase()}.`,
    context.nextTask
      ? `A frente mais quente agora é "${context.nextTask.titulo}". Se eu fosse orientar a operação, seria aí que eu colocaria energia de acompanhamento.`
      : 'Não existe uma tarefa tão dominante no sistema, então a gestão precisa usar leitura de contexto para não pulverizar esforço.',
    activeChecklist.length > 0
      ? `Ainda há ${activeChecklist.length} item(ns) de checklist fora de concluído. Isso não é necessariamente grave, mas mostra que o fechamento do dia ainda pode melhorar.`
      : 'O checklist está bem resolvido, o que é um bom sinal de disciplina operacional.',
    context.presenceAlerts.length > 0
      ? `O ponto de atenção em campo fica por conta da presença: ${context.presenceAlerts.length} pessoa(s) não estão em condição ideal, e isso pode reduzir constância de produção.`
      : 'A presença está estável, e isso joga a favor do plano do dia.',
  );
  response.agentPlan = [
    'Proteger a execução do dia na frente principal.',
    'Fechar checklist e presença antes de encerrar o turno.',
    'Registrar apontamento e evidência da produção entregue.',
  ];
  response.targets = [
    { label: 'Abrir operação', section: 'operacao' },
    { label: 'Ver fotos', section: 'fotos' },
  ];

  return response;
}

function buildDocumentsAnswer(obra) {
  const document = obra.documentos[0];
  const photo = obra.fotosObra[0];
  const response = buildBaseResponse(
    obra,
    'Documentos e evidências',
    ['Documentos', 'Fotos', 'Arquivos recentes'],
    [
      'Quais registros eu deveria atualizar hoje?',
      'Monte um resumo para cliente.',
      'Me diga o estado geral da obra.',
    ],
  );

  response.message = buildMessage(
    document
      ? `Do ponto de vista documental, eu começaria por "${document.nome}", registrado em ${document.data}. É o tipo de material que ajuda a sustentar alinhamento técnico e decisão.`
      : 'Não existe um documento tão dominante no sistema agora, então eu faria uma revisão mais manual do acervo antes de usar isso como base de decisão.',
    photo
      ? `Nas evidências visuais, o registro mais recente é "${photo.titulo}". Isso é importante porque tira a conversa do abstrato e mostra o estado real da frente.`
      : 'As fotos ainda não deixam uma evidência mais forte na frente, então eu reforçaria o registro visual nas próximas atualizações.',
    'Sempre que você for preparar alinhamento ou reporte, o ideal é cruzar documento técnico, evidência visual e o que foi lançado na timeline. É isso que deixa a leitura confiável.',
  );
  response.agentPlan = [
    'Cruzar documento técnico com evidência visual recente.',
    'Garantir que a biblioteca represente o estágio real da obra.',
    'Usar esses registros na preparação de alinhamento ou reporte.',
  ];
  response.targets = [
    { label: 'Abrir documentos', section: 'documentos' },
    { label: 'Ver fotos', section: 'fotos' },
  ];

  return response;
}

function buildNextStepsAnswer(obra) {
  const context = buildObraContext(obra);
  const response = buildBaseResponse(
    obra,
    'Próximos passos sugeridos',
    ['Próxima agenda', 'Pendências', 'Operação'],
    [
      'Quais são os maiores riscos desta obra hoje?',
      'Como está o financeiro desta obra?',
      'Faça um resumo executivo.',
    ],
  );

  response.message = buildMessage(
    'Se eu tivesse que organizar as próximas 24 horas dessa obra, eu pensaria em três movimentos: proteger a frente que mais impacta avanço, remover o bloqueio que mais drena energia e fechar bem o ciclo de atualização.',
    context.nextTask
      ? `Na prática, eu começaria por "${context.nextTask.titulo}", porque é a ação mais próxima de converter esforço em progresso visível.`
      : `Na prática, eu começaria pela ação que já está registrada como eixo do momento: ${obra.proximaAcao.toLowerCase()}.`,
    context.criticalPendencias[0]
      ? `Logo depois, eu atacaria "${context.criticalPendencias[0].titulo}" para evitar que esse gargalo cresça e alcance o próximo marco.`
      : 'Como não há pendência crítica explícita, o segundo passo seria garantir disciplina forte de fechamento e conferência da frente ativa.',
    `Para encerrar o ciclo, eu atualizaria cronograma, apontamento e registro fotográfico antes de ${obra.proximaData}. Isso é o que transforma execução em gestão.`,
  );
  response.agentPlan = [
    'Proteger a frente ativa ainda hoje.',
    'Remover o principal bloqueio antes do próximo checkpoint.',
    'Fechar atualização executiva ao final do ciclo.',
  ];
  response.targets = [
    { label: 'Abrir operação', section: 'operacao' },
    { label: 'Abrir planejamento', section: 'planejamento' },
    { label: 'Voltar à visão geral', section: 'visao' },
  ];

  return response;
}

function inferPortfolioIntent(question) {
  const content = normalizeText(question);

  if (/risco|gargalo|alerta|critico|critica|atencao/.test(content)) return 'risk';
  if (/prioridade|priorizar|agora|hoje|executivo|diretoria|acao/.test(content)) return 'priority';
  if (/finance|custo|orcamento|carteira|contrato/.test(content)) return 'finance';
  if (/prazo|cronograma|atraso|entrega/.test(content)) return 'schedule';
  if (/cliente|mensagem|resumo|relatorio/.test(content)) return 'client';
  return 'overview';
}

function buildPortfolioBaseResponse() {
  return {
    title: '',
    message: '',
    followUps: [
      'Quais obras merecem mais atenção agora?',
      'Como está a saúde geral do portfólio?',
      'Existe risco de prazo no conjunto das obras?',
    ],
    targets: [],
    confidence: 'Leitura de portfólio',
    displayMode: 'full',
  };
}

function buildGreetingAnswer(scopeLabel) {
  return {
    title: '',
    message: `Oi. Estou por aqui com contexto de ${scopeLabel}.\n\nSe quiser, eu posso começar com uma leitura rápida do que mais importa agora.`,
    followUps: [
      'Como está a saúde geral agora?',
      'O que merece prioridade agora?',
      'Quais são os maiores riscos hoje?',
    ],
    targets: [],
    confidence: 'Conversa inicial',
    displayMode: 'compact',
  };
}

function buildHelpAnswer(scopeLabel) {
  return {
    title: '',
    message: `Posso te ajudar com ${scopeLabel} de forma bem prática.\n\nVocê pode me pedir leitura geral, prioridade, risco, prazo, financeiro ou um resumo executivo.`,
    followUps: [
      'Me dê uma leitura geral.',
      'Quais são os gargalos agora?',
      'Existe risco de atraso?',
    ],
    targets: [],
    confidence: 'Conversa guiada',
    displayMode: 'compact',
  };
}

function buildPortfolioOverviewAnswer(obras) {
  const context = buildPortfolioContext(obras);
  const response = buildPortfolioBaseResponse();

  response.message = buildMessage(
    `Olhando o sistema como um todo, eu vejo um portfólio com ${obras.length} obra(s) ativa(s), progresso médio de ${context.progress}% e uma carteira aproximada de ${formatCompactCurrency(context.budget)} sob gestão.`,
    context.priorityObra
      ? `${context.priorityObra.nomeCurto} é a obra que mais pede atenção agora, principalmente porque concentra ${context.priorityObra.pendenciasAbertas} pendência(s) aberta(s) e tende a puxar a percepção de risco do conjunto.`
      : 'Nenhuma obra aparece isoladamente como foco dominante neste momento.',
    context.criticalObras.length > 0
      ? `No agregado, o que mais pesa é que ${context.criticalObras.length} obra(s) ainda têm pendências críticas explícitas. Isso não significa crise generalizada, mas mostra que o portfólio ainda depende de gestão ativa de bloqueios.`
      : 'No agregado, o cenário é mais estável do que crítico, o que ajuda a dirigir energia para priorização fina e não para resposta a crise.',
    context.nextVisit
      ? `Se eu fosse conduzir a leitura executiva agora, começaria por ${context.priorityObra?.nomeCurto || context.nextVisit.nome} e usaria ${context.nextVisit.data} como próximo checkpoint importante do sistema.`
      : 'Se eu fosse conduzir a leitura executiva agora, começaria pela obra mais pressionada e organizaria a agenda a partir dela.',
  );
  response.targets = context.priorityObra ? [
    { label: `Abrir ${context.priorityObra.nomeCurto}`, obraId: context.priorityObra.id },
  ] : [];

  return response;
}

function buildPortfolioRiskAnswer(obras) {
  const context = buildPortfolioContext(obras);
  const response = buildPortfolioBaseResponse();

  response.message = buildMessage(
    context.priorityObra
      ? `Hoje, o principal risco do sistema está menos em volume e mais em concentração. ${context.priorityObra.nomeCurto} virou o ponto mais sensível do portfólio porque está acumulando a maior carga de pendências abertas.`
      : 'Hoje eu não vejo um risco dominante isolado, mas ainda existe pressão operacional distribuída entre as obras.',
    context.criticalObras.length > 0
      ? `Além disso, ${context.criticalObras.length} obra(s) ainda carregam pendências críticas registradas. Isso merece atenção porque, quando mais de uma frente começa a travar ao mesmo tempo, a gestão perde capacidade de resposta.`
      : 'Como não há várias obras com pendência crítica explícita ao mesmo tempo, o risco do portfólio fica mais controlado.',
    `Minha leitura é que o sistema ainda está saudável, mas não está folgado. O risco maior seria deixar a obra mais pressionada consumir energia demais e contaminar a cadência de acompanhamento das outras.`,
  );
  response.targets = context.priorityObra ? [
    { label: `Ir para ${context.priorityObra.nomeCurto}`, obraId: context.priorityObra.id },
  ] : [];

  return response;
}

function buildPortfolioPriorityAnswer(obras) {
  const context = buildPortfolioContext(obras);
  const response = buildPortfolioBaseResponse();

  response.message = buildMessage(
    context.priorityObra
      ? `Se eu tivesse que definir uma prioridade executiva única agora, ela seria ${context.priorityObra.nomeCurto}. Não porque as outras obras estejam necessariamente mal, mas porque é nela que o custo de não agir parece maior.`
      : 'Se eu tivesse que definir uma prioridade executiva agora, eu começaria pela obra com maior volume de pendências e maior proximidade de marco.',
    `Em paralelo, eu manteria as demais obras em regime de acompanhamento leve, só para garantir que nenhuma frente secundária comece a virar problema sem ser percebida.`,
    `Em outras palavras, o melhor caminho agora não é dividir energia igualmente. É concentrar decisão onde o sistema já está mostrando mais atrito e manter o restante sob vigilância limpa.`,
  );
  response.targets = context.priorityObra ? [
    { label: `Abrir ${context.priorityObra.nomeCurto}`, obraId: context.priorityObra.id },
  ] : [];

  return response;
}

function buildPortfolioFinanceAnswer(obras) {
  const context = buildPortfolioContext(obras);
  const response = buildPortfolioBaseResponse();

  response.message = buildMessage(
    `Financeiramente, o que eu vejo é uma carteira de aproximadamente ${formatCompactCurrency(context.budget)} distribuída entre ${obras.length} obra(s). Isso por si só já mostra um sistema que precisa de leitura consolidada, e não só de acompanhamento por projeto isolado.`,
    `O progresso médio está em ${context.progress}%, então a tendência é que o portfólio ainda esteja em uma fase que mistura avanço executivo com necessidade de controle fino de liberação e fechamento.`,
    context.priorityObra
      ? `Se eu tivesse que escolher onde olhar primeiro, começaria por ${context.priorityObra.nomeCurto}, porque normalmente a obra com maior carga de pendências também é a que mais pode gerar ruído financeiro indireto.`
      : null,
  );
  response.targets = [];

  return response;
}

function buildPortfolioScheduleAnswer(obras) {
  const context = buildPortfolioContext(obras);
  const response = buildPortfolioBaseResponse();

  response.message = buildMessage(
    `Do ponto de vista de prazo, eu não leria o sistema apenas pela média. O portfólio pode parecer saudável no agregado e ainda assim carregar uma obra capaz de puxar a percepção de atraso sozinha.`,
    context.priorityObra
      ? `Hoje essa obra é ${context.priorityObra.nomeCurto}. Se ela continuar acumulando atrito operacional, é ela que tende a aparecer primeiro como desvio mais sensível.`
      : 'Hoje nenhuma obra aparece como ameaça isolada tão clara ao prazo do conjunto.',
    context.nextVisit
      ? `Eu usaria ${context.nextVisit.data} como próximo checkpoint importante e avaliaria se a obra mais pressionada chega nesse marco mais limpa ou mais pesada.`
      : null,
  );
  response.targets = context.priorityObra ? [
    { label: `Abrir ${context.priorityObra.nomeCurto}`, obraId: context.priorityObra.id },
  ] : [];

  return response;
}

function buildPortfolioClientAnswer(obras) {
  const context = buildPortfolioContext(obras);
  const response = buildPortfolioBaseResponse();

  response.message = buildMessage(
    `Hoje o portfólio reúne ${obras.length} obra(s) em andamento, com progresso médio de ${context.progress}% e acompanhamento executivo contínuo sobre prazo, operação e orçamento.`,
    context.priorityObra
      ? `No momento, a frente que mais pede atenção é ${context.priorityObra.nomeCurto}, enquanto as demais seguem em monitoramento para manter estabilidade do conjunto.`
      : 'No momento, o conjunto segue em monitoramento para manter estabilidade operacional e executiva.',
    `A leitura geral é de uma carteira ativa, com necessidade de priorização seletiva, mas ainda sob controle de gestão.`,
  );
  response.targets = [];

  return response;
}

function buildPortfolioLocalAnswer(obras, question) {
  if (isGreeting(question)) {
    return buildGreetingAnswer('o portfólio inteiro de obras');
  }

  if (isGenericHelp(question)) {
    return buildHelpAnswer('o portfólio inteiro de obras');
  }

  const intent = inferPortfolioIntent(question);

  let answer = buildPortfolioOverviewAnswer(obras);

  if (intent === 'risk') answer = buildPortfolioRiskAnswer(obras);
  if (intent === 'priority') answer = buildPortfolioPriorityAnswer(obras);
  if (intent === 'finance') answer = buildPortfolioFinanceAnswer(obras);
  if (intent === 'schedule') answer = buildPortfolioScheduleAnswer(obras);
  if (intent === 'client') answer = buildPortfolioClientAnswer(obras);

  return enrichPortfolioAnswer(answer, obras, intent);
}

function inferIntent(question) {
  const content = normalizeText(question);

  if (/risco|gargalo|trava|travando|problema|alerta|critico|critica/.test(content)) return 'risk';
  if (/prioridade|priorizar|agora|hoje|proximo passo|proxima acao|amanha|24 horas|fazer/.test(content)) return 'priority';
  if (/finance|custo|pagamento|nf|medicao|medicao|liberacao|liberacao|orcamento|contrato/.test(content)) return 'finance';
  if (/prazo|cronograma|mte|fase|atraso|entrega/.test(content)) return 'schedule';
  if (/cliente|mensagem|resumo|relatorio|formal/.test(content)) return 'client';
  if (/operacao|campo|equipe|checklist|pendencia|tarefa/.test(content)) return 'operations';
  if (/documento|arquivo|foto|evidencia|biblioteca/.test(content)) return 'documents';
  if (/proximo|passos|plano de acao/.test(content)) return 'nextSteps';
  return 'overview';
}

function buildLocalAnswer(obra, question) {
  if (isGreeting(question)) {
    return buildGreetingAnswer(`a obra ${obra.nome}`);
  }

  if (isGenericHelp(question)) {
    return buildHelpAnswer(`a obra ${obra.nome}`);
  }

  const intent = inferIntent(question);

  let answer = buildOverviewAnswer(obra);

  if (intent === 'risk') answer = buildRiskAnswer(obra);
  if (intent === 'priority') answer = buildPriorityAnswer(obra);
  if (intent === 'finance') answer = buildFinanceAnswer(obra);
  if (intent === 'schedule') answer = buildScheduleAnswer(obra);
  if (intent === 'client') answer = buildClientAnswer(obra);
  if (intent === 'operations') answer = buildOperationsAnswer(obra);
  if (intent === 'documents') answer = buildDocumentsAnswer(obra);
  if (intent === 'nextSteps') answer = buildNextStepsAnswer(obra);

  return enrichObraAnswer(answer, obra, intent);
}

function buildPromptContext(obra) {
  const support = buildObraDecisionSupport(obra);
  const { context } = support;

  return [
    `Obra: ${obra.nome}`,
    `Cliente: ${obra.cliente}`,
    `Tipo: ${obra.tipo}`,
    `Local: ${obra.local}`,
    `Status: ${obra.status}`,
    `Resumo: ${obra.resumo}`,
    `Destaque: ${obra.destaque}`,
    `Progresso geral: ${obra.metricas[0]?.valor || 'não informado'}`,
    `Próxima ação: ${obra.proximaAcao}`,
    `Próxima data: ${obra.proximaData}`,
    `Pendências abertas: ${obra.pendenciasAbertas}`,
    `Risco heurístico: ${context.risk.label} (${context.risk.score}/100)`,
    `Fase ativa: ${context.activePhase ? `${context.activePhase.fase} (${context.activePhase.percentual}% | ${context.activePhase.prazo})` : 'não identificada'}`,
    `Pendências críticas: ${context.criticalPendencias.map((item) => `${item.titulo} - ${item.impacto}`).join(' | ') || 'nenhuma'}`,
    `Pendências aguardando: ${context.waitingPendencias.map((item) => `${item.titulo} - ${item.impacto}`).join(' | ') || 'nenhuma'}`,
    `Checklist pendente: ${obra.operacao.checklist.filter((item) => item.status !== 'done').map((item) => `${item.item} (${item.status})`).join(' | ') || 'nenhum'}`,
    `Tarefas do dia: ${obra.operacao.tarefasDia.map((item) => `${item.titulo} - ${item.status} - ${item.responsavel}`).join(' | ')}`,
    `Presença fora do ideal: ${context.presenceAlerts.map((item) => `${item.nome} - ${item.status}`).join(' | ') || 'ninguém'}`,
    `Financeiro: contrato ${obra.financeiroResumo[0]?.valor || 'n/a'}, executado ${obra.financeiroResumo[1]?.valor || 'n/a'}, próxima liberação ${obra.financeiroResumo[2]?.valor || 'n/a'}`,
    `NFs pendentes: ${context.pendingInvoices.map((item) => `${item.nome} - ${item.nfStatus}`).join(' | ') || 'nenhuma'}`,
    `MTEs não aprovados: ${context.blockedMtes.map((item) => `${item.codigo} - ${item.status}`).join(' | ') || 'nenhum'}`,
    `Últimos eventos: ${support.recentTimeline.join(' | ') || 'sem eventos recentes relevantes'}`,
    `Evidências recentes: ${support.evidenceHighlights.join(' | ') || 'sem evidências recentes relevantes'}`,
    `Plano sugerido pelo sistema: ${support.actionPlan.join(' | ') || 'não definido'}`,
    `Alertas atuais: ${support.watchouts.join(' | ') || 'sem alertas adicionais'}`,
    `Última atualização: ${obra.ultimaAtualizacao}`,
  ].join('\n');
}

function buildPortfolioPromptContext(obras) {
  const support = buildPortfolioDecisionSupport(obras);
  const { context } = support;

  return [
    `Total de obras: ${obras.length}`,
    `Progresso médio: ${context.progress}%`,
    `Carteira estimada: ${formatCompactCurrency(context.budget)}`,
    `Pendências abertas totais: ${context.totalPendencias}`,
    `Obra de maior atenção: ${context.priorityObra ? context.priorityObra.nomeCurto : 'não identificada'}`,
    `Próximo checkpoint: ${context.nextVisit ? `${context.nextVisit.nome} em ${context.nextVisit.data}` : 'não identificado'}`,
    `Plano sugerido para o portfólio: ${support.actionPlan.join(' | ') || 'não definido'}`,
    `Alertas do sistema: ${support.watchouts.join(' | ') || 'sem alertas adicionais'}`,
    'Resumo das obras:',
    ...obras.map((obra) => [
      `- ${obra.nomeCurto}`,
      `status ${obra.status}`,
      `progresso ${obra.metricas[0]?.valor || 'n/a'}`,
      `prazo ${obra.metricas[1]?.valor || 'n/a'}`,
      `pendências ${obra.pendenciasAbertas}`,
      `próxima ação ${obra.proximaAcao}`,
      `próxima data ${obra.proximaData}`,
      `risco declarado ${obra.risco}`,
    ].join(' | ')),
  ].join('\n');
}

function extractOpenAiOutput(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (Array.isArray(data?.output)) {
    const text = data.output
      .map((item) => {
        if (item.type !== 'message' || !Array.isArray(item.content)) {
          return '';
        }

        return item.content
          .map((content) => content.text || content.output_text || content.value || '')
          .join('\n');
      })
      .filter(Boolean)
      .join('\n\n')
      .trim();

    if (text) {
      return text;
    }
  }

  return '';
}

function findPreviousResponseId(history = []) {
  const assistantMessage = [...history].reverse().find((item) => item.role === 'assistant' && item.answer?.responseId);
  return assistantMessage?.answer?.responseId || null;
}

function buildStructuredTextFormat(name) {
  return {
    format: {
      type: 'json_schema',
      name,
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'direct_answer', 'diagnosis', 'decision', 'next_steps', 'watchouts', 'follow_ups', 'targets', 'confidence', 'references'],
        properties: {
          title: { type: 'string' },
          direct_answer: { type: 'string' },
          diagnosis: { type: 'string' },
          decision: { type: 'string' },
          next_steps: {
            type: 'array',
            items: { type: 'string' },
          },
          watchouts: {
            type: 'array',
            items: { type: 'string' },
          },
          follow_ups: {
            type: 'array',
            items: { type: 'string' },
          },
          targets: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['label', 'section', 'obraId'],
              properties: {
                label: { type: 'string' },
                section: { type: 'string' },
                obraId: { type: 'string' },
              },
            },
          },
          confidence: { type: 'string' },
          references: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
  };
}

function extractOpenAiJson(data) {
  const raw = extractOpenAiOutput(data);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function normalizeStructuredAnswer(parsed, fallback) {
  if (!parsed) {
    return fallback;
  }

  const targets = uniqueTargets((parsed.targets || []).map((item) => ({
    label: item.label,
    section: item.section || undefined,
    obraId: item.obraId || undefined,
  })));

  return {
    ...fallback,
    title: String(parsed.title || '').trim(),
    message: buildMessage(parsed.direct_answer, parsed.diagnosis, parsed.decision),
    followUps: uniqueStrings(parsed.follow_ups).slice(0, 4),
    agentPlan: uniqueStrings(parsed.next_steps).slice(0, 4),
    watchouts: uniqueStrings(parsed.watchouts).slice(0, 4),
    references: uniqueStrings(parsed.references).slice(0, 5),
    targets: targets.slice(0, 3),
    confidence: String(parsed.confidence || fallback.confidence || '').trim() || fallback.confidence,
  };
}

async function postAssistantRequest(path, payload) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (hasSupabaseConfig && supabase) {
    const { data } = await supabase.auth.getSession();
    const accessToken = data?.session?.access_token;

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
  }

  const response = await fetch(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('assistant_api_error');
  }

  return response.json();
}

async function answerWithOpenAi(obra, question, history) {
  const recentConversation = buildConversationDigest(history);
  const previousResponseId = findPreviousResponseId(history);
  const fallbackAnswer = buildLocalAnswer(obra, question);

  const payload = {
    model: openAiModel,
    reasoning: { effort: 'high' },
    max_output_tokens: 1400,
    instructions: [
      'Você é a IA Assistente Especialista da CASAF, com postura de engenheiro de obras, gestor operacional e coordenador executivo ao mesmo tempo.',
      'Seu trabalho não é soar bonito. Seu trabalho é decidir, priorizar, justificar e orientar a próxima ação com base apenas nos dados recebidos.',
      'Antes de responder, investigue o contexto, cruze operação, cronograma, risco, custo, evidências e histórico recente.',
      'Quando houver incerteza, deixe claro que é inferência. Nunca invente fatos fora do contexto.',
      'Responda em português do Brasil, com linguagem humana, direta e profissional. Evite soar como relatório.',
      'Se a pergunta for simples, responda de forma curta e natural. Não despeje diagnóstico longo sem necessidade.',
      'Não repita a mesma ideia em "direct_answer", "diagnosis" e "decision". Cada campo deve trazer algo novo.',
      'Quero uma resposta forte e útil: uma resposta direta para a pergunta, um diagnóstico curto e uma decisão recomendada.',
      'Se existir risco relevante, seja explícito. Se existir uma prioridade clara, assuma posição e diga qual é.',
      'Retorne estritamente no JSON solicitado.',
    ].join('\n'),
    text: buildStructuredTextFormat('casaf_obra_assistant'),
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Contexto da obra:\n${buildPromptContext(obra)}\n\nHistórico recente:\n${recentConversation || 'Sem histórico relevante.'}\n\nPergunta do usuário:\n${question}\n\nMonte uma resposta decisiva. Use até 4 próximos passos e até 4 alertas. Em "targets", use apenas se houver ação de navegação clara; preencha "section" com uma das áreas do sistema (visao, operacao, planejamento, financeiro, fotos, documentos) ou deixe string vazia. Se precisar abrir a própria obra atual, deixe obraId vazio.`,
          },
        ],
      },
    ],
  };

  if (previousResponseId) {
    payload.previous_response_id = previousResponseId;
  }

  const data = await postAssistantRequest('/api/assistant/obra', payload);
  const parsed = extractOpenAiJson(data);
  const answer = normalizeStructuredAnswer(parsed, {
    ...fallbackAnswer,
    confidence: 'IA contextual',
  });

  if (!answer?.message) {
    throw new Error('assistant_empty_response');
  }

  return finalizeAnswer({
    ...answer,
    obraId: obra.id,
    responseId: data.id,
  }, question);
}

export function getAssistantSuggestions() {
  return [
    'Quem ainda me deve resposta nesta obra?',
    'Quais são os maiores riscos desta obra hoje?',
    'O que eu deveria priorizar agora?',
    'Quais gargalos podem travar o avanço desta obra?',
    'Monte um plano de ação do dia para esta obra.',
    'Existe risco de atraso neste projeto?',
    'Como está o financeiro desta obra?',
    'Monte um resumo para eu mandar ao cliente.',
  ];
}

export function getPortfolioAssistantSuggestions(obras) {
  const obraPrioritaria = getPortfolioPriorityObra(obras);

  return {
    title: 'IA Assistente Especialista do sistema',
    description: obraPrioritaria
      ? `Converse com a IA sobre o portfólio inteiro. Ela já entra lendo o sistema como um todo e pode aprofundar quando necessário.`
      : 'Converse com a IA sobre o sistema inteiro, com foco em risco, prazo, custo e prioridades.',
  };
}

export function getPortfolioAssistantQuestions() {
  return [
    'Como está a saúde geral do sistema hoje?',
    'Quais obras merecem mais atenção agora?',
    'Existe risco de prazo no conjunto das obras?',
    'Faça um resumo executivo do portfólio.',
  ];
}

export async function answerPortfolioQuestion(obras, question, history = []) {
  if (isGreeting(question)) {
    return finalizeAnswer(buildGreetingAnswer('o portfólio inteiro de obras'), question);
  }

  if (isGenericHelp(question)) {
    return finalizeAnswer(buildHelpAnswer('o portfólio inteiro de obras'), question);
  }

  if (hasRemoteAssistant) {
    try {
      const recentConversation = buildConversationDigest(history);
      const previousResponseId = findPreviousResponseId(history);
      const fallbackAnswer = buildPortfolioLocalAnswer(obras, question);

      const payload = {
        model: openAiModel,
        reasoning: { effort: 'high' },
        max_output_tokens: 1600,
        instructions: [
          'Você é a IA Assistente Especialista da CASAF olhando o portfólio inteiro de obras.',
          'Compare as obras entre si, procure concentração de risco, gargalos compartilhados, pressão de prazo e impacto executivo.',
          'Não seja genérico. Decida qual obra ou tema merece mais atenção e justifique por quê.',
          'Fale apenas com base no contexto fornecido. Quando inferir, deixe isso claro.',
          'Responda em português do Brasil, de forma executiva, prática e decisiva, mas sem soar como relatório repetitivo.',
          'Se a pergunta for simples ou curta, responda de forma breve, humana e objetiva.',
          'Não repita a mesma ideia em campos diferentes do JSON.',
          'Retorne estritamente no JSON solicitado.',
        ].join('\n'),
        text: buildStructuredTextFormat('casaf_portfolio_assistant'),
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: `Contexto do portfólio:\n${buildPortfolioPromptContext(obras)}\n\nHistórico recente:\n${recentConversation || 'Sem histórico relevante.'}\n\nPergunta do usuário:\n${question}\n\nEm "targets", use obraId quando quiser mandar o usuário para uma obra específica. Se o alvo for uma leitura geral sem obra específica, deixe obraId vazio. Section pode ficar vazia no modo portfólio.`,
              },
            ],
          },
        ],
      };

      if (previousResponseId) {
        payload.previous_response_id = previousResponseId;
      }

      const data = await postAssistantRequest('/api/assistant/portfolio', payload);
      const parsed = extractOpenAiJson(data);
      const answer = normalizeStructuredAnswer(parsed, {
        ...fallbackAnswer,
        confidence: 'IA de portfólio',
      });

      if (!answer?.message) {
        throw new Error('assistant_portfolio_empty_response');
      }

      return finalizeAnswer({
        ...answer,
        responseId: data.id,
      }, question);
    } catch (error) {
      return finalizeAnswer({
        ...buildPortfolioLocalAnswer(obras, question),
        confidence: 'Fallback de portfólio',
      }, question);
    }
  }

  return finalizeAnswer(buildPortfolioLocalAnswer(obras, question), question);
}

export async function answerObraQuestion(obra, question, history = []) {
  if (isGreeting(question)) {
    return finalizeAnswer(buildGreetingAnswer(`a obra ${obra.nome}`), question);
  }

  if (isGenericHelp(question)) {
    return finalizeAnswer(buildHelpAnswer(`a obra ${obra.nome}`), question);
  }

  if (hasRemoteAssistant) {
    try {
      const answer = await answerWithOpenAi(obra, question, history);
      return finalizeAnswer({
        ...answer,
        agentPlan: uniqueStrings([
          ...(answer.agentPlan || []),
          'Validar no sistema o principal risco ou oportunidade da resposta.',
          'Executar a próxima ação sugerida e reavaliar a obra.',
        ]).slice(0, 4),
        targets: uniqueTargets([
          ...(answer.targets || []),
          { label: 'Abrir visão geral', section: 'visao' },
          { label: 'Ir para operação', section: 'operacao' },
          { label: 'Ir para planejamento', section: 'planejamento' },
          { label: 'Ir para financeiro', section: 'financeiro' },
        ]).slice(0, 4),
      }, question);
    } catch (error) {
      return finalizeAnswer({
        ...buildLocalAnswer(obra, question),
        confidence: 'Fallback contextual',
      }, question);
    }
  }

  return finalizeAnswer(buildLocalAnswer(obra, question), question);
}
