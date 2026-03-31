import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './App.css';
import DocumentosCard from './components/DocumentosCard';
import EtapasCard from './components/EtapasCard';
import FinanceiroSection from './components/FinanceiroSection';
import FotosSection from './components/FotosSection';
import MetricsGrid from './components/MetricsGrid';
import ObraTabs from './components/ObraTabs';
import OperationSection from './components/OperationSection';
import PlanningSection from './components/PlanningSection';
import PortfolioOverview from './components/PortfolioOverview';
import ProgressoCard from './components/ProgressoCard';
import SectionIntroCard from './components/SectionIntroCard';
import Sidebar from './components/Sidebar';
import IntroScreen from './components/IntroScreen';
import LoginScreen from './components/LoginScreen';
import { hasSupabaseConfig, supabase } from './lib/supabase';
import Topbar from './components/Topbar';
import CentralDayPanel from './components/CentralDayPanel';
import HistorySection from './components/HistorySection';
import AssistenteSection from './components/AssistenteSection';
import PortfolioAssistantSection from './components/PortfolioAssistantSection';
import { getPortfolioSnapshot } from './services/obraAssistant';
import { useAuthFlow } from './hooks/useAuthFlow';
import { useDashboardState } from './hooks/useDashboardState';
import { useAccountProfile } from './hooks/useAccountProfile';
import AccountPanel from './components/AccountPanel';
import MobileQuickBar from './components/MobileQuickBar';
import DecisionBoard from './components/DecisionBoard';

import {
  uploadObraPhotoAsset,
} from './services/dashboardStore';
import {
  menuItems,
  obras as initialObras,
} from './data/dashboardData';

const nowLabelFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function getNowLabel(date = new Date()) {
  return nowLabelFormatter.format(date).replace('.', '');
}

function createTimelineEvent(type, origem, titulo, descricao, autor = 'Sistema') {
  return {
    type,
    origem,
    titulo,
    descricao,
    autor,
  };
}

function getPendenciaStatusOrder() {
  return ['aguardando', 'em_tratativa', 'aguardando_retorno', 'critico', 'resolvido'];
}

function getTaskStatusOrder() {
  return ['planejado', 'campo', 'aguardando_retorno', 'prioridade', 'done'];
}

function addTimelineEvent(obra, event) {
  const nowLabel = getNowLabel();

  return {
    ...obra,
    ultimaAtualizacao: nowLabel,
    timeline: [
      {
        data: nowLabel,
        ...event,
      },
      ...obra.timeline,
    ].slice(0, 12),
  };
}

