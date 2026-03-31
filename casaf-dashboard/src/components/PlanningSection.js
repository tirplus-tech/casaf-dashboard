import React from 'react';
import DecisionBoard from './DecisionBoard';

function getStatusClass(status) {
  if (status === 'Concluído' || status === 'Aprovado') {
    return { bg: '#dcfce7', color: '#15803d' };
  }

  if (status === 'Em andamento' || status === 'Em revisão') {
    return { bg: '#dbeafe', color: '#2563eb' };
  }

  return { bg: '#fef3c7', color: '#d97706' };
}

export default function PlanningSection({
  planejamento,
  onAdvanceCronograma,
  onAdvanceMte,
  onDraftChange,
  onAddCronograma,
  onAddMte,
  decisions = [],
  productPersona = 'executive',
  onAdvanceDecision,
  onAddDecisionAlignment,
  onOpenSection,
}) {
  const leadCronograma = [...planejamento.cronograma].sort((a, b) => b.percentual - a.percentual)[0];
  const pendingMte = planejamento.mtes.find((item) => item.status !== 'Aprovado');
  const personaFocus = {
    executive: 'Entre aqui para entender qual marco ameaça prazo e qual liberação ainda falta sair.',
    engineering: 'Use esta tela para fechar sequência técnica, cronograma e MTEs sem depender de planilha paralela.',
    finance: 'Planejamento aqui serve para prever impacto em liberação, faturamento e reprogramação.',
    field: 'Mesmo no campo, essa leitura ajuda a entender o que ainda não está liberado para executar.',
  };
  const planningPriorities = [
    { label: 'Marco crítico', value: leadCronograma ? leadCronograma.fase : 'Sem fase crítica', copy: leadCronograma ? `${leadCronograma.percentual}% concluído • prazo ${leadCronograma.prazo}` : 'O cronograma está sem marco dominante neste momento.' },
    { label: 'Liberação em foco', value: pendingMte ? pendingMte.codigo : 'MTEs estáveis', copy: pendingMte ? pendingMte.titulo : 'Não há liberação pendente com maior pressão agora.' },
    { label: 'Leitura por perfil', value: productPersona === 'executive' ? 'Diretoria' : productPersona === 'engineering' ? 'Engenharia' : productPersona === 'finance' ? 'Financeiro' : 'Campo', copy: personaFocus[productPersona] || personaFocus.executive },
  ];
  const planningRitual = [
    'Revise o cronograma que mais pressiona prazo e liberação.',
    'Atualize MTEs que ainda não saíram de pendente ou revisão.',
    'Saia da tela com um checkpoint técnico claro para a próxima frente.',
  ];

  return (
    <>
      <div className="priority-strip">
        {planningPriorities.map((item, index) => (
          <div key={item.label} className={`surface-card animate-in priority-card ${index === 0 ? 'priority-card-primary' : ''}`}>
            <div className="priority-card-label">{item.label}</div>
            <strong>{item.value}</strong>
            <p>{item.copy}</p>
          </div>
        ))}
      </div>

      <DecisionBoard
        title="Decisões de planejamento"
        helper="Use esta fila para combinar dono, prazo e andamento das liberações técnicas e marcos que definem o ritmo da obra."
        decisions={decisions}
        onAdvance={onAdvanceDecision}
        onAddAlignment={onAddDecisionAlignment}
        onOpenSection={onOpenSection}
        productPersona={productPersona}
      />

      <div className="finance-summary">
        {planejamento.indicadores.map((item) => (
          <div key={item.label} className="surface-card metric-card animate-in">
            <div className="metric-label">{item.label}</div>
            <div className="metric-value">{item.valor}</div>
            <div className="metric-sub" style={{ color: '#64748b' }}>{item.detalhe}</div>
          </div>
        ))}
      </div>

      <div className="content-grid">
        <div className="surface-card animate-in stagger-2">
          <div className="card-title">Cronograma executivo</div>
          <div className="operation-meta" style={{ marginBottom: 14 }}>
            Cadastre novas fases rapidamente. Se o prazo ainda não estiver fechado, o sistema registra como "A definir".
          </div>
          <div className="operation-inline-form">
            <input
              className="operation-input"
              value={planejamento.novaFaseNome}
              onChange={(event) => onDraftChange('novaFaseNome', event.target.value)}
              placeholder="Nova fase do cronograma"
            />
            <input
              className="operation-input"
              value={planejamento.novaFasePrazo}
              onChange={(event) => onDraftChange('novaFasePrazo', event.target.value)}
              placeholder="Prazo alvo"
            />
            <button type="button" className="portfolio-card-button operation-submit-button" onClick={onAddCronograma}>
              Adicionar fase
            </button>
          </div>
          {planejamento.cronograma.map((item, index) => {
            const status = getStatusClass(item.status);

            return (
              <div key={item.fase} className="operation-row">
                <div style={{ flex: 1 }}>
                  <div className="operation-title">{item.fase}</div>
                  <div className="operation-copy">Prazo alvo: {item.prazo}</div>
                  <div className="progress-track" style={{ marginTop: 10 }}>
                    <div className="progress-bar" style={{ width: `${item.percentual}%`, background: '#2563eb' }} />
                  </div>
                </div>
                <div className="operation-side">
                  <span className="mini-badge" style={{ background: status.bg, color: status.color, padding: '6px 10px', fontSize: 11 }}>
                    {item.status}
                  </span>
                  <strong>{item.percentual}%</strong>
                  <button type="button" className="inline-action-button" onClick={() => onAdvanceCronograma(index)}>
                    Avançar
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="surface-card animate-in stagger-3">
          <div className="card-title">MTEs e liberações</div>
          <div className="operation-meta" style={{ marginBottom: 14 }}>
            Você pode cadastrar o título primeiro e completar código ou responsável depois. O painel gera um código padrão quando necessário.
          </div>
          <div className="operation-inline-form">
            <input
              className="operation-input"
              value={planejamento.novoMteCodigo}
              onChange={(event) => onDraftChange('novoMteCodigo', event.target.value)}
              placeholder="Código MTE"
            />
            <input
              className="operation-input"
              value={planejamento.novoMteTitulo}
              onChange={(event) => onDraftChange('novoMteTitulo', event.target.value)}
              placeholder="Título"
            />
            <input
              className="operation-input"
              value={planejamento.novoMteResponsavel}
              onChange={(event) => onDraftChange('novoMteResponsavel', event.target.value)}
              placeholder="Responsável"
            />
            <button type="button" className="portfolio-card-button operation-submit-button" onClick={onAddMte}>
              Criar MTE
            </button>
          </div>
          {planejamento.mtes.map((item, index) => {
            const status = getStatusClass(item.status);

            return (
              <div key={item.codigo} className="operation-row">
                <div>
                  <div className="operation-title">{item.codigo}</div>
                  <div className="operation-copy">{item.titulo}</div>
                  <div className="operation-meta">Responsável: {item.responsavel}</div>
                </div>
                <div className="operation-side">
                  <span className="mini-badge" style={{ background: status.bg, color: status.color, padding: '6px 10px', fontSize: 11 }}>
                    {item.status}
                  </span>
                  <button type="button" className="inline-action-button" onClick={() => onAdvanceMte(index)}>
                    Atualizar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="surface-card animate-in stagger-2">
        <div className="card-title">Rito técnico de planejamento</div>
        <div className="card-helper-text">Esse bloco traduz o que um coordenador técnico precisa fazer no sistema para que a obra não dependa só de memória e conversa paralela.</div>
        <div className="workflow-ritual-grid">
          {planningRitual.map((item, index) => (
            <div key={item} className="workflow-ritual-card">
              <span>{index + 1}. Passo técnico</span>
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
