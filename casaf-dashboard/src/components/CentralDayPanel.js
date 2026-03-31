import React from 'react';

function buildPersonaRitual(persona) {
  const map = {
    executive: [
      'Confirmar a frente mais sensível da obra.',
      'Cobrar dono e prazo do item sem resposta.',
      'Sair com um checkpoint claro para a equipe.',
    ],
    engineering: [
      'Abrir primeiro a pendência crítica ou a liberação em atraso.',
      'Atualizar alinhamento e decisão antes de responder fora do sistema.',
      'Fechar o dia com checklist e bloqueio formalizados.',
    ],
    finance: [
      'Revisar quem está segurando fechamento ou NF.',
      'Atualizar status de pagamento e resposta combinada.',
      'Sair com previsão e próximo retorno registrados.',
    ],
    field: [
      'Começar pela tarefa prioritária da frente.',
      'Registrar apontamento e evidência ao longo do dia.',
      'Encerrar com checklist e fechamento consistentes.',
    ],
  };

  return map[persona] || map.executive;
}

export default function CentralDayPanel({ obra, onOpenSection, productPersona = 'executive' }) {
  const tarefasPrioritarias = obra.operacao.tarefasDia.filter((item) => item.status === 'prioridade').slice(0, 3);
  const tarefasSemResposta = obra.operacao.tarefasDia.filter((item) => ['aguardando_retorno', 'prioridade'].includes(item.status)).slice(0, 2);
  const pendenciasCriticas = obra.operacao.pendencias.filter((item) => item.status === 'critico');
  const pendenciasSemResposta = obra.operacao.pendencias.filter((item) => ['aguardando', 'aguardando_retorno', 'em_tratativa'].includes(item.status)).slice(0, 3);
  const aguardandoTerceiros = obra.operacao.pendencias.filter((item) => String(item.dono || '').toLowerCase().includes('cliente') || String(item.dono || '').toLowerCase().includes('suprimentos'));
  const fotoDestaque = obra.fotosObra[0];
  const apontamentoDestaque = obra.operacao.apontamentos[0];
  const fechamentoDia = obra.operacao.fechamentoDia;
  const presentTeam = obra.operacao.presencaHoje.filter((item) => String(item.status).toLowerCase() === 'presente').length;
  const totalTeam = obra.operacao.presencaHoje.length;
  const checklistDone = obra.operacao.checklist.filter((item) => item.status === 'done').length;
  const checklistTotal = obra.operacao.checklist.length;
  const unresolvedChecklist = checklistTotal - checklistDone;
  const dailyClosureReadiness = [
    {
      ok: pendenciasCriticas.length === 0,
      label: 'Sem pendência crítica aberta',
    },
    {
      ok: obra.fotosObra.length > 0,
      label: 'Evidência visual registrada',
    },
    {
      ok: checklistDone === checklistTotal,
      label: 'Checklist operacional concluído',
    },
    {
      ok: Boolean(apontamentoDestaque),
      label: 'Apontamento do dia registrado',
    },
  ];
  const readinessScore = dailyClosureReadiness.filter((item) => item.ok).length;
  const personaRitual = buildPersonaRitual(productPersona);
  const unresolvedItems = [
    ...tarefasSemResposta.map((item) => ({
      title: item.titulo,
      note: item.alinhamento || `Responsável ${item.responsavel}`,
      meta: `${item.responsavel} • ${item.prazo || item.horario || 'A definir'}`,
    })),
    ...pendenciasSemResposta.map((item) => ({
      title: item.titulo,
      note: item.alinhamento || item.impacto,
      meta: `${item.dono} • ${item.prazo || 'A definir'}`,
    })),
  ].slice(0, 4);
  const dailyScorecards = [
    {
      label: 'Críticas hoje',
      value: String(pendenciasCriticas.length),
      helper: pendenciasCriticas.length > 0 ? 'Exigem decisão ou remoção de bloqueio.' : 'Sem bloqueio crítico visível.',
      action: () => onOpenSection('operacao'),
    },
    {
      label: 'Equipe presente',
      value: `${presentTeam}/${totalTeam}`,
      helper: 'Confirme presença e ajuste frente ativa.',
      action: () => onOpenSection('operacao'),
    },
    {
      label: 'Checklist fechado',
      value: `${checklistDone}/${checklistTotal}`,
      helper: 'Use isso para medir disciplina operacional.',
      action: () => onOpenSection('operacao'),
    },
    {
      label: 'Evidências do dia',
      value: String(obra.fotosObra.length),
      helper: 'Garanta registro visual antes do fechamento.',
      action: () => onOpenSection('fotos'),
    },
  ];

  return (
    <>
      <div className="central-day-score-grid animate-in">
        {dailyScorecards.map((item) => (
          <button key={item.label} type="button" className="surface-card central-day-score-card" onClick={item.action}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.helper}</p>
          </button>
        ))}
      </div>

      <div className="content-grid">
        <div className="surface-card animate-in">
          <div className="card-title">Central do dia</div>
          <div className="central-day-grid">
            <button type="button" className="central-day-card interactive primary" onClick={() => onOpenSection('operacao')}>
              <span className="central-day-eyebrow">Exige decisão hoje</span>
              <strong>{pendenciasCriticas[0] ? pendenciasCriticas[0].titulo : obra.proximaAcao}</strong>
              <p>{pendenciasCriticas[0] ? pendenciasCriticas[0].impacto : `${obra.proximaData} • prioridade ${obra.prioridade.toLowerCase()}`}</p>
              <span className="central-day-action-hint">Abrir operação prioritária</span>
            </button>
            <button type="button" className="central-day-card interactive" onClick={() => onOpenSection('operacao')}>
              <span className="central-day-eyebrow">Aguardando terceiros</span>
              <strong>{aguardandoTerceiros.length}</strong>
              <p>{aguardandoTerceiros[0] ? aguardandoTerceiros[0].titulo : 'Sem bloqueio externo neste momento'}</p>
              <span className="central-day-action-hint">Ver pendências externas</span>
            </button>
            <button type="button" className="central-day-card interactive" onClick={() => onOpenSection('fotos')}>
              <span className="central-day-eyebrow">Última evidência visual</span>
              <strong>{fotoDestaque ? fotoDestaque.titulo : 'Sem foto recente'}</strong>
              <p>{fotoDestaque ? `${fotoDestaque.tag}${fotoDestaque.purpose ? ` • ${fotoDestaque.purpose}` : ''}` : 'Use a galeria para registrar avanço e problema.'}</p>
              <span className="central-day-action-hint">Abrir evidências da obra</span>
            </button>
          </div>

          <div className="central-day-actions">
            <button type="button" className="portfolio-card-button" onClick={() => onOpenSection('operacao')}>
              Abrir operação
            </button>
            <button type="button" className="inline-action-button" onClick={() => onOpenSection('planejamento')}>
              Ver cronograma e MTEs
            </button>
            <button type="button" className="inline-action-button" onClick={() => onOpenSection('fotos')}>
              Ir para galeria
            </button>
          </div>
        </div>

        <div className="surface-card animate-in stagger-2">
          <div className="card-title">Fechamento guiado do dia</div>
          <div className="card-helper-text">Este bloco existe para evitar um erro comum do mercado: encerrar a obra sem evidência, sem apontamento e sem fechamento operacional consistente.</div>
          <div className="central-day-closure-card">
            <div className="central-day-closure-score">
              <span>Prontidão de fechamento</span>
              <strong>{readinessScore}/4</strong>
              <p>
                {fechamentoDia
                  ? `Fechado por ${fechamentoDia.owner} em ${fechamentoDia.closedAt}.`
                  : pendenciasCriticas.length > 0
                  ? `${pendenciasCriticas.length} pendência(s) crítica(s) ainda impedem um fechamento limpo.`
                  : unresolvedChecklist > 0
                    ? `${unresolvedChecklist} item(ns) de checklist ainda precisam ser concluídos.`
                    : 'A frente está perto de um fechamento operacional consistente.'}
              </p>
            </div>
            <div className="central-day-closure-list">
              {dailyClosureReadiness.map((item) => (
                <div key={item.label} className={`central-day-closure-item ${item.ok ? 'ok' : 'pending'}`}>
                  <strong>{item.ok ? 'OK' : 'Pendente'}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card-title" style={{ marginTop: 22 }}>Radar operacional</div>
          {(tarefasPrioritarias.length > 0 ? tarefasPrioritarias : obra.operacao.tarefasDia.slice(0, 3)).map((item) => (
            <div key={`${item.titulo}-${item.horario}`} className="operation-row">
              <div>
                <div className="operation-title">{item.titulo}</div>
                <div className="operation-copy">{item.responsavel}</div>
              </div>
              <div className="operation-side">
                <strong>{item.horario}</strong>
              </div>
            </div>
          ))}
          <div className="central-day-highlight">
            <span className="central-day-eyebrow">Último apontamento</span>
            <strong>{apontamentoDestaque ? apontamentoDestaque.autor : 'Sem apontamento recente'}</strong>
            <p>{apontamentoDestaque ? apontamentoDestaque.texto : 'Os registros de campo mais recentes aparecem aqui para orientar decisões rápidas.'}</p>
          </div>
          {fechamentoDia ? (
            <div className="central-day-highlight">
              <span className="central-day-eyebrow">Fechamento registrado</span>
              <strong>{fechamentoDia.owner}</strong>
              <p>{fechamentoDia.summary}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="content-grid">
        <div className="surface-card animate-in stagger-2">
          <div className="card-title">Itens sem resposta na obra</div>
          <div className="card-helper-text">Esses itens costumam envelhecer rápido e explicam por que o sistema precisa ser usado todos os dias.</div>
          <div className="portfolio-duty-list">
            {unresolvedItems.length > 0 ? unresolvedItems.map((item) => (
              <button key={`${item.title}-${item.meta}`} type="button" className="portfolio-duty-row" onClick={() => onOpenSection('operacao')}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.note}</span>
                </div>
                <small>{item.meta}</small>
              </button>
            )) : (
              <div className="portfolio-duty-empty">A obra está sem itens aguardando resposta explícita neste momento.</div>
            )}
          </div>
        </div>

        <div className="surface-card animate-in stagger-3">
          <div className="card-title">Rito do papel nesta obra</div>
          <div className="card-helper-text">Esse roteiro ajuda o sistema a virar rotina de trabalho, não só consulta eventual.</div>
          <div className="portfolio-ritual-list">
            {personaRitual.map((item, index) => (
              <div key={item} className="portfolio-ritual-item">
                <strong>{index + 1}</strong>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