function scrollContainersToTop(contentElement) {
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  if (typeof document !== 'undefined') {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  if (contentElement && typeof contentElement.scrollTo === 'function') {
    contentElement.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    return;
  }

  if (contentElement) {
    contentElement.scrollTop = 0;
  }
}

export function resolveObraIndex(obras, indexOrId) {
  const matchingIdIndex = obras.findIndex((obra) => obra.id === indexOrId);

  if (matchingIdIndex >= 0) {
    return matchingIdIndex;
  }

  return typeof indexOrId === 'number' && indexOrId >= 0 && indexOrId < obras.length
    ? indexOrId
    : -1;
}

export function resolveDecisionIndex(decisions, indexOrId) {
  const matchingIdIndex = (decisions || []).findIndex((item) => item.id === indexOrId);

  if (matchingIdIndex >= 0) {
    return matchingIdIndex;
  }

  return typeof indexOrId === 'number' && indexOrId >= 0 && indexOrId < (decisions || []).length
    ? indexOrId
    : -1;
}

export default function App() {
  const [obraAtiva, setObraAtiva] = useState(null);
  const [navAtiva, setNavAtiva] = useState('visao');
  const [productPersona, setProductPersona] = useState('executive');
  const [portfolioFocus, setPortfolioFocus] = useState('hero');
  const [portfolioAssistantInitialQuestion, setPortfolioAssistantInitialQuestion] = useState('');
  const [toast, setToast] = useState(null);
  const [accountOpen, setAccountOpen] = useState(false);

  const toastTimeoutRef = useRef(null);
  const contentScrollRef = useRef(null);
  const { phase, authMode, authChecked, setPhase, completeLogin, logout, user } = useAuthFlow({ hasSupabaseConfig, supabase });
  const handleSyncError = useCallback(() => {
    showToast('error', 'Nao foi possivel sincronizar as alteracoes agora.');
  }, []);
  const { obras, setObras, syncStatus } = useDashboardState({
    initialObras,
    onSyncError: handleSyncError,
  });
  const account = useAccountProfile({
    user,
    hasSupabaseConfig,
    supabase,
    onSaved: () => showToast('success', 'Perfil atualizado com sucesso.'),
    onError: () => showToast('error', 'Nao foi possivel atualizar o perfil agora.'),
  });
  const portfolioSnapshot = getPortfolioSnapshot(obras);
  const actorLabel = account.displayName || account.profile?.fullName || 'Equipe CASAF';

  const obraAtual = obraAtiva === null ? null : obras[obraAtiva];
  const activeMenuItem = [
    ...menuItems,
    { id: 'assistente_portfolio', label: 'IA Assistente Especialista' },
  ].find((item) => item.id === navAtiva);
  const obraPrioritaria = portfolioSnapshot.obraPrioritaria;
  const totalPendencias = portfolioSnapshot.totalPendencias;
  const nextVisit = portfolioSnapshot.nextVisit;

  useEffect(() => () => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
  }, []);

  useLayoutEffect(() => {
    if (typeof window !== 'undefined' && window.history?.scrollRestoration) {
      window.history.scrollRestoration = 'manual';
    }

    scrollContainersToTop(contentScrollRef.current);

    const frameId = window.requestAnimationFrame(() => {
      scrollContainersToTop(contentScrollRef.current);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'dashboard') {
      return;
    }

    scrollContainersToTop(contentScrollRef.current);
  }, [phase, obraAtiva, navAtiva]);

  async function handleAccountPhotoChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      account.setField('photo', String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  }

  async function handleLogout() {
    setAccountOpen(false);
    setObraAtiva(null);
    setNavAtiva('visao');
    setPortfolioFocus('hero');
    await logout();
  }

  function showToast(type, message) {
    setToast({ type, message, id: Date.now() });

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 2600);
  }

  function handleSelectObra(indexOrId) {
    if (indexOrId === null) {
      setObraAtiva(null);
      setNavAtiva('visao');
      setPortfolioFocus('hero');
      return;
    }

    const index = resolveObraIndex(obras, indexOrId);

    if (index >= 0) {
      setObraAtiva(index);
      setNavAtiva('visao');
    }
  }

  function handlePortfolioAction(action) {
    if (action === 'prioritaria' && obraPrioritaria) {
      handleSelectObra(obraPrioritaria.id);
      return;
    }

    setPortfolioFocus(action);
  }

  function openPortfolioAssistant(question = '') {
    setObraAtiva(null);
    setNavAtiva('assistente_portfolio');
    setPortfolioAssistantInitialQuestion(String(question || '').trim());
  }

  function updateObraAtual(updater) {
    if (obraAtiva === null) {
      return;
    }

    setObras((current) => current.map((obra, index) => {
      if (index !== obraAtiva) {
        return obra;
      }

      return updater(obra);
    }));
  }

  function cycleChecklistStatus(index) {
    const currentItem = obraAtual?.operacao?.checklist?.[index];
    const order = ['pending', 'active', 'done'];
    updateObraAtual((obra) => {
      let changedItem = null;
      const checklist = obra.operacao.checklist.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const next = order[(order.indexOf(item.status) + 1) % order.length];
        changedItem = { ...item, status: next };
        return changedItem;
      });

      return {
        ...addTimelineEvent(obra, createTimelineEvent('checklist', 'Operação', 'Checklist atualizado', `${changedItem.item} agora está em ${changedItem.status}.`, actorLabel)),
        operacao: { ...obra.operacao, checklist },
      };
    });

    if (currentItem) {
      showToast('success', `Checklist atualizado: ${currentItem.item}.`);
    }
  }

  function cycleTaskStatus(index) {
    const currentItem = obraAtual?.operacao?.tarefasDia?.[index];
    const order = getTaskStatusOrder();
    updateObraAtual((obra) => {
      let changedItem = null;
      const tarefasDia = obra.operacao.tarefasDia.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const next = order[(order.indexOf(item.status) + 1) % order.length];
        changedItem = {
          ...item,
          status: next,
          ultimaMovimentacao: `${next} em ${getNowLabel()}`,
        };
        return changedItem;
      });

      return {
        ...addTimelineEvent(obra, createTimelineEvent('tarefa', 'Operação', `Tarefa atualizada: ${changedItem.titulo}`, `Status movido para ${changedItem.status}.`, actorLabel)),
        operacao: { ...obra.operacao, tarefasDia },
      };
    });

    if (currentItem) {
      showToast('success', `Tarefa atualizada: ${currentItem.titulo}.`);
    }
  }

  function addTaskAlignment(index, text) {
    const content = String(text || '').trim();

    if (!content) {
      return;
    }

    updateObraAtual((obra) => {
      let changedItem = null;
      const tarefasDia = obra.operacao.tarefasDia.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const nextAlignment = {
          author: actorLabel,
          text: content,
          date: getNowLabel(),
        };

        changedItem = {
          ...item,
          alinhamento: content,
          alinhamentos: [nextAlignment, ...(item.alinhamentos || [])].slice(0, 5),
          ultimaMovimentacao: `Alinhamento registrado em ${getNowLabel()}`,
        };

        return changedItem;
      });

      if (!changedItem) {
        return obra;
      }

      return {
        ...addTimelineEvent(
          obra,
          createTimelineEvent(
            'tarefa',
            'Operação',
            `Alinhamento registrado: ${changedItem.titulo}`,
            content,
            actorLabel,
          ),
        ),
        operacao: {
          ...obra.operacao,
          tarefasDia,
        },
      };
    });

    showToast('success', 'Alinhamento registrado na tarefa.');
  }

  function cyclePendencia(index) {
    const currentItem = obraAtual?.operacao?.pendencias?.[index];
    const order = getPendenciaStatusOrder();
    updateObraAtual((obra) => {
      let changedItem = null;
      const pendencias = obra.operacao.pendencias.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const next = order[(order.indexOf(item.status) + 1) % order.length];
        changedItem = { ...item, status: next };
        return changedItem;
      });

      const pendenciasAbertas = pendencias.filter((item) => item.status !== 'resolvido').length;

      return {
        ...addTimelineEvent(obra, createTimelineEvent('pendencia', 'Operação', `Pendência atualizada: ${changedItem.titulo}`, `Status movido para ${changedItem.status}.`, actorLabel)),
        pendenciasAbertas,
        operacao: { ...obra.operacao, pendencias },
      };
    });

    if (currentItem) {
      showToast('success', `Pendência atualizada: ${currentItem.titulo}.`);
    }
  }

  function addPendenciaAlignment(index, text) {
    const content = String(text || '').trim();

    if (!content) {
      return;
    }

    updateObraAtual((obra) => {
      let changedItem = null;
      const pendencias = obra.operacao.pendencias.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const nextAlignment = {
          author: actorLabel,
          text: content,
          date: getNowLabel(),
        };

        changedItem = {
          ...item,
          alinhamento: content,
          alinhamentos: [nextAlignment, ...(item.alinhamentos || [])].slice(0, 5),
        };

        return changedItem;
      });

      if (!changedItem) {
        return obra;
      }

      return {
        ...addTimelineEvent(
          obra,
          createTimelineEvent(
            'pendencia',
            'Operação',
            `Alinhamento registrado: ${changedItem.titulo}`,
            content,
            actorLabel,
          ),
        ),
        operacao: {
          ...obra.operacao,
          pendencias,
        },
      };
    });

    showToast('success', 'Alinhamento registrado na pendência.');
  }

  function updateAttendance(index, status) {
    updateObraAtual((obra) => {
      const presencaHoje = obra.operacao.presencaHoje.map((item, itemIndex) => (
        itemIndex === index ? { ...item, status } : item
      ));

      return { ...obra, operacao: { ...obra.operacao, presencaHoje } };
    });
  }

  function handleNoteChange(value) {
    updateObraAtual((obra) => ({
      ...obra,
      operacao: { ...obra.operacao, novoApontamento: value },
    }));
  }

  function addNote() {
    updateObraAtual((obra) => {
      const texto = (obra.operacao.novoApontamento || '').trim();

      if (!texto) {
        return obra;
      }

      showToast('success', 'Apontamento registrado com sucesso.');

      return {
        ...addTimelineEvent(obra, createTimelineEvent('apontamento', 'Campo', 'Apontamento registrado', texto, actorLabel)),
        operacao: {
          ...obra.operacao,
          novoApontamento: '',
          apontamentos: [
            {
              autor: actorLabel,
              texto,
              data: getNowLabel(),
            },
            ...obra.operacao.apontamentos,
          ],
        },
      };
    });
  }

  function updateOperationDraft(field, value) {
    updateObraAtual((obra) => ({
      ...obra,
      operacao: { ...obra.operacao, [field]: value },
    }));
  }

  function closeOperationalDay() {
    updateObraAtual((obra) => {
      const checklistDone = obra.operacao.checklist.filter((item) => item.status === 'done').length;
      const checklistTotal = obra.operacao.checklist.length;
      const criticalPendencias = obra.operacao.pendencias.filter((item) => item.status === 'critico');
      const latestNote = obra.operacao.apontamentos[0];
      const evidenceCount = obra.fotosObra.length;
      const summary = String(obra.operacao.fechamentoResumo || '').trim();
      const pendingReasons = [
        criticalPendencias.length > 0 ? 'Pendência crítica aberta' : null,
        checklistDone !== checklistTotal ? 'Checklist incompleto' : null,
        evidenceCount === 0 ? 'Sem evidência visual' : null,
        !latestNote ? 'Sem apontamento do dia' : null,
        !summary ? 'Sem resumo de fechamento' : null,
      ].filter(Boolean);

      if (pendingReasons.length > 0) {
        showToast('error', `Ainda não dá para fechar o dia: ${pendingReasons[0]}.`);
        return obra;
      }

      const closedAt = getNowLabel();

      showToast('success', 'Fechamento operacional registrado.');

      return {
        ...addTimelineEvent(
          obra,
          createTimelineEvent(
            'fechamento',
            'Fechamento diário',
            'Dia operacional encerrado',
            `Fechamento realizado por ${actorLabel}. Resumo: ${summary}`,
            actorLabel,
          ),
        ),
        operacao: {
          ...obra.operacao,
          fechamentoDia: {
            status: 'Fechado',
            owner: actorLabel,
            summary,
            closedAt,
            readinessScore: 4,
          },
          fechamentoResumo: '',
        },
      };
    });
  }

  function reopenOperationalDay() {
    updateObraAtual((obra) => {
      showToast('warning', 'Fechamento diário reaberto.');

      return {
        ...addTimelineEvent(
          obra,
          createTimelineEvent(
            'fechamento',
            'Fechamento diário',
            'Dia operacional reaberto',
            `O fechamento foi reaberto por ${actorLabel} para revisão complementar.`,
            actorLabel,
          ),
        ),
        operacao: {
          ...obra.operacao,
          fechamentoDia: null,
        },
      };
    });
  }

  function addTask() {
    updateObraAtual((obra) => {
      const titulo = (obra.operacao.novaTarefaTitulo || '').trim();
      const responsavel = (obra.operacao.novaTarefaResponsavel || '').trim() || 'Equipe da obra';
      const horario = (obra.operacao.novaTarefaHorario || '').trim() || 'A definir';
      const prazo = (obra.operacao.novaTarefaPrazo || '').trim() || horario;
      const alinhamento = (obra.operacao.novoAlinhamentoTarefa || '').trim() || `Tarefa aberta por ${actorLabel}.`;

      if (!titulo) {
        return obra;
      }

      showToast('success', `Tarefa criada: ${titulo}.`);

      return {
        ...addTimelineEvent(
          obra,
          createTimelineEvent(
            'tarefa',
            'Operação',
            `Tarefa criada: ${titulo}`,
            `${responsavel} • prazo ${prazo}.`,
            actorLabel,
          ),
        ),
        operacao: {
          ...obra.operacao,
          novaTarefaTitulo: '',
          novaTarefaResponsavel: '',
          novaTarefaHorario: '',
          novaTarefaPrazo: '',
          novoAlinhamentoTarefa: '',
          tarefasDia: [
            {
              titulo,
              responsavel,
              horario,
              prazo,
              alinhamento,
              ultimaMovimentacao: `Criada em ${getNowLabel()}`,
              status: 'planejado',
            },
            ...obra.operacao.tarefasDia,
          ],
        },
      };
    });
  }

  function addPendencia() {
    updateObraAtual((obra) => {
      const titulo = (obra.operacao.novaPendenciaTitulo || '').trim();
      const impacto = (obra.operacao.novaPendenciaImpacto || '').trim() || 'Impacto a detalhar';
      const dono = (obra.operacao.novaPendenciaDono || '').trim() || 'Gestão da obra';
      const prazo = (obra.operacao.novaPendenciaPrazo || '').trim() || 'A definir';
      const alinhamento = (obra.operacao.novoAlinhamentoPendencia || '').trim() || `Abertura registrada por ${actorLabel}.`;

      if (!titulo) {
        return obra;
      }

      showToast('success', `Tarefa criada: ${titulo}.`);

      return {
        ...addTimelineEvent(obra, createTimelineEvent('pendencia', 'Operação', `Pendência aberta: ${titulo}`, `${impacto} • dono ${dono} • prazo ${prazo}.`, actorLabel)),
        pendenciasAbertas: obra.pendenciasAbertas + 1,
        operacao: {
          ...obra.operacao,
          novaPendenciaTitulo: '',
          novaPendenciaImpacto: '',
          novaPendenciaDono: '',
          novaPendenciaPrazo: '',
          novoAlinhamentoPendencia: '',
          pendencias: [
            { titulo, impacto, dono, prazo, alinhamento, status: 'aguardando', tipo: 'geral' },
            ...obra.operacao.pendencias,
          ],
        },
      };
    });
  }

  function addChecklistItem() {
    updateObraAtual((obra) => {
      const item = (obra.operacao.novoChecklistItem || '').trim();

      if (!item) {
        return obra;
      }

      showToast('success', `Item adicionado ao checklist: ${item}.`);

      return {
        ...addTimelineEvent(obra, createTimelineEvent('checklist', 'Operação', 'Checklist adicionado', item, actorLabel)),
        operacao: {
          ...obra.operacao,
          novoChecklistItem: '',
          checklist: [
            { item, status: 'pending' },
            ...obra.operacao.checklist,
          ],
        },
      };
    });
  }

  function triggerQuickAction(actionId) {
    updateObraAtual((obra) => {
      const timestamp = getNowLabel();

      if (actionId === 'material') {
        showToast('success', 'Solicitacao de material criada.');
        return {
          ...addTimelineEvent(obra, createTimelineEvent('solicitacao', 'Central operacional', 'Solicitação de material aberta', 'O painel registrou urgência de insumo para a frente atual.', actorLabel)),
          pendenciasAbertas: obra.pendenciasAbertas + 1,
          operacao: {
            ...obra.operacao,
            pendencias: [
              {
                titulo: 'Solicitação emergencial de material',
                impacto: 'Risco de queda de produtividade na próxima frente',
                dono: 'Suprimentos',
                status: 'aguardando',
                tipo: 'material',
              },
              ...obra.operacao.pendencias,
            ],
            apontamentos: [
              {
                autor: 'Central operacional',
                texto: 'Solicitação de material aberta pelo painel para recompor estoque da frente ativa.',
                data: timestamp,
              },
              ...obra.operacao.apontamentos,
            ],
          },
        };
      }

      if (actionId === 'delay') {
        showToast('warning', 'Atraso operacional registrado no painel.');
        return {
          ...addTimelineEvent(obra, createTimelineEvent('solicitacao', 'Central operacional', 'Atraso operacional registrado', 'A obra foi sinalizada com desvio crítico para revisão imediata.', actorLabel)),
          pendenciasAbertas: obra.pendenciasAbertas + 1,
          operacao: {
            ...obra.operacao,
            pendencias: [
              {
                titulo: 'Desvio de prazo registrado',
                impacto: 'Replanejar sequência da frente para evitar atraso acumulado',
                dono: 'Engenharia',
                status: 'critico',
                tipo: 'prazo',
              },
              ...obra.operacao.pendencias,
            ],
            apontamentos: [
              {
                autor: 'Central operacional',
                texto: 'Painel marcou atraso operacional e sinalizou revisão imediata do plano do dia.',
                data: timestamp,
              },
              ...obra.operacao.apontamentos,
            ],
          },
        };
      }

      if (actionId === 'release') {
        showToast('success', 'Nova frente liberada para a equipe.');
        return {
          ...addTimelineEvent(obra, createTimelineEvent('solicitacao', 'Central operacional', 'Nova frente liberada', 'O sistema abriu uma frente prioritária para execução imediata.', actorLabel)),
          operacao: {
            ...obra.operacao,
            tarefasDia: [
              {
                titulo: 'Liberar nova frente de execução',
                responsavel: 'Engenharia',
                horario: 'Imediato',
                status: 'prioridade',
              },
              ...obra.operacao.tarefasDia,
            ],
            apontamentos: [
              {
                autor: 'Central operacional',
                texto: 'Nova frente registrada e empurrada para a operação do dia com prioridade máxima.',
                data: timestamp,
              },
              ...obra.operacao.apontamentos,
            ],
          },
        };
      }

      if (actionId === 'rework') {
        showToast('warning', 'Retrabalho aberto para a frente ativa.');
        return {
          ...addTimelineEvent(obra, createTimelineEvent('solicitacao', 'Central operacional', 'Retrabalho aberto', 'Foi registrada necessidade de correção antes da próxima liberação.', actorLabel)),
          pendenciasAbertas: obra.pendenciasAbertas + 1,
          operacao: {
            ...obra.operacao,
            pendencias: [
              {
                titulo: 'Retrabalho aberto na frente ativa',
                impacto: 'Corrigir execução antes da próxima medição',
                dono: 'Qualidade / Engenharia',
                status: 'critico',
                tipo: 'qualidade',
              },
              ...obra.operacao.pendencias,
            ],
            apontamentos: [
              {
                autor: 'Central operacional',
                texto: 'Retrabalho lançado pelo painel para proteger qualidade da entrega.',
                data: timestamp,
              },
              ...obra.operacao.apontamentos,
            ],
          },
        };
      }

      if (actionId === 'approval') {
        showToast('success', 'Solicitacao de aprovacao criada.');
        return {
          ...addTimelineEvent(obra, createTimelineEvent('solicitacao', 'Central operacional', 'Solicitação de aprovação aberta', 'O sistema sinalizou que a frente depende de aprovação externa para seguir.', actorLabel)),
          pendenciasAbertas: obra.pendenciasAbertas + 1,
          operacao: {
            ...obra.operacao,
            pendencias: [
              {
                titulo: 'Aprovação pendente para seguir a frente',
                impacto: 'Bloqueia avanço da próxima etapa até retorno do aprovador',
                dono: 'Cliente / Engenharia',
                status: 'aguardando',
                tipo: 'aprovacao',
              },
              ...obra.operacao.pendencias,
            ],
            apontamentos: [
              {
                autor: 'Central operacional',
                texto: 'Solicitação de aprovação registrada e enviada para acompanhamento.',
                data: timestamp,
              },
              ...obra.operacao.apontamentos,
            ],
          },
        };
      }

      return obra;
    });
  }

  function advanceCronograma(index) {
    updateObraAtual((obra) => {
      let changedItem = null;
      const cronograma = obra.planejamento.cronograma.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const nextPercent = Math.min(item.percentual + 20, 100);
        const nextStatus = nextPercent >= 100 ? 'Concluído' : 'Em andamento';
        changedItem = { ...item, percentual: nextPercent, status: nextStatus };
        return changedItem;
      });

      return {
        ...addTimelineEvent(obra, createTimelineEvent('planejamento', 'Planejamento', `Cronograma atualizado: ${changedItem.fase}`, `${changedItem.percentual}% concluído.`, actorLabel)),
        planejamento: { ...obra.planejamento, cronograma },
      };
    });
  }

  function advanceMte(index) {
    const order = ['Pendente', 'Em revisão', 'Aprovado'];
    updateObraAtual((obra) => {
      let changedItem = null;
      const mtes = obra.planejamento.mtes.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const next = order[(order.indexOf(item.status) + 1) % order.length];
        changedItem = { ...item, status: next };
        return changedItem;
      });

      return {
        ...addTimelineEvent(obra, createTimelineEvent('mte', 'Planejamento', `MTE atualizado: ${changedItem.codigo}`, `Status movido para ${changedItem.status}.`, actorLabel)),
        planejamento: { ...obra.planejamento, mtes },
      };
    });
  }

  function updatePlanningDraft(field, value) {
    updateObraAtual((obra) => ({
      ...obra,
      planejamento: { ...obra.planejamento, [field]: value },
    }));
  }

  function updateFinanceOperacional(index, field, value) {
    updateObraAtual((obra) => ({
      ...obra,
      financeiroOperacional: {
        ...obra.financeiroOperacional,
        colaboradores: obra.financeiroOperacional.colaboradores.map((item, itemIndex) => (
          itemIndex === index ? { ...item, [field]: ['diaria', 'diasApurados', 'faltas', 'marmitas'].includes(field) ? Number(value) || 0 : value } : item
        )),
      },
    }));
  }

  function advanceFinanceStatus(index) {
    const currentItem = obraAtual?.financeiroOperacional?.colaboradores?.[index];
    const order = ['Em apuracao', 'Conferido', 'Pronto para pagar', 'Pago'];

    updateObraAtual((obra) => {
      let changedItem = null;
      const colaboradores = obra.financeiroOperacional.colaboradores.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const nextStatus = order[(order.indexOf(item.fechamentoStatus || 'Em apuracao') + 1) % order.length];
        const pagamentoStatus = nextStatus === 'Pago'
          ? 'Pago'
          : nextStatus === 'Pronto para pagar'
            ? 'Liberado'
            : nextStatus === 'Conferido'
              ? 'Em conferencia'
              : 'Em apuracao';

        changedItem = {
          ...item,
          fechamentoStatus: nextStatus,
          pagamentoStatus,
        };
        return changedItem;
      });

      if (!changedItem) {
        return obra;
      }

      return {
        ...addTimelineEvent(
          obra,
          createTimelineEvent(
            'financeiro',
            'Financeiro',
            `Fechamento atualizado: ${changedItem.nome}`,
            `Status movido para ${changedItem.fechamentoStatus}.`,
            actorLabel,
          ),
        ),
        financeiroOperacional: {
          ...obra.financeiroOperacional,
          colaboradores,
        },
      };
    });

    if (currentItem) {
      showToast('success', `Fechamento atualizado: ${currentItem.nome}.`);
    }
  }

  function advanceDecision(indexOrId) {
    const resolvedIndex = resolveDecisionIndex(obraAtual?.decisoes || [], indexOrId);
    const currentItem = obraAtual?.decisoes?.[resolvedIndex];
    const order = ['A decidir', 'Em tratativa', 'Aguardando retorno', 'Concluída'];

    updateObraAtual((obra) => {
      let changedItem = null;
      const decisoes = (obra.decisoes || []).map((item, itemIndex) => {
        if (itemIndex !== resolvedIndex) {
          return item;
        }

        const normalizedStatus = item.status === 'Em andamento' ? 'Em tratativa' : item.status;
        const currentStatusIndex = order.indexOf(normalizedStatus);
        const nextStatus = order[(currentStatusIndex + 1) % order.length];
        changedItem = {
          ...item,
          status: nextStatus,
          ultimaMovimentacao: nextStatus === 'Concluída'
            ? `Concluída em ${getNowLabel()}`
            : `${nextStatus} em ${getNowLabel()}`,
        };
        return changedItem;
      });

      if (!changedItem) {
        return obra;
      }

      return {
        ...addTimelineEvent(
          obra,
          createTimelineEvent(
            'decisao',
            changedItem.area,
            `Decisão atualizada: ${changedItem.titulo}`,
            `${changedItem.status} • responsável ${changedItem.responsavel} • prazo ${changedItem.prazo}.`,
            actorLabel,
          ),
        ),
        decisoes,
      };
    });

    if (currentItem) {
      showToast('success', `Decisão atualizada: ${currentItem.titulo}.`);
    }
  }

  function addDecisionAlignment(indexOrId, text) {
    const resolvedIndex = resolveDecisionIndex(obraAtual?.decisoes || [], indexOrId);
    const content = String(text || '').trim();

    if (!content) {
      return;
    }

    updateObraAtual((obra) => {
      let changedItem = null;
      const decisoes = (obra.decisoes || []).map((item, itemIndex) => {
        if (itemIndex !== resolvedIndex) {
          return item;
        }

        changedItem = {
          ...item,
          alinhamento: content,
          ultimaMovimentacao: `Alinhamento registrado em ${getNowLabel()}`,
          alinhamentos: [
            {
              autor: actorLabel,
              texto: content,
              data: getNowLabel(),
            },
            ...(item.alinhamentos || []),
          ].slice(0, 5),
        };
        return changedItem;
      });

      if (!changedItem) {
        return obra;
      }

      return {
        ...addTimelineEvent(
          obra,
          createTimelineEvent(
            'decisao',
            changedItem.area,
            `Alinhamento registrado: ${changedItem.titulo}`,
            `${content} • responsável ${changedItem.responsavel} • prazo ${changedItem.prazo}.`,
            actorLabel,
          ),
        ),
        decisoes,
      };
    });

    showToast('success', 'Alinhamento da decisão registrado.');
  }

  function addCronogramaItem() {
    updateObraAtual((obra) => {
      const fase = (obra.planejamento.novaFaseNome || '').trim();
      const prazo = (obra.planejamento.novaFasePrazo || '').trim() || 'A definir';

      if (!fase) {
        return obra;
      }

      showToast('success', `Fase adicionada ao cronograma: ${fase}.`);

      return {
        ...addTimelineEvent(obra, createTimelineEvent('planejamento', 'Planejamento', `Fase criada: ${fase}`, `Novo marco incluído no cronograma com prazo ${prazo}.`, actorLabel)),
        planejamento: {
          ...obra.planejamento,
          novaFaseNome: '',
          novaFasePrazo: '',
          cronograma: [
            { fase, prazo, status: 'Planejado', percentual: 0 },
            ...obra.planejamento.cronograma,
          ],
        },
      };
    });
  }

  function addMteItem() {
    updateObraAtual((obra) => {
      const codigo = (obra.planejamento.novoMteCodigo || '').trim() || `MTE-${String(obra.planejamento.mtes.length + 1).padStart(3, '0')}`;
      const titulo = (obra.planejamento.novoMteTitulo || '').trim();
      const responsavel = (obra.planejamento.novoMteResponsavel || '').trim() || 'Engenharia';

      if (!titulo) {
        return obra;
      }

      showToast('success', `MTE criado: ${codigo}.`);

      return {
        ...addTimelineEvent(obra, createTimelineEvent('mte', 'Planejamento', `MTE criado: ${codigo}`, titulo, actorLabel)),
        planejamento: {
          ...obra.planejamento,
          novoMteCodigo: '',
          novoMteTitulo: '',
          novoMteResponsavel: '',
          mtes: [
            { codigo, titulo, responsavel, status: 'Pendente' },
            ...obra.planejamento.mtes,
          ],
        },
      };
    });
  }

  async function addPhoto({ title, tag, purpose, image, file }) {
    if (obraAtiva === null) {
      return;
    }

    const { imageUrl, storagePath } = await uploadObraPhotoAsset({
      obraId: obras[obraAtiva].id,
      file,
      previewDataUrl: image,
    });

    updateObraAtual((obra) => {
      const titulo = title.trim();
      const categoria = tag.trim();

      if (!titulo || !categoria || !imageUrl) {
        return obra;
      }

      showToast('success', `Foto enviada: ${titulo}.`);

      return {
        ...addTimelineEvent(obra, createTimelineEvent('foto', 'Galeria', `Novo registro fotográfico: ${titulo}`, `Imagem adicionada como ${purpose.toLowerCase()} na categoria ${categoria.toLowerCase()}.`, actorLabel)),
        fotosObra: [
          {
            id: Date.now(),
            titulo,
            tag: categoria,
            purpose,
            data: getNowLabel(),
            image: imageUrl,
            storagePath,
          },
          ...obra.fotosObra,
        ],
        arquivosRecentes: [
          {
            tipo: 'Foto',
            titulo,
            data: getNowLabel(),
          },
          ...obra.arquivosRecentes.slice(0, 5),
        ],
      };
    });
  }

  function renderConteudo() {
    if (!obraAtual) {
      if (navAtiva === 'assistente_portfolio') {
        return (
          <PortfolioAssistantSection
            obras={obras}
            onSelectObra={(obraId) => {
              handleSelectObra(obraId);
              setNavAtiva('assistente');
            }}
            initialQuestion={portfolioAssistantInitialQuestion}
          />
        );
      }

      return (
        <PortfolioOverview
          obras={obras}
          onSelect={handleSelectObra}
          onOpenAssistant={openPortfolioAssistant}
          onQuickAction={handlePortfolioAction}
          focusTarget={portfolioFocus}
          productPersona={productPersona}
        />
      );
    }

    if (navAtiva === 'etapas') {
      return (
        <>
          <SectionIntroCard
            titulo="Etapas da obra"
            descricao={`Acompanhe o andamento das etapas da ${obraAtual.nome.toLowerCase()}, com visão clara do que já foi entregue, do que está em execução e das próximas frentes previstas.`}
            image={obraAtual.heroImage}
            imageAlt={obraAtual.heroImageAlt}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
            <EtapasCard etapas={obraAtual.etapas} />
            <ProgressoCard progresso={obraAtual.progresso} />
          </div>
        </>
      );
    }

    if (navAtiva === 'operacao') {
      const operationDecisions = (obraAtual.decisoes || []).filter((item) => item.targetSection === 'operacao');
      const operacaoInterativa = {
        ...obraAtual.operacao,
        tarefasDia: obraAtual.operacao.tarefasDia.map((item, index) => ({
          ...item,
          onAdvance: () => cycleTaskStatus(index),
          onAddAlignment: (text) => addTaskAlignment(index, text),
        })),
        pendencias: obraAtual.operacao.pendencias.map((item, index) => ({
          ...item,
          onAdvance: () => cyclePendencia(index),
          onAddAlignment: (text) => addPendenciaAlignment(index, text),
        })),
        checklist: obraAtual.operacao.checklist.map((item, index) => ({
          ...item,
          onAdvance: () => cycleChecklistStatus(index),
        })),
        presencaHoje: obraAtual.operacao.presencaHoje.map((item, index) => ({
          ...item,
          onChange: (event) => updateAttendance(index, event.target.value),
        })),
        novoApontamento: obraAtual.operacao.novoApontamento || '',
        onNoteChange: (event) => handleNoteChange(event.target.value),
        onAddNote: addNote,
        novaTarefaTitulo: obraAtual.operacao.novaTarefaTitulo || '',
        novaTarefaResponsavel: obraAtual.operacao.novaTarefaResponsavel || '',
        novaTarefaHorario: obraAtual.operacao.novaTarefaHorario || '',
        novaTarefaPrazo: obraAtual.operacao.novaTarefaPrazo || '',
        novoAlinhamentoTarefa: obraAtual.operacao.novoAlinhamentoTarefa || '',
        novaPendenciaTitulo: obraAtual.operacao.novaPendenciaTitulo || '',
        novaPendenciaImpacto: obraAtual.operacao.novaPendenciaImpacto || '',
        novaPendenciaDono: obraAtual.operacao.novaPendenciaDono || '',
        novaPendenciaPrazo: obraAtual.operacao.novaPendenciaPrazo || '',
        novoAlinhamentoPendencia: obraAtual.operacao.novoAlinhamentoPendencia || '',
        novoChecklistItem: obraAtual.operacao.novoChecklistItem || '',
        fechamentoResumo: obraAtual.operacao.fechamentoResumo || '',
        fechamentoDia: obraAtual.operacao.fechamentoDia || null,
        onDraftChange: (field, value) => updateOperationDraft(field, value),
        onAddTask: addTask,
        onAddPendencia: addPendencia,
        onAddChecklist: addChecklistItem,
        onQuickAction: triggerQuickAction,
        onCloseDay: closeOperationalDay,
        onReopenDay: reopenOperationalDay,
        evidenciasRecentes: obraAtual.fotosObra.length,
      };

      return (
        <>
          <SectionIntroCard
            titulo="Operação da obra"
            descricao={`Centro tático da ${obraAtual.nome.toLowerCase()}, com tarefas do dia, pendências, checklist operacional e visão rápida da equipe em campo.`}
            image={obraAtual.heroImage}
            imageAlt={obraAtual.heroImageAlt}
          />
          <OperationSection
            operacao={operacaoInterativa}
            decisions={operationDecisions}
            productPersona={productPersona}
            onAdvanceDecision={advanceDecision}
            onAddDecisionAlignment={addDecisionAlignment}
            onOpenSection={setNavAtiva}
          />
        </>
      );
    }

    if (navAtiva === 'assistente') {
      return (
        <AssistenteSection obra={obraAtual} onOpenSection={setNavAtiva} />
      );
    }

    if (navAtiva === 'planejamento') {
      const planningDecisions = (obraAtual.decisoes || []).filter((item) => item.targetSection === 'planejamento');
      return (
        <>
          <SectionIntroCard
            titulo="Planejamento, cronograma e MTEs"
            descricao={`Camada técnica de gestão da ${obraAtual.nome.toLowerCase()}, com cronograma executivo, indicadores de liberação e acompanhamento dos MTEs.`}
            image={obraAtual.heroImage}
            imageAlt={obraAtual.heroImageAlt}
          />
          <PlanningSection
            planejamento={{
              ...obraAtual.planejamento,
              novaFaseNome: obraAtual.planejamento.novaFaseNome || '',
              novaFasePrazo: obraAtual.planejamento.novaFasePrazo || '',
              novoMteCodigo: obraAtual.planejamento.novoMteCodigo || '',
              novoMteTitulo: obraAtual.planejamento.novoMteTitulo || '',
              novoMteResponsavel: obraAtual.planejamento.novoMteResponsavel || '',
            }}
            onAdvanceCronograma={advanceCronograma}
            onAdvanceMte={advanceMte}
            onDraftChange={updatePlanningDraft}
            onAddCronograma={addCronogramaItem}
            onAddMte={addMteItem}
            decisions={planningDecisions}
            productPersona={productPersona}
            onAdvanceDecision={advanceDecision}
            onAddDecisionAlignment={addDecisionAlignment}
            onOpenSection={setNavAtiva}
          />
        </>
      );
    }

    if (navAtiva === 'financeiro') {
      const financeDecisions = (obraAtual.decisoes || []).filter((item) => item.targetSection === 'financeiro');
      return (
        <>
          <SectionIntroCard
            titulo="Financeiro da obra"
            descricao={`Resumo financeiro personalizado da ${obraAtual.nome.toLowerCase()}, com medições, valores executados e próximos marcos de liberação.`}
            image={obraAtual.heroImage}
            imageAlt={obraAtual.heroImageAlt}
          />
          <FinanceiroSection
            resumo={obraAtual.financeiroResumo}
            lancamentos={obraAtual.financeiroLancamentos}
            financeiroOperacional={obraAtual.financeiroOperacional}
            onUpdateFinanceRow={updateFinanceOperacional}
            onAdvanceFinanceStatus={advanceFinanceStatus}
            decisions={financeDecisions}
            productPersona={productPersona}
            onAdvanceDecision={advanceDecision}
            onAddDecisionAlignment={addDecisionAlignment}
            onOpenSection={setNavAtiva}
          />
        </>
      );
    }

    if (navAtiva === 'fotos') {
      return (
        <>
          <SectionIntroCard
            titulo="Fotos da obra"
            descricao={`Registros recentes da ${obraAtual.nome.toLowerCase()}, organizados para facilitar o acompanhamento visual da evolução da obra.`}
            image={obraAtual.heroImage}
            imageAlt={obraAtual.heroImageAlt}
          />
          <FotosSection fotos={obraAtual.fotosObra} onAddPhoto={addPhoto} />
        </>
      );
    }

    if (navAtiva === 'documentos') {
      return (
        <>
          <SectionIntroCard
            titulo="Documentos do projeto"
            descricao={`Central de documentos da ${obraAtual.nome.toLowerCase()}, com os principais arquivos técnicos e gerenciais compartilhados com o cliente.`}
            image={obraAtual.heroImage}
            imageAlt={obraAtual.heroImageAlt}
          />
          <DocumentosCard documentos={obraAtual.documentos} />
        </>
      );
    }

    return (
      <>
        <SectionIntroCard
          titulo={obraAtual.nome}
          descricao={`${obraAtual.tipo} em ${obraAtual.local}. Esta visão geral reúne os indicadores mais importantes, o avanço das etapas e os principais documentos da obra.`}
          image={obraAtual.heroImage}
          imageAlt={obraAtual.heroImageAlt}
        />
        <div
          className="assistant-entry-card surface-card animate-in stagger-1"
          role="button"
          tabIndex={0}
          onClick={() => setNavAtiva('assistente')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setNavAtiva('assistente');
            }
          }}
        >
          <div className="assistant-entry-accent" />
          <div className="assistant-entry-main">
            <div className="assistant-eyebrow">IA Assistente Especialista</div>
            <div className="assistant-entry-title">Entre no chat especialista de {obraAtual.nomeCurto}</div>
            <div className="assistant-entry-copy">Clique aqui para conversar com a IA da obra, receber leitura contextual, plano de ação e atalhos diretos para as seções mais importantes do sistema.</div>
          </div>
          <div className="assistant-entry-actions">
            <button
              type="button"
              className="portfolio-card-button"
              onClick={(event) => {
                event.stopPropagation();
                setNavAtiva('assistente');
              }}
            >
              Entrar no chat
            </button>
            <button
              type="button"
              className="assistant-entry-link"
              onClick={(event) => {
                event.stopPropagation();
                setNavAtiva('assistente');
              }}
            >
              Abrir IA agora
            </button>
          </div>
        </div>
        <CentralDayPanel
          obra={obraAtual}
          productPersona={productPersona}
          onOpenSection={setNavAtiva}
        />
        <DecisionBoard
          title="Fila de decisões da obra"
          helper="Aqui ficam os combinados e travas que realmente movem prazo, cliente e fechamento. Atualize esta fila para não perder contexto entre áreas."
          decisions={obraAtual.decisoes || []}
          onAdvance={advanceDecision}
          onAddAlignment={addDecisionAlignment}
          onOpenSection={setNavAtiva}
          productPersona={productPersona}
        />
        <MetricsGrid metricas={obraAtual.metricas} />

        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 24 }}>
          <EtapasCard etapas={obraAtual.etapas} />
          <ProgressoCard progresso={obraAtual.progresso} />
        </div>

        <HistorySection timeline={obraAtual.timeline} defaultExpanded={false} />
        <DocumentosCard documentos={obraAtual.documentos} defaultExpanded={false} />
      </>
    );
  }

  if (!authChecked) return null;

