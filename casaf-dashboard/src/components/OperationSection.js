import React, { useState } from 'react';
import DecisionBoard from './DecisionBoard';

function getTaskBadge(status) {
  if (status === 'done') {
    return { label: 'Concluída', className: 'resolved' };
  }

  if (status === 'prioridade') {
    return { label: 'Prioridade', className: 'critical' };
  }

  if (status === 'aguardando_retorno') {
    return { label: 'Aguardando retorno', className: '' };
  }

  if (status === 'campo') {
    return { label: 'Campo', className: 'field' };
  }

  return { label: 'Planejado', className: '' };
}

function getChecklistLabel(status) {
  if (status === 'done') {
    return { label: 'Concluido', color: '#16a34a', bg: '#dcfce7' };
  }

  if (status === 'active') {
    return { label: 'Em execucao', color: '#2563eb', bg: '#dbeafe' };
  }

  return { label: 'Pendente', color: '#94a3b8', bg: '#f1f5f9' };
}

function getPendenciaLabel(status) {
  if (status === 'critico') {
    return { label: 'Crítico', className: 'critical' };
  }

  if (status === 'em_tratativa') {
    return { label: 'Em tratativa', className: '' };
  }

  if (status === 'aguardando_retorno') {
    return { label: 'Aguardando retorno', className: '' };
  }

  if (status === 'resolvido') {
    return { label: 'Resolvido', className: '' };
  }

  return { label: 'Aguardando', className: '' };
}

function getMaxValue(items) {
  return Math.max(...items.map((item) => item.value), 1);
}

