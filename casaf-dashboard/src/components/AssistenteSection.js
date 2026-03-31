import React, { useEffect, useRef, useState } from 'react';
import { answerObraQuestion, getAssistantSuggestions } from '../services/obraAssistant';

const ASSISTANT_NAME = 'IA Assistente Especialista';

function buildThinkingSteps(obra) {
  return [
    `Lendo operação e pendências de ${obra.nomeCurto}...`,
    `Conectando prazo, cronograma e liberações...`,
    'Conferindo sinais financeiros e próximos riscos...',
    'Organizando uma resposta executiva...',
  ];
}

function buildWelcomeMessage(obra) {
  return {
    id: `assistant-welcome-${obra.id}`,
    role: 'assistant',
    answer: {
      title: '',
      message: `Estou acompanhando ${obra.nomeCurto} com o contexto que já existe no sistema.\n\nPosso te ajudar como central de trabalho: cobrar o que está sem resposta, montar o plano do dia, resumir a obra para diretoria ou cliente e te dizer a próxima decisão mais importante sem você caçar informação em várias telas.`,
      references: [],
      followUps: getAssistantSuggestions().slice(0, 3),
      confidence: 'Contexto carregado',
    },
  };
}

function renderMessageText(message) {
  return String(message || '')
    .split('\n\n')
    .filter(Boolean)
    .map((paragraph, index) => (
      <p key={`${paragraph.slice(0, 24)}-${index}`} className="assistant-paragraph">
        {paragraph}
      </p>
    ));
}

