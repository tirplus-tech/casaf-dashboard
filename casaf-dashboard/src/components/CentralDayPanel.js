import React from 'react';

export default function CentralDayPanel({ obra, onOpenSection }) {
  const tarefasPrioritarias = obra.operacao.tarefasDia.filter((item) => item.status === 'prioridade').slice(0, 3);
  const pendenciasCriticas = obra.operacao.pendencias.filter((item) => item.status === 'critico');
  const aguardandoTerceiros = obra.operacao.pendencias.filter((item) => String(item.dono || '').toLowerCase().includes('cliente') || String(item.dono || '').toLowerCase().includes('suprimentos'));
  const fotoDestaque = obra.fotosObra[0];
  const apontamentoDestaque = obra.operacao.apontamentos[0];
  const fechamentoDia = obra.operacao.fechamentoDia;
  const presentTeam = obra.operacao.presencaHoje.filter((item) => item.status === 'presente').length;
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
    </>
  );
}