export default function OperationSection({
  operacao,
  decisions = [],
  productPersona = 'executive',
  onAdvanceDecision,
  onAddDecisionAlignment,
  onOpenSection,
}) {
  const [taskFilter, setTaskFilter] = useState('all');
  const [pendenciaFilter, setPendenciaFilter] = useState('all');
  const [alignmentDrafts, setAlignmentDrafts] = useState({});
  const presenceOptions = ['Presente', 'Atrasado', 'Falta justificada', 'Falta'];
  const presentCount = operacao.presencaHoje.filter((item) => item.status === 'Presente').length;
  const delayedCount = operacao.presencaHoje.filter((item) => item.status === 'Atrasado').length;
  const absentCount = operacao.presencaHoje.filter((item) => item.status.includes('Falta')).length;
  const checklistDone = operacao.checklist.filter((item) => item.status === 'done').length;
  const criticalPendencias = operacao.pendencias.filter((item) => item.status === 'critico').length;
  const latestNote = operacao.apontamentos[0];
  const waitingThirdParties = operacao.pendencias.filter((item) => String(item.dono || '').toLowerCase().includes('cliente') || String(item.dono || '').toLowerCase().includes('suprimentos')).length;
  const evidenceCount = operacao.evidenciasRecentes || 0;
  const tasksAwaitingResponse = operacao.tarefasDia.filter((item) => ['aguardando_retorno', 'prioridade'].includes(item.status)).length;
  const tasksDone = operacao.tarefasDia.filter((item) => item.status === 'done').length;
  const quickActions = [
    { id: 'material', eyebrow: 'Suprimentos', title: 'Solicitar material', copy: 'Abre uma pendencia e registra no historico para acelerar reposicao.' },
    { id: 'delay', eyebrow: 'Prazo', title: 'Registrar atraso', copy: 'Marca desvio critico para engenharia agir sem depender de conversa paralela.' },
    { id: 'rework', eyebrow: 'Qualidade', title: 'Abrir retrabalho', copy: 'Formaliza correcao necessaria para evitar entrega com desvio.' },
    { id: 'approval', eyebrow: 'Aprovacao', title: 'Solicitar aprovacao', copy: 'Registra dependencia externa para liberar a proxima frente.' },
    { id: 'release', eyebrow: 'Frente', title: 'Liberar frente', copy: 'Cria uma nova tarefa prioritaria para a equipe entrar em execucao.' },
  ];
  const operationRitual = [
    { label: '1. Definir prioridade', detail: criticalPendencias > 0 ? `${criticalPendencias} bloqueio(s) pedem atuação imediata.` : 'A frente está sem bloqueio crítico dominante.' },
    { label: '2. Distribuir execução', detail: `${operacao.tarefasDia.length} tarefa(s) no dia para organizar com a equipe.` },
    { label: '3. Fechar com evidência', detail: evidenceCount > 0 ? `${evidenceCount} evidência(s) já registradas para sustentar o fechamento.` : 'A frente ainda precisa de registro visual para encerrar com segurança.' },
  ];

  const taskBreakdown = [
    { label: 'Prioridade', value: operacao.tarefasDia.filter((item) => item.status === 'prioridade').length, color: '#1d4ed8' },
    { label: 'Aguardando retorno', value: operacao.tarefasDia.filter((item) => item.status === 'aguardando_retorno').length, color: '#d97706' },
    { label: 'Campo', value: operacao.tarefasDia.filter((item) => item.status === 'campo').length, color: '#0f766e' },
    { label: 'Planejado', value: operacao.tarefasDia.filter((item) => item.status === 'planejado').length, color: '#94a3b8' },
    { label: 'Concluídas', value: tasksDone, color: '#16a34a' },
  ];
  const pendenciaBreakdown = [
    { label: 'Criticas', value: operacao.pendencias.filter((item) => item.status === 'critico').length, color: '#dc2626' },
    { label: 'Aguardando', value: operacao.pendencias.filter((item) => ['aguardando', 'aguardando_retorno'].includes(item.status)).length, color: '#d97706' },
    { label: 'Resolvidas', value: operacao.pendencias.filter((item) => item.status === 'resolvido').length, color: '#16a34a' },
  ];
  const attendanceBreakdown = [
    { label: 'Presentes', value: presentCount, color: '#16a34a' },
    { label: 'Atrasados', value: delayedCount, color: '#d97706' },
    { label: 'Faltas', value: absentCount, color: '#dc2626' },
  ];

  const filteredTasks = operacao.tarefasDia.filter((item) => taskFilter === 'all' ? true : item.status === taskFilter);
  const filteredPendencias = operacao.pendencias.filter((item) => pendenciaFilter === 'all' ? true : item.status === pendenciaFilter);
  const responseDebtItems = [
    ...operacao.tarefasDia
      .filter((item) => ['aguardando_retorno', 'prioridade'].includes(item.status))
      .slice(0, 2)
      .map((item) => ({
        type: 'Tarefa',
        title: item.titulo,
        owner: item.responsavel,
        due: item.prazo || item.horario || 'A definir',
        note: item.alinhamento || 'Tarefa sem alinhamento recente.',
      })),
    ...operacao.pendencias
      .filter((item) => ['aguardando', 'aguardando_retorno', 'em_tratativa', 'critico'].includes(item.status))
      .slice(0, 2)
      .map((item) => ({
        type: 'Pendência',
        title: item.titulo,
        owner: item.dono,
        due: item.prazo || 'A definir',
        note: item.alinhamento || item.impacto,
      })),
  ].slice(0, 4);
  const closureRequirements = [
    { ok: criticalPendencias === 0, label: 'Sem pendência crítica aberta' },
    { ok: checklistDone === operacao.checklist.length, label: 'Checklist operacional concluído' },
    { ok: evidenceCount > 0, label: 'Evidência visual registrada' },
    { ok: Boolean(latestNote), label: 'Apontamento do dia registrado' },
    { ok: Boolean(String(operacao.fechamentoResumo || '').trim()), label: 'Resumo de fechamento preenchido' },
  ];
  const closureReadyCount = closureRequirements.filter((item) => item.ok).length;
  const leadDecision = decisions[0];
  const personaFocus = {
    executive: 'Veja primeiro o que trava a frente e quem está segurando a resposta.',
    engineering: 'Priorize desvio crítico, tarefa de campo e checklist que ainda impede avanço.',
    finance: 'Entenda o que na operação vai virar custo, retrabalho ou atraso de medição.',
    field: 'Use essa tela para alinhar equipe, registrar execução e fechar o dia com evidência.',
  };
  const operationPriorities = [
    { label: 'Prioridade agora', value: leadDecision ? leadDecision.titulo : (filteredPendencias[0]?.titulo || 'Frente sem bloqueio dominante'), copy: leadDecision ? leadDecision.contexto : 'A operação está sem um travamento formal acima dos demais.' },
    { label: 'Dono da ação', value: leadDecision ? leadDecision.responsavel : (filteredTasks[0]?.responsavel || 'Equipe da obra'), copy: 'Responsável que deve responder pela próxima movimentação relevante.' },
    { label: 'Fechamento esperado', value: evidenceCount > 0 ? `${evidenceCount} evidência(s) no dia` : 'Registrar evidências', copy: 'A obra precisa encerrar o dia com apontamento, checklist e contexto rastreável.' },
  ];

  return (
    <>
      <div className='priority-strip'>
        {operationPriorities.map((item, index) => (
          <div key={item.label} className={`surface-card animate-in priority-card ${index === 0 ? 'priority-card-primary' : ''}`}>
            <div className='priority-card-label'>{item.label}</div>
            <strong>{item.value}</strong>
            <p>{item.copy}</p>
          </div>
        ))}
        <div className='surface-card animate-in priority-card priority-card-soft'>
          <div className='priority-card-label'>Leitura para {productPersona === 'executive' ? 'diretoria' : productPersona === 'engineering' ? 'engenharia' : productPersona === 'finance' ? 'financeiro' : 'campo'}</div>
          <strong>Como usar esta tela</strong>
          <p>{personaFocus[productPersona] || personaFocus.executive}</p>
        </div>
      </div>

      <DecisionBoard
        title='Decisões operacionais'
        helper='Formalize aqui quem precisa agir, qual o prazo combinado e em que ponto a operação está.'
        decisions={decisions}
        onAdvance={onAdvanceDecision}
        onAddAlignment={onAddDecisionAlignment}
        onOpenSection={onOpenSection}
        productPersona={productPersona}
      />

      <div className='finance-summary'>
        <div className='surface-card metric-card animate-in'>
          <div className='metric-label'>Equipe presente</div>
          <div className='metric-value'>{presentCount}</div>
          <div className='metric-sub' style={{ color: '#16a34a' }}>Base do dia confirmada</div>
        </div>
        <div className='surface-card metric-card animate-in'>
          <div className='metric-label'>Atrasos</div>
          <div className='metric-value'>{delayedCount}</div>
          <div className='metric-sub' style={{ color: '#d97706' }}>Acompanhar impacto na produtividade</div>
        </div>
        <div className='surface-card metric-card animate-in'>
          <div className='metric-label'>Faltas do dia</div>
          <div className='metric-value'>{absentCount}</div>
          <div className='metric-sub' style={{ color: '#dc2626' }}>Aplicar regra do acordo quando necessario</div>
        </div>
        <div className='surface-card metric-card animate-in'>
          <div className='metric-label'>Checklist concluido</div>
          <div className='metric-value'>{checklistDone}/{operacao.checklist.length}</div>
          <div className='metric-sub' style={{ color: '#2563eb' }}>Prontidao operacional da frente</div>
        </div>
        <div className='surface-card metric-card animate-in'>
          <div className='metric-label'>Aguardando terceiros</div>
          <div className='metric-value'>{waitingThirdParties}</div>
          <div className='metric-sub' style={{ color: '#64748b' }}>Itens que dependem de cliente ou suprimentos</div>
        </div>
        <div className='surface-card metric-card animate-in'>
          <div className='metric-label'>Evidencias recentes</div>
          <div className='metric-value'>{evidenceCount}</div>
          <div className='metric-sub' style={{ color: '#0f766e' }}>Fotos operacionais conectadas a execucao</div>
        </div>
      </div>

      <div className='section-mini-chart-grid'>
        {[{ title: 'Pulso das tarefas', helper: 'Mostra rapidamente onde a frente esta concentrando energia hoje.', items: taskBreakdown }, { title: 'Mapa de pendencias', helper: 'Ajuda a separar bloqueio critico de acompanhamento normal.', items: pendenciaBreakdown }, { title: 'Presenca da equipe', helper: 'Leitura rapida para engenharia entender estabilidade do dia.', items: attendanceBreakdown }].map((chart, chartIndex) => (
          <div key={chart.title} className={`surface-card animate-in section-mini-chart-card ${chartIndex > 0 ? `stagger-${chartIndex + 1}` : ''}`}>
            <div className='card-title'>{chart.title}</div>
            <div className='card-helper-text'>{chart.helper}</div>
            <div className='mini-chart-list'>
              {chart.items.map((item) => (
                <div key={item.label} className='mini-chart-row'>
                  <div className='mini-chart-meta'>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                  <div className='mini-chart-track'>
                    <div className='mini-chart-fill' style={{ width: `${(item.value / getMaxValue(chart.items)) * 100}%`, background: item.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className='content-grid'>
        <div className='surface-card animate-in'>
          <div className='card-title'>Acoes rapidas da obra</div>
          <div className='quick-actions-grid'>
            {quickActions.map((item) => (
              <button key={item.id} type='button' className='quick-action-card' onClick={() => operacao.onQuickAction(item.id)}>
                <span className='quick-action-eyebrow'>{item.eyebrow}</span>
                <strong>{item.title}</strong>
                <p>{item.copy}</p>
              </button>
            ))}
          </div>
        </div>

        <div className='surface-card animate-in stagger-2 operation-spotlight-card'>
          <div className='card-title'>Radar do dia</div>
          <div className='operation-spotlight-item'>
            <span>Pendencias criticas</span>
            <strong>{criticalPendencias}</strong>
          </div>
          <div className='operation-spotlight-item'>
            <span>Ultimo apontamento</span>
            <strong>{latestNote ? latestNote.autor : 'Sem registros'}</strong>
          </div>
          <div className='operation-spotlight-copy'>
            {latestNote ? latestNote.texto : 'Use os apontamentos para construir um historico confiavel da frente de servico.'}
          </div>
        </div>
      </div>

      <div className='content-grid'>
        <div className='surface-card animate-in'>
          <div className='card-title'>Sala de comando do dia</div>
          <div className='card-helper-text'>Essa leitura existe para o engenheiro e a liderança entenderem, em segundos, o que exige cobrança antes de abrir várias listas.</div>
          <div className='workflow-ritual-grid'>
            <div className='workflow-ritual-card'>
              <span>Tarefas que pedem retorno</span>
              <strong>{tasksAwaitingResponse}</strong>
            </div>
            <div className='workflow-ritual-card'>
              <span>Pendências críticas</span>
              <strong>{criticalPendencias}</strong>
            </div>
            <div className='workflow-ritual-card'>
              <span>Checklist pendente</span>
              <strong>{operacao.checklist.length - checklistDone}</strong>
            </div>
          </div>
        </div>

        <div className='surface-card animate-in stagger-2'>
          <div className='card-title'>Itens que ainda pedem resposta</div>
          <div className='card-helper-text'>Se o sistema virar hábito, essa fila deve ser esvaziada todos os dias.</div>
          <div className='portfolio-duty-list'>
            {responseDebtItems.length > 0 ? responseDebtItems.map((item) => (
              <div key={`${item.type}-${item.title}`} className='portfolio-duty-row'>
                <div>
                  <strong>{item.type}: {item.title}</strong>
                  <span>{item.note}</span>
                </div>
                <small>{item.owner} • {item.due}</small>
              </div>
            )) : (
              <div className='portfolio-duty-empty'>A frente está com boa cadência e sem itens explícitos aguardando resposta.</div>
            )}
          </div>
        </div>
      </div>

      <div className='surface-card animate-in stagger-2'>
        <div className='card-title'>Rito operacional recomendado</div>
        <div className='card-helper-text'>Essa camada ajuda a equipe a usar o sistema do jeito certo: decidir, executar e fechar com rastreabilidade.</div>
        <div className='workflow-ritual-grid'>
          {operationRitual.map((item) => (
            <div key={item.label} className='workflow-ritual-card'>
              <span>{item.label}</span>
              <strong>{item.detail}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className='operation-grid'>
        <div className='surface-card animate-in'>
          <div className='card-header-row'>
            <div>
              <div className='card-title'>Plano do dia</div>
              <div className='card-helper-text'>Filtre por prioridade para concentrar a equipe na frente mais importante.</div>
            </div>
            <div className='filter-chip-row compact'>
              {[{ id: 'all', label: 'Tudo' }, { id: 'prioridade', label: 'Prioridade' }, { id: 'aguardando_retorno', label: 'Aguardando retorno' }, { id: 'campo', label: 'Campo' }, { id: 'planejado', label: 'Planejado' }, { id: 'done', label: 'Concluídas' }].map((item) => (
                <button key={item.id} type='button' className={`filter-chip ${taskFilter === item.id ? 'active' : ''}`} onClick={() => setTaskFilter(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className='operation-inline-form'>
            <input className='operation-input' value={operacao.novaTarefaTitulo} onChange={(event) => operacao.onDraftChange('novaTarefaTitulo', event.target.value)} placeholder='Nova tarefa do dia' />
            <input className='operation-input' value={operacao.novaTarefaResponsavel} onChange={(event) => operacao.onDraftChange('novaTarefaResponsavel', event.target.value)} placeholder='Responsavel' />
            <input className='operation-input' value={operacao.novaTarefaHorario} onChange={(event) => operacao.onDraftChange('novaTarefaHorario', event.target.value)} placeholder='Horario' />
            <input className='operation-input' value={operacao.novaTarefaPrazo} onChange={(event) => operacao.onDraftChange('novaTarefaPrazo', event.target.value)} placeholder='Prazo combinado' />
            <input className='operation-input operation-full-span' value={operacao.novoAlinhamentoTarefa} onChange={(event) => operacao.onDraftChange('novoAlinhamentoTarefa', event.target.value)} placeholder='Alinhamento da tarefa: o que ficou combinado, quem deve responder e o que falta para concluir...' />
            <button type='button' className='portfolio-card-button operation-submit-button' onClick={operacao.onAddTask}>Criar tarefa</button>
          </div>
          {filteredTasks.length > 0 ? filteredTasks.map((tarefa) => {
            const badge = getTaskBadge(tarefa.status);
            return (
              <div key={`${tarefa.titulo}-${tarefa.horario}`} className='operation-row'>
                <div>
                  <div className='operation-title'>{tarefa.titulo}</div>
                  <div className='operation-copy'>{tarefa.responsavel}</div>
                  <div className='operation-meta'>Prazo: {tarefa.prazo || tarefa.horario || 'A definir'}{tarefa.ultimaMovimentacao ? ` • ${tarefa.ultimaMovimentacao}` : ''}</div>
                  {tarefa.alinhamento ? <div className='card-helper-text' style={{ marginTop: 6 }}>{tarefa.alinhamento}</div> : null}
                  <div className='operation-inline-note'>
                    <input
                      className='operation-input'
                      value={alignmentDrafts[`task-${tarefa.titulo}`] || ''}
                      onChange={(event) => setAlignmentDrafts((current) => ({ ...current, [`task-${tarefa.titulo}`]: event.target.value }))}
                      placeholder='Registrar alinhamento rápido desta tarefa...'
                    />
                    <button
                      type='button'
                      className='inline-action-button'
                      onClick={() => {
                        tarefa.onAddAlignment(alignmentDrafts[`task-${tarefa.titulo}`] || '');
                        setAlignmentDrafts((current) => ({ ...current, [`task-${tarefa.titulo}`]: '' }));
                      }}
                    >
                      Salvar alinhamento
                    </button>
                  </div>
                </div>
                <div className='operation-side'>
                  <span className={`portfolio-chip ${badge.className}`}>{badge.label}</span>
                  <strong>{tarefa.horario}</strong>
                  <button type='button' className='inline-action-button' onClick={tarefa.onAdvance}>Atualizar</button>
                </div>
              </div>
            );
          }) : <div className='collapsed-summary'>Nenhuma tarefa encontrada para este filtro. Ajuste o recorte para recuperar a programacao completa.</div>}
        </div>

        <div className='surface-card animate-in stagger-2'>
          <div className='card-header-row'>
            <div>
              <div className='card-title'>Pendencias e impedimentos</div>
              <div className='card-helper-text'>Use filtros para separar o que trava a obra do que esta apenas em acompanhamento.</div>
            </div>
            <div className='filter-chip-row compact'>
              {[{ id: 'all', label: 'Tudo' }, { id: 'critico', label: 'Critico' }, { id: 'em_tratativa', label: 'Em tratativa' }, { id: 'aguardando_retorno', label: 'Aguardando retorno' }, { id: 'aguardando', label: 'Aguardando' }, { id: 'resolvido', label: 'Resolvido' }].map((item) => (
                <button key={item.id} type='button' className={`filter-chip ${pendenciaFilter === item.id ? 'active' : ''}`} onClick={() => setPendenciaFilter(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className='operation-inline-form'>
            <input className='operation-input' value={operacao.novaPendenciaTitulo} onChange={(event) => operacao.onDraftChange('novaPendenciaTitulo', event.target.value)} placeholder='Nova pendencia' />
            <input className='operation-input' value={operacao.novaPendenciaImpacto} onChange={(event) => operacao.onDraftChange('novaPendenciaImpacto', event.target.value)} placeholder='Impacto' />
            <input className='operation-input' value={operacao.novaPendenciaDono} onChange={(event) => operacao.onDraftChange('novaPendenciaDono', event.target.value)} placeholder='Responsavel' />
            <input className='operation-input' value={operacao.novaPendenciaPrazo} onChange={(event) => operacao.onDraftChange('novaPendenciaPrazo', event.target.value)} placeholder='Prazo combinado' />
            <input className='operation-input operation-full-span' value={operacao.novoAlinhamentoPendencia} onChange={(event) => operacao.onDraftChange('novoAlinhamentoPendencia', event.target.value)} placeholder='Alinhamento rápido: quem falou com quem, o que ficou combinado, qual retorno é esperado...' />
            <button type='button' className='portfolio-card-button operation-submit-button' onClick={operacao.onAddPendencia}>Abrir pendencia</button>
          </div>
          {filteredPendencias.length > 0 ? filteredPendencias.map((item) => (
            <div key={item.titulo} className='operation-row'>
              <div>
                <div className='operation-title'>{item.titulo}</div>
                <div className='operation-copy'>{item.impacto}</div>
                <div className='operation-meta'>Responsavel: {item.dono} • Prazo: {item.prazo || 'A definir'}</div>
                {item.alinhamento ? <div className='card-helper-text' style={{ marginTop: 6 }}>{item.alinhamento}</div> : null}
                <div className='operation-inline-note'>
                  <input
                    className='operation-input'
                    value={alignmentDrafts[item.titulo] || ''}
                    onChange={(event) => setAlignmentDrafts((current) => ({ ...current, [item.titulo]: event.target.value }))}
                    placeholder='Registrar alinhamento rápido desta pendência...'
                  />
                  <button
                    type='button'
                    className='inline-action-button'
                    onClick={() => {
                      item.onAddAlignment(alignmentDrafts[item.titulo] || '');
                      setAlignmentDrafts((current) => ({ ...current, [item.titulo]: '' }));
                    }}
                  >
                    Salvar alinhamento
                  </button>
                </div>
              </div>
              <div className='operation-side'>
                <span className={`portfolio-chip ${getPendenciaLabel(item.status).className}`}>{getPendenciaLabel(item.status).label}</span>
                <button type='button' className='inline-action-button' onClick={item.onAdvance}>Atualizar</button>
              </div>
            </div>
          )) : <div className='collapsed-summary'>Nenhuma pendencia encontrada neste recorte. Isso ajuda a limpar o foco da equipe.</div>}
        </div>
      </div>

      <div className='content-grid'>
        <div className='surface-card animate-in stagger-2'>
          <div className='card-title'>Checklist operacional</div>
          <div className='operation-inline-form single'>
            <input className='operation-input' value={operacao.novoChecklistItem} onChange={(event) => operacao.onDraftChange('novoChecklistItem', event.target.value)} placeholder='Adicionar item de checklist' />
            <button type='button' className='portfolio-card-button operation-submit-button' onClick={operacao.onAddChecklist}>Adicionar</button>
          </div>
          {operacao.checklist.map((item) => {
            const badge = getChecklistLabel(item.status);
            return (
              <div key={item.item} className='operation-row'>
                <div className='operation-title'>{item.item}</div>
                <div className='operation-side'>
                  <span className='mini-badge' style={{ background: badge.bg, color: badge.color, padding: '6px 10px', fontSize: 11 }}>{badge.label}</span>
                  <button type='button' className='inline-action-button' onClick={item.onAdvance}>Avancar</button>
                </div>
              </div>
            );
          })}
        </div>

        <div className='surface-card animate-in stagger-3'>
          <div className='card-title'>Equipe em campo</div>
          {operacao.equipeCampo.map((pessoa) => (
            <div key={pessoa.nome} className='operation-row'>
              <div>
                <div className='operation-title'>{pessoa.nome}</div>
                <div className='operation-copy'>{pessoa.funcao}</div>
              </div>
              <div className='operation-side'><strong>{pessoa.status}</strong></div>
            </div>
          ))}
        </div>
      </div>

      <div className='content-grid'>
        <div className='surface-card animate-in stagger-2'>
          <div className='card-title'>Presenca e diaria da equipe</div>
          {operacao.presencaHoje.map((pessoa) => (
            <div key={pessoa.nome} className='operation-row'>
              <div>
                <div className='operation-title'>{pessoa.nome}</div>
                <div className='operation-copy'>{pessoa.funcao}</div>
              </div>
              <div className='operation-side'>
                <select className='operation-select' value={pessoa.status} onChange={pessoa.onChange}>
                  {presenceOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>

        <div className='surface-card animate-in stagger-3'>
          <div className='card-title'>Apontamentos rapidos de campo</div>
          <div className='operation-note-form'>
            <textarea className='operation-textarea' value={operacao.novoApontamento} onChange={operacao.onNoteChange} placeholder='Registrar observacao de campo, produtividade, seguranca ou impedimento...' />
            <button type='button' className='portfolio-card-button' onClick={operacao.onAddNote}>Adicionar apontamento</button>
          </div>
          {operacao.apontamentos.map((item) => (
            <div key={`${item.autor}-${item.data}-${item.texto}`} className='doc-row' style={{ padding: '14px 0', borderBottom: '0.5px solid #f1f5f9' }}>
              <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 500, marginBottom: 4 }}>{item.autor}</div>
              <div className='operation-copy' style={{ marginBottom: 6 }}>{item.texto}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.data}</div>
            </div>
          ))}
        </div>
      </div>

      <div className='content-grid'>
        <div className='surface-card animate-in stagger-2'>
          <div className='card-title'>Fechamento operacional do dia</div>
          <div className='card-helper-text'>Esse fluxo prepara a obra para o encerramento diário com critério, dono e registro. Ele existe para reduzir fechamento no improviso.</div>
          <div className='central-day-closure-card'>
            <div className='central-day-closure-score'>
              <span>Prontidão para fechar</span>
              <strong>{closureReadyCount}/{closureRequirements.length}</strong>
              <p>
                {operacao.fechamentoDia
                  ? `Fechado por ${operacao.fechamentoDia.owner} em ${operacao.fechamentoDia.closedAt}.`
                  : closureReadyCount === closureRequirements.length
                    ? 'A frente está pronta para fechar o dia com rastreabilidade.'
                    : 'Ainda existem pendências antes de registrar o fechamento do dia.'}
              </p>
            </div>
            <div className='central-day-closure-list'>
              {closureRequirements.map((item) => (
                <div key={item.label} className={`central-day-closure-item ${item.ok ? 'ok' : 'pending'}`}>
                  <strong>{item.ok ? 'OK' : 'Pendente'}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className='operation-note-form'>
            <textarea
              className='operation-textarea'
              value={operacao.fechamentoResumo}
              onChange={(event) => operacao.onDraftChange('fechamentoResumo', event.target.value)}
              placeholder='Resuma o que foi entregue hoje, o que ficou pendente e qual recado a próxima equipe precisa receber...'
            />
            {operacao.fechamentoDia ? (
              <button type='button' className='portfolio-card-button' onClick={operacao.onReopenDay}>Reabrir fechamento</button>
            ) : (
              <button type='button' className='portfolio-card-button' onClick={operacao.onCloseDay}>Registrar fechamento do dia</button>
            )}
          </div>
        </div>

        <div className='surface-card animate-in stagger-3'>
          <div className='card-title'>Rastro de responsabilidade</div>
          <div className='card-helper-text'>Esta área ajuda a equipe a entender quem assumiu o quê e qual foi o último fechamento formal da frente.</div>
          <div className='workflow-ritual-grid'>
            <div className='workflow-ritual-card'>
              <span>Dono da prioridade atual</span>
              <strong>{leadDecision ? leadDecision.responsavel : (operacao.tarefasDia[0]?.responsavel || 'Equipe da obra')}</strong>
            </div>
            <div className='workflow-ritual-card'>
              <span>Último fechamento</span>
              <strong>{operacao.fechamentoDia ? operacao.fechamentoDia.closedAt : 'Ainda não fechado'}</strong>
            </div>
            <div className='workflow-ritual-card'>
              <span>Responsável pelo fechamento</span>
              <strong>{operacao.fechamentoDia ? operacao.fechamentoDia.owner : 'A definir'}</strong>
            </div>
          </div>
          <div className='collapsed-summary' style={{ marginTop: 16 }}>
            {operacao.fechamentoDia?.summary || 'Assim que o fechamento do dia for registrado, o resumo operacional aparece aqui como memória oficial da frente.'}
          </div>
        </div>
      </div>

      {operacao.acordoEquipe ? (
        <>
          <div className='section-card animate-in stagger-2'>
            <div className='portfolio-eyebrow'>Operacao formalizada da equipe</div>
            <div className='section-card-title'>{operacao.acordoEquipe.titulo}</div>
            <div className='section-card-description'>{operacao.acordoEquipe.resumo}</div>
          </div>

          <div className='agreement-grid'>
            <div className='surface-card animate-in'>
              <div className='card-title'>Jornada e chamada</div>
              <div className='agreement-highlight'>
                <span>Chamada da diaria</span>
                <strong>{operacao.acordoEquipe.chamada}</strong>
              </div>
              {operacao.acordoEquipe.encerramento.map((item) => (
                <div key={item.dia} className='operation-row'>
                  <div className='operation-title'>{item.dia}</div>
                  <div className='operation-side'><strong>{item.horario}</strong></div>
                </div>
              ))}
            </div>

            <div className='surface-card animate-in stagger-2'>
              <div className='card-title'>Valores das diarias</div>
              {operacao.acordoEquipe.diarias.map((item) => (
                <div key={item.funcao} className='operation-row'>
                  <div className='operation-title'>{item.funcao}</div>
                  <div className='operation-side'><strong>{item.valor}</strong></div>
                </div>
              ))}
            </div>

            <div className='surface-card animate-in stagger-3'>
              <div className='card-title'>Contratacao e pagamento</div>
              {operacao.acordoEquipe.contratacao.concat(operacao.acordoEquipe.pagamento).map((item) => (
                <div key={item} className='operation-row'><div className='operation-copy'>{item}</div></div>
              ))}
            </div>
          </div>

          <div className='agreement-grid'>
            <div className='surface-card animate-in'>
              <div className='card-title'>Produtividade, faltas e incentivos</div>
              <div className='agreement-list-block'>
                <span className='agreement-list-label'>Meta e consequencias</span>
                {operacao.acordoEquipe.produtividade.map((item) => <div key={item} className='agreement-list-item'>{item}</div>)}
              </div>
              <div className='agreement-list-block'>
                <span className='agreement-list-label'>Incentivos</span>
                {operacao.acordoEquipe.incentivos.map((item) => <div key={item} className='agreement-list-item'>{item}</div>)}
              </div>
              <div className='agreement-list-block'>
                <span className='agreement-list-label'>Faltas e atrasos</span>
                {operacao.acordoEquipe.faltas.map((item) => <div key={item} className='agreement-list-item'>{item}</div>)}
              </div>
            </div>

            <div className='surface-card animate-in stagger-2'>
              <div className='card-title'>Regras essenciais da equipe</div>
              <div className='agreement-rules-grid'>
                {operacao.acordoEquipe.regras.map((item) => (
                  <div key={item} className='agreement-rule-card'>
                    <div className='agreement-rule-bullet' />
                    <div className='operation-copy'>{item}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
