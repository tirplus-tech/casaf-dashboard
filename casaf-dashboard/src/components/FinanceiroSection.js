import React from 'react';
import DecisionBoard from './DecisionBoard';

function getStatusStyles(status) {
  if (status === 'Pago') {
    return { background: '#dcfce7', color: '#16a34a' };
  }

  if (status === 'Pronto para pagar' || status === 'Liberado') {
    return { background: '#dbeafe', color: '#2563eb' };
  }

  if (status === 'Conferido' || status === 'Em conferencia') {
    return { background: '#e0f2fe', color: '#0369a1' };
  }

  return { background: '#fef3c7', color: '#d97706' };
}

function getPriorityTone(item) {
  if (item.nfStatus !== 'Emitida' || item.cobrancaStatus === 'Alta') {
    return 'critical';
  }

  if ((item.faltas || 0) > 0 || item.cobrancaStatus === 'Media') {
    return 'warning';
  }

  return 'stable';
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function getRowTotal(item, mealCost) {
  const productiveDays = Math.max((item.diasApurados || 0) - (item.faltas || 0), 0);
  return (productiveDays * (item.diaria || 0)) + ((item.marmitas || 0) * mealCost);
}

function getMaxValue(items) {
  return Math.max(...items.map((item) => item.value), 1);
}

function buildBlockerCopy(item) {
  const reasons = [];

  if (item.nfStatus !== 'Emitida') {
    reasons.push('NF pendente');
  }

  if ((item.faltas || 0) > 0) {
    reasons.push(`${item.faltas} falta(s)`);
  }

  if (item.cobrancaStatus === 'Alta') {
    reasons.push('cobranca alta');
  }

  if (item.motivoCobranca) {
    reasons.push(item.motivoCobranca);
  }

  return reasons.length > 0 ? reasons.join(' • ') : 'Fluxo financeiro sem travas relevantes.';
}

export default function FinanceiroSection({
  resumo,
  lancamentos,
  financeiroOperacional,
  onUpdateFinanceRow,
  onAdvanceFinanceStatus,
  decisions = [],
  productPersona = 'executive',
  onAdvanceDecision,
  onAddDecisionAlignment,
  onOpenSection,
}) {
  const colaboradores = (financeiroOperacional?.colaboradores || []).map((item) => ({
    fechamentoStatus: item.fechamentoStatus || (item.pagamentoStatus === 'Pago' ? 'Pago' : item.pagamentoStatus === 'Liberado' ? 'Pronto para pagar' : item.pagamentoStatus === 'Em conferencia' ? 'Conferido' : 'Em apuracao'),
    motivoCobranca: item.motivoCobranca || '',
    observacaoFinanceira: item.observacaoFinanceira || '',
    ...item,
  }));

  const mealCost = financeiroOperacional?.valorMarmitaUnitario || 18;
  const totalProjected = colaboradores.reduce((acc, item) => acc + getRowTotal(item, mealCost), 0);
  const pendingInvoices = colaboradores.filter((item) => item.nfStatus !== 'Emitida').length;
  const highPressure = colaboradores.filter((item) => item.cobrancaStatus === 'Alta').length;
  const totalMeals = colaboradores.reduce((acc, item) => acc + (item.marmitas || 0), 0);
  const readyToPay = colaboradores.filter((item) => item.fechamentoStatus === 'Pronto para pagar').length;
  const paidCount = colaboradores.filter((item) => item.fechamentoStatus === 'Pago').length;
  const openIssues = colaboradores.filter((item) => item.nfStatus !== 'Emitida' || item.cobrancaStatus !== 'Baixa' || (item.faltas || 0) > 0);

  const statusBreakdown = [
    { label: 'Em apuracao', value: colaboradores.filter((item) => item.fechamentoStatus === 'Em apuracao').length, color: '#94a3b8' },
    { label: 'Conferido', value: colaboradores.filter((item) => item.fechamentoStatus === 'Conferido').length, color: '#0369a1' },
    { label: 'Pronto p/ pagar', value: readyToPay, color: '#2563eb' },
    { label: 'Pago', value: paidCount, color: '#16a34a' },
  ];

  const pressureBreakdown = [
    { label: 'Alta pressao', value: highPressure, color: '#dc2626' },
    { label: 'Media pressao', value: colaboradores.filter((item) => item.cobrancaStatus === 'Media').length, color: '#d97706' },
    { label: 'Estavel', value: colaboradores.filter((item) => item.cobrancaStatus === 'Baixa').length, color: '#16a34a' },
  ];

  const blockerBreakdown = [
    { label: 'NF pendente', value: pendingInvoices, color: '#d97706' },
    { label: 'Com faltas', value: colaboradores.filter((item) => (item.faltas || 0) > 0).length, color: '#dc2626' },
    { label: 'Liberados', value: readyToPay + paidCount, color: '#2563eb' },
  ];
  const topIssue = openIssues[0];
  const personaFocus = {
    executive: 'Veja aqui quem segura fechamento, qual ruído pode virar cobrança e o que libera caixa mais rápido.',
    engineering: 'Financeiro importa aqui para a engenharia quando trava medição, fornecedor ou continuidade da frente.',
    finance: 'Comece por quem gera mais pressão e saia com uma resposta clara para cobrança e pagamento.',
    field: 'Essa leitura ajuda o campo a entender por que uma frente trava por documento, falta ou medição.',
  };
  const financePriorities = [
    { label: 'Caso mais crítico', value: topIssue ? topIssue.nome : 'Fechamento estável', copy: topIssue ? buildBlockerCopy(topIssue) : 'A rodada atual está sem travas relevantes acima da média.' },
    { label: 'Valor que pede atenção', value: formatCurrency(totalProjected), copy: 'Montante previsto desta rodada com impacto direto em caixa e previsão de fechamento.' },
    { label: 'Leitura por perfil', value: productPersona === 'executive' ? 'Diretoria' : productPersona === 'engineering' ? 'Engenharia' : productPersona === 'finance' ? 'Financeiro' : 'Campo', copy: personaFocus[productPersona] || personaFocus.executive },
  ];
  const financeRitual = [
    `Comece por ${openIssues.length > 0 ? `${openIssues[0].nome} e a maior trava atual` : 'quem estiver em apuração e sem NF emitida'}.`,
    'Conclua a leitura de diária, faltas, marmitas e status antes de liberar pagamento.',
    'Use o painel para sair com um fechamento claro e uma resposta pronta para cobrança.',
  ];

  return (
    <>
      <div className='priority-strip'>
        {financePriorities.map((item, index) => (
          <div key={item.label} className={`surface-card animate-in priority-card ${index === 0 ? 'priority-card-primary' : ''}`}>
            <div className='priority-card-label'>{item.label}</div>
            <strong>{item.value}</strong>
            <p>{item.copy}</p>
          </div>
        ))}
      </div>

      <DecisionBoard
        title='Decisões financeiras'
        helper='Concentre nesta fila o que ainda segura pagamento, resposta para cobrança e previsibilidade financeira da obra.'
        decisions={decisions}
        onAdvance={onAdvanceDecision}
        onAddAlignment={onAddDecisionAlignment}
        onOpenSection={onOpenSection}
        productPersona={productPersona}
      />

      <div className='finance-summary'>
        {resumo.map((item) => (
          <div key={item.label} className='surface-card metric-card animate-in'>
            <div className='metric-label'>{item.label}</div>
            <div className='metric-value'>{item.valor}</div>
            <div className='metric-sub' style={{ color: item.cor }}>{item.sub}</div>
          </div>
        ))}
      </div>

      <div className='section-mini-chart-grid'>
        <div className='surface-card animate-in section-mini-chart-card'>
          <div className='card-title'>Fechamento quinzenal</div>
          <div className='card-helper-text'>{financeiroOperacional?.fechamentoLabel || 'Controle de equipe e apuração financeira.'}</div>
          <div className='finance-highlight-stack'>
            <div className='finance-highlight-item'>
              <span>Valor previsto desta rodada</span>
              <strong>{formatCurrency(totalProjected)}</strong>
            </div>
            <div className='finance-highlight-item'>
              <span>Pagamento previsto</span>
              <strong>{financeiroOperacional?.pagamentoPrevisto || 'A definir'}</strong>
            </div>
            <div className='finance-highlight-item'>
              <span>Custo de marmita</span>
              <strong>{formatCurrency(mealCost)}</strong>
            </div>
          </div>
        </div>

        <div className='surface-card animate-in section-mini-chart-card stagger-2'>
          <div className='card-title'>Maturidade do fechamento</div>
          <div className='card-helper-text'>Mostra quem ainda está em apuração e quem já pode seguir para pagamento.</div>
          <div className='mini-chart-list'>
            {statusBreakdown.map((item) => (
              <div key={item.label} className='mini-chart-row'>
                <div className='mini-chart-meta'>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
                <div className='mini-chart-track'>
                  <div className='mini-chart-fill' style={{ width: `${(item.value / getMaxValue(statusBreakdown)) * 100}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className='surface-card animate-in section-mini-chart-card stagger-3'>
          <div className='card-title'>Travas do setor financeiro</div>
          <div className='card-helper-text'>Ajuda a enxergar rapidamente o que ainda gera cobrança e ligação para o time.</div>
          <div className='mini-chart-list'>
            {blockerBreakdown.map((item) => (
              <div key={item.label} className='mini-chart-row'>
                <div className='mini-chart-meta'>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
                <div className='mini-chart-track'>
                  <div className='mini-chart-fill' style={{ width: `${(item.value / getMaxValue(blockerBreakdown)) * 100}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className='finance-summary'>
        <div className='surface-card metric-card animate-in'>
          <div className='metric-label'>NF pendentes</div>
          <div className='metric-value'>{pendingInvoices}</div>
          <div className='metric-sub' style={{ color: '#d97706' }}>Quem ainda não entregou NF para o fechamento</div>
        </div>
        <div className='surface-card metric-card animate-in'>
          <div className='metric-label'>Cobrancas ativas</div>
          <div className='metric-value'>{highPressure}</div>
          <div className='metric-sub' style={{ color: '#dc2626' }}>Casos que mais tendem a gerar ligação e ruído</div>
        </div>
        <div className='surface-card metric-card animate-in'>
          <div className='metric-label'>Prontos para pagar</div>
          <div className='metric-value'>{readyToPay}</div>
          <div className='metric-sub' style={{ color: '#2563eb' }}>Profissionais liberados para a próxima rodada</div>
        </div>
        <div className='surface-card metric-card animate-in'>
          <div className='metric-label'>Marmitas lançadas</div>
          <div className='metric-value'>{totalMeals}</div>
          <div className='metric-sub' style={{ color: '#2563eb' }}>Conferência da quinzena em andamento</div>
        </div>
      </div>

      <div className='content-grid'>
        <div className='surface-card animate-in'>
          <div className='card-title'>Fila de fechamento e cobrança</div>
          <div className='card-helper-text'>Ordene o dia do financeiro por quem está travando pagamento, gerando dúvida ou pressionando a equipe administrativa.</div>
          {openIssues.length > 0 ? openIssues.map((item) => (
            <div key={`${item.nome}-issue`} className='operation-row'>
              <div>
                <div className='operation-title'>{item.nome}</div>
                <div className='operation-copy'>{buildBlockerCopy(item)}</div>
              </div>
              <div className='operation-side'>
                <span className={`portfolio-chip ${item.cobrancaStatus === 'Alta' ? 'critical' : ''}`}>{item.cobrancaStatus}</span>
                <strong>{item.fechamentoStatus}</strong>
              </div>
            </div>
          )) : <div className='collapsed-summary'>Sem travas críticas nesta rodada. O fechamento está fluindo de forma estável.</div>}
        </div>

        <div className='surface-card animate-in stagger-2 section-mini-chart-card'>
          <div className='card-title'>Pressão de cobrança</div>
          <div className='card-helper-text'>Leitura rápida para saber se o financeiro está em zona de pressão alta ou estável.</div>
          <div className='mini-chart-list'>
            {pressureBreakdown.map((item) => (
              <div key={item.label} className='mini-chart-row'>
                <div className='mini-chart-meta'>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
                <div className='mini-chart-track'>
                  <div className='mini-chart-fill' style={{ width: `${(item.value / getMaxValue(pressureBreakdown)) * 100}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className='surface-card animate-in stagger-2'>
        <div className='card-title'>Rito do fechamento financeiro</div>
        <div className='card-helper-text'>Essa camada posiciona o produto como sistema de fechamento, não só como lista de lançamentos. O objetivo é reduzir ruído, cobrança e retrabalho.</div>
        <div className='workflow-ritual-grid'>
          {financeRitual.map((item, index) => (
            <div key={item} className='workflow-ritual-card'>
              <span>{index + 1}. Etapa</span>
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className='surface-card animate-in stagger-2'>
        <div className='card-title'>Central de fechamento quinzenal</div>
        <div className='card-helper-text'>A leitura é linha por linha: diária, dias, faltas, marmitas, NF, status do fechamento e observação financeira. Isso cria transparência para responder cobrança sem depender de memória ou planilha paralela.</div>
        {colaboradores.map((item, index) => {
          const total = getRowTotal(item, mealCost);
          const statusStyles = getStatusStyles(item.fechamentoStatus);
          const priorityTone = getPriorityTone(item);

          return (
            <div key={`${item.nome}-${item.funcao}`} className='finance-ops-row'>
              <div className='finance-ops-main'>
                <div className='operation-title'>{item.nome}</div>
                <div className='operation-copy'>{item.funcao}</div>
                <div className='card-helper-text'>{buildBlockerCopy(item)}</div>
                <span className={`portfolio-chip ${priorityTone === 'critical' ? 'critical' : ''}`}>{priorityTone === 'critical' ? 'Exige atenção' : priorityTone === 'warning' ? 'Acompanhar' : 'Estável'}</span>
              </div>

              <div className='finance-ops-grid'>
                <label>
                  <span>Diária</span>
                  <input type='number' className='operation-input' value={item.diaria} onChange={(event) => onUpdateFinanceRow(index, 'diaria', event.target.value)} />
                </label>
                <label>
                  <span>Dias</span>
                  <input type='number' className='operation-input' value={item.diasApurados} onChange={(event) => onUpdateFinanceRow(index, 'diasApurados', event.target.value)} />
                </label>
                <label>
                  <span>Faltas</span>
                  <input type='number' className='operation-input' value={item.faltas} onChange={(event) => onUpdateFinanceRow(index, 'faltas', event.target.value)} />
                </label>
                <label>
                  <span>Marmitas</span>
                  <input type='number' className='operation-input' value={item.marmitas} onChange={(event) => onUpdateFinanceRow(index, 'marmitas', event.target.value)} />
                </label>
                <label>
                  <span>NF</span>
                  <select className='operation-select' value={item.nfStatus} onChange={(event) => onUpdateFinanceRow(index, 'nfStatus', event.target.value)}>
                    <option>Pendente</option>
                    <option>Emitida</option>
                  </select>
                </label>
                <label>
                  <span>Fechamento</span>
                  <select className='operation-select' value={item.fechamentoStatus} onChange={(event) => onUpdateFinanceRow(index, 'fechamentoStatus', event.target.value)}>
                    <option>Em apuracao</option>
                    <option>Conferido</option>
                    <option>Pronto para pagar</option>
                    <option>Pago</option>
                  </select>
                </label>
                <label>
                  <span>Cobranca</span>
                  <select className='operation-select' value={item.cobrancaStatus} onChange={(event) => onUpdateFinanceRow(index, 'cobrancaStatus', event.target.value)}>
                    <option>Alta</option>
                    <option>Media</option>
                    <option>Baixa</option>
                  </select>
                </label>
                <div className='finance-ops-total'>
                  <span>Previsto</span>
                  <strong>{formatCurrency(total)}</strong>
                </div>
                <label className='finance-full-span'>
                  <span>Motivo da cobrança</span>
                  <input type='text' className='operation-input' value={item.motivoCobranca} onChange={(event) => onUpdateFinanceRow(index, 'motivoCobranca', event.target.value)} placeholder='Ex.: aguardando NF, divergência de falta, conferência de marmita...' />
                </label>
                <label className='finance-full-span'>
                  <span>Observação financeira</span>
                  <input type='text' className='operation-input' value={item.observacaoFinanceira} onChange={(event) => onUpdateFinanceRow(index, 'observacaoFinanceira', event.target.value)} placeholder='Ex.: alinhado com empreiteiro, pagamento previsto, ajuste pendente...' />
                </label>
                <div className='finance-full-span finance-ops-footer'>
                  <span className='mini-badge' style={{ background: statusStyles.background, color: statusStyles.color, padding: '6px 10px', fontSize: 11 }}>{item.fechamentoStatus}</span>
                  <button type='button' className='inline-action-button' onClick={() => onAdvanceFinanceStatus(index)}>Avançar fechamento</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className='surface-card animate-in stagger-3'>
        <div className='card-title'>Medições e lançamentos</div>
        <div className='card-helper-text'>Mantém o elo entre o fluxo operacional do fechamento e a leitura macro de medições da obra.</div>
        {lancamentos.map((item, index) => {
          const statusLabel = item.status === 'Em análise' ? 'Em analise' : item.status;
          const statusStyles = getStatusStyles(statusLabel);

          return (
            <div key={`${item.etapa}-${item.data}`} className='finance-row' style={{ display: 'grid', gridTemplateColumns: '1.8fr 0.8fr 0.8fr 0.8fr', gap: 12, alignItems: 'center', padding: '14px 0', borderBottom: index < lancamentos.length - 1 ? '0.5px solid #f1f5f9' : 'none', borderRadius: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{item.etapa}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Atualização financeira da etapa</div>
              </div>
              <div style={{ fontSize: 12, color: '#0f172a', fontWeight: 600 }}>{item.valor}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{item.data}</div>
              <div>
                <span className='mini-badge' style={{ fontSize: 11, padding: '6px 10px', background: statusStyles.background, color: statusStyles.color }}>{item.status}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