function renderMetaBlocks(answer, submitQuestion, onOpenSection) {
  const compactMode = answer.displayMode === 'compact';

  return (
    <>
      {answer.title ? <div className="assistant-answer-title">{answer.title}</div> : null}
      {answer.confidence && !compactMode ? <div className="assistant-answer-confidence">{answer.confidence}</div> : null}
      {answer.agentPlan?.length && !compactMode ? (
        <div className="assistant-detail-block">
          <div className="assistant-detail-label">Plano recomendado</div>
          <div className="assistant-detail-list">
            {answer.agentPlan.map((item) => (
              <div key={item} className="assistant-detail-item">{item}</div>
            ))}
          </div>
        </div>
      ) : null}
      {answer.watchouts?.length && !compactMode ? (
        <div className="assistant-detail-block">
          <div className="assistant-detail-label">Alertas</div>
          <div className="assistant-detail-list">
            {answer.watchouts.map((item) => (
              <div key={item} className="assistant-detail-item warning">{item}</div>
            ))}
          </div>
        </div>
      ) : null}
      {answer.references?.length && !compactMode ? (
        <div className="assistant-reference-row">
          {answer.references.map((item) => (
            <span key={item} className="assistant-reference-chip">{item}</span>
          ))}
        </div>
      ) : null}
      {answer.targets?.length ? (
        <div className="assistant-target-row">
          {answer.targets.slice(0, 3).map((item) => (
            <button
              key={`${item.section}-${item.label}`}
              type="button"
              className="assistant-target-chip"
              onClick={() => onOpenSection?.(item.section)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
      {answer.followUps?.length ? (
        <div className="assistant-followup-row">
          {answer.followUps.slice(0, 3).map((item) => (
            <button key={item} type="button" className="assistant-followup-chip" onClick={() => submitQuestion(item)}>
              {item}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

export default function AssistenteSection({ obra, onOpenSection }) {
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState(buildThinkingSteps(obra)[0]);
  const [messages, setMessages] = useState(() => [buildWelcomeMessage(obra)]);
  const threadRef = useRef(null);

  useEffect(() => {
    setMessages([buildWelcomeMessage(obra)]);
    setDraft('');
    setThinking(false);
    setThinkingLabel(buildThinkingSteps(obra)[0]);
  }, [obra]);

  useEffect(() => {
    const element = threadRef.current;

    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages, thinking]);

  useEffect(() => {
    if (!thinking) {
      setThinkingLabel(buildThinkingSteps(obra)[0]);
      return undefined;
    }

    const steps = buildThinkingSteps(obra);
    let index = 0;
    const intervalId = window.setInterval(() => {
      index = (index + 1) % steps.length;
      setThinkingLabel(steps[index]);
    }, 880);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [thinking, obra]);

  async function submitQuestion(rawQuestion) {
    const question = String(rawQuestion || '').trim();

    if (!question || thinking) {
      return;
    }

    const nextUserMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      question,
    };

    setMessages((current) => [...current, nextUserMessage]);
    setDraft('');
    setThinking(true);

    try {
      const minThinkingTime = 1300 + Math.min(question.length * 8, 900);
      const history = [...messages, nextUserMessage];
      const [answer] = await Promise.all([
        answerObraQuestion(obra, question, history),
        new Promise((resolve) => window.setTimeout(resolve, minThinkingTime)),
      ]);

      setMessages((current) => [...current, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        question,
        answer,
      }]);
    } finally {
      setThinking(false);
    }
  }

  function handleComposerKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitQuestion(draft);
    }
  }

  const starterQuestions = getAssistantSuggestions();
  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');
  const followUps = lastAssistantMessage?.answer?.followUps?.slice(0, 3) || starterQuestions.slice(0, 3);
  const playbookCards = [
    {
      label: 'Cobrança do dia',
      title: 'Descubra quem ainda te deve resposta',
      action: 'Quem ainda me deve resposta hoje nesta obra e qual cobrança precisa sair primeiro?',
    },
    {
      label: 'Destravar agora',
      title: 'Pergunte o que está travando a obra hoje',
      action: 'O que mais está travando esta obra agora e qual decisão eu tomo primeiro?',
    },
    {
      label: 'Plano do dia',
      title: 'Monte uma sequência prática para a equipe',
      action: 'Monte um plano de ação do dia para esta obra com prioridade, responsável e risco.',
    },
    {
      label: 'Resumo rápido',
      title: 'Explique a obra para diretoria ou cliente',
      action: 'Faça um resumo executivo curto desta obra para alinhamento com diretoria.',
    },
  ];
  const dailyRoutines = [
    '1. Pergunte o que está sem resposta.',
    '2. Monte o plano do dia com dono e risco.',
    '3. Feche o expediente com resumo e próximos passos.',
  ];

  return (
    <div className="assistant-shell">
      <div className="assistant-stage surface-card animate-in">
        <div className="assistant-stage-glow" />

        <div className="assistant-stage-head">
          <div className="assistant-stage-meta">
            <div className="assistant-eyebrow">IA Assistente Especialista</div>
            <div className="assistant-stage-title">Chat de {obra.nomeCurto}</div>
            <div className="assistant-stage-copy">Pergunte como em uma IA tradicional, com respostas contextualizadas pela obra.</div>
          </div>
        </div>

        <div className="assistant-ritual-banner">
          {dailyRoutines.map((item) => (
            <div key={item} className="assistant-ritual-pill">{item}</div>
          ))}
        </div>

        <div className="assistant-playbook-grid">
          {playbookCards.map((item) => (
            <button key={item.title} type="button" className="assistant-playbook-card" onClick={() => submitQuestion(item.action)}>
              <span>{item.label}</span>
              <strong>{item.title}</strong>
            </button>
          ))}
        </div>

        <div className="assistant-composer-shell">
          <div className="assistant-composer">
            <div className="assistant-composer-badge">
              <span className="assistant-composer-dot" />
              {ASSISTANT_NAME}
            </div>
            <textarea
              className="assistant-textarea"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder={`Pergunte sobre ${obra.nomeCurto}...`}
            />
            <div className="assistant-compose-footer">
              <div className="assistant-compose-hint">Baseado no contexto da obra</div>
              <button
                type="button"
                className="assistant-submit"
                onClick={() => submitQuestion(draft)}
                disabled={thinking || !draft.trim()}
              >
                {thinking ? 'Analisando' : 'Perguntar'}
              </button>
            </div>
          </div>

          <div className="assistant-chip-row">
            {starterQuestions.slice(0, 4).map((item) => (
              <button key={item} type="button" className="assistant-chip" onClick={() => submitQuestion(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>

        <div ref={threadRef} className="assistant-thread">
          {messages.map((message) => (
            message.role === 'user' ? (
              <div key={message.id} className="assistant-message assistant-message-user">
                <div className="assistant-bubble assistant-bubble-user">
                  {message.question}
                </div>
              </div>
            ) : (
              <div key={message.id} className="assistant-message assistant-message-assistant">
                <div className="assistant-bubble assistant-bubble-assistant">
                  <div className="assistant-answer-body">
                    {renderMessageText(message.answer.message)}
                  </div>
                  {renderMetaBlocks(message.answer, submitQuestion, onOpenSection)}
                </div>
              </div>
            )
          ))}

          {thinking ? (
            <div className="assistant-message assistant-message-assistant">
              <div className="assistant-bubble assistant-bubble-assistant assistant-thinking-shell">
                <div className="assistant-thinking-label">{thinkingLabel}</div>
                <div className="assistant-thinking">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="assistant-bottom-actions">
          {followUps.slice(0, 3).map((item) => (
            <button key={item} type="button" className="assistant-bottom-chip" onClick={() => submitQuestion(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