return (
  <>
    {phase === 'intro' && (
      <IntroScreen onEnter={() => setPhase('login')} />
    )}
    {phase === 'login' && (
      <LoginScreen
        initialMode={authMode}
        onLogin={completeLogin}
        onBack={() => setPhase('intro')}
      />
    )}
    {phase === 'dashboard' && (
      <div className="dashboard-shell">
        <Sidebar
          items={obraAtual ? menuItems : []}
          navAtiva={navAtiva}
          onSelect={(nextNav) => {
            setNavAtiva(nextNav);
            if (nextNav === 'visao') {
              setPortfolioAssistantInitialQuestion('');
            }
          }}
          obra={obraAtual}
          account={account}
          onOpenAccount={() => setAccountOpen(true)}
          onLogout={handleLogout}
          productPersona={productPersona}
          portfolioPanel={obraAtual ? null : {
            totalObras: obras.length,
            totalPendencias,
            nextVisit: nextVisit ? `${nextVisit.nome} • ${nextVisit.data}` : 'Sem agenda',
            obraPrioritaria: obraPrioritaria ? obraPrioritaria.nomeCurto : 'Sem destaque',
            focusTarget: portfolioFocus,
            onQuickAction: handlePortfolioAction,
          }}
        />

        <div className="dashboard-main">
          <Topbar
            obra={obraAtual}
            onBackToPortfolio={() => handleSelectObra(null)}
            sectionLabel={activeMenuItem ? activeMenuItem.label : 'Visão geral'}
            syncStatus={syncStatus}
            productPersona={productPersona}
            onChangePersona={setProductPersona}
            portfolioSummary={{
              totalObras: obras.length,
              totalPendencias,
              nextVisit,
            }}
          />

          {toast ? <div className={`floating-toast ${toast.type || 'success'}`}>{toast.message}</div> : null}

          <div ref={contentScrollRef} className="dashboard-content">
            <ObraTabs obras={obras} obraAtiva={obraAtiva} onSelect={handleSelectObra} />
            {renderConteudo()}
          </div>
        </div>

        <MobileQuickBar
          obra={obraAtual}
          navAtiva={navAtiva}
          portfolioFocus={portfolioFocus}
          onSelectNav={setNavAtiva}
          onOpenPortfolio={() => handleSelectObra(null)}
          onOpenPriorityObra={() => handlePortfolioAction('prioritaria')}
          onOpenPortfolioAssistant={() => openPortfolioAssistant('')}
          onOpenPortfolioAlerts={() => handlePortfolioAction('alerts')}
        />

        <AccountPanel
          open={accountOpen}
          profile={account.profile}
          initials={account.initials}
          displayName={account.displayName}
          saving={account.saving}
          onClose={() => setAccountOpen(false)}
          onFieldChange={account.setField}
          onPhotoChange={handleAccountPhotoChange}
          onSave={account.saveProfile}
          onLogout={handleLogout}
        />
      </div>
    )}
  </>
);
 
  
}
