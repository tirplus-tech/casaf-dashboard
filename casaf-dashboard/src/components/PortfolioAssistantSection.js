import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  answerPortfolioQuestion,
  getPortfolioAssistantQuestions,
} from '../services/obraAssistant';

function buildWelcomeMessage() {
  return {
    id: `portfolio-assistant-welcome`,
    role: 'assistant',
    answer: {
      title: '',
      message: 'Estou olhando o portfólio inteiro como uma mesa de controle executiva.\n\nSe você quiser, posso te dizer rapidamente qual obra merece atenção agora, onde está o principal risco e qual decisão vale tomar primeiro.',
      followUps: getPortfolioAssistantQuestions().slice(0, 3),
      confidence: 'Contexto do sistema',
      targets: [],
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

function renderMetaBlocks(answer, submitQuestion, onSelectObra) {
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
              key={`${item.obraId}-${item.label}`}
              type="button"
              className="assistant-target-chip"
              onClick={() => onSelectObra?.(item.obraId)}
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

export default function PortfolioAssistantSection({ obras, onSelectObra, initialQuestion = '' }) {
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState('Lendo o portfólio e conectando as obras...');
  const [messages, setMessages] = useState(() => [buildWelcomeMessage()]);
  const threadRef = useRef(null);
  const submittedInitialRef = useRef('');

  useEffect(() => {
    const element = threadRef.current;

    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages, thinking]);

  useEffect(() => {
    if (!thinking) {
      setThinkingLabel('Lendo o portfólio e conectando as obras...');
      return undefined;
    }

    const steps = [
      'Lendo o portfólio e conectando as obras...',
      'Comparando risco, prazo e prioridade entre as frentes...',
      'Organizando uma resposta executiva do sistema...',
    ];
    let index = 0;
    const intervalId = window.setInterval(() => {
      index = (index + 1) % steps.length;
      setThinkingLabel(steps[index]);
    }, 900);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [thinking]);

  const submitQuestion = useCallback(async (rawQuestion) => {
    const question = String(rawQuestion || '').trim();

    if (!question || thinking) {
      return;
    }

    const nextUserMessage = {
      id: `portfolio-user-${Date.now()}`,
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
        answerPortfolioQuestion(obras, question, history),
        new Promise((resolve) => window.setTimeout(resolve, minThinkingTime)),
      ]);

      setMessages((current) => [...current, {
        id: `portfolio-assistant-${Date.now()}`,
        role: 'assistant',
        answer,
      }]);
    } finally {
      setThinking(false);
    }
  }, [messages, obras, thinking]);

  useEffect(() => {
    const normalized = String(initialQuestion || '').trim();

    if (!normalized || submittedInitialRef.current === normalized) {
      return;
    }

    submittedInitialRef.current = normalized;
    submitQuestion(normalized);
  }, [initialQuestion, submitQuestion]);

  function handleComposerKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitQuestion(draft);
    }
  }

  const starterQuestions = getPortfolioAssistantQuestions();
  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');
  const followUps = lastAssistantMessage?.answer?.followUps?.slice(0, 2) || starterQuestions.slice(0, 2);
  const portfolioUseCases = [
    {
      label: 'Reunião diária',
      title: 'Gere a pauta de alinhamento da liderança',
      action: 'Monte a pauta da reunião diária do portfólio com foco em prioridade, risco e próximo passo.',
    },
    {
      label: 'Cliente',
      title: 'Transforme o sistema em resumo executivo',
      action: 'Crie um resumo executivo do portfólio para compartilhar com cliente.',
    },
    {
      label: 'Direção',
      title: 'Descubra onde a liderança deve entrar primeiro',
      action: 'Qual obra merece intervenção da liderança primeiro e por quê?',
    },
  ];

  return (
    <div className="assistant-shell">
      <div className="assistant-stage assistant-stage-portfolio surface-card animate-in">
        <div className="assistant-stage-glow" />

        <div className="assistant-stage-head">
          <div className="assistant-stage-meta">
            <div className="assistant-eyebrow">IA Assistente Especialista</div>
            <div className="assistant-stage-title">Leitura geral do sistema</div>
            <div className="assistant-stage-copy">Converse sobre o portfólio inteiro. Aqui a IA compara as obras, enxerga prioridades e responde de forma executiva sobre o conjunto.</div>
          </div>
        </div>

        <div className="assistant-playbook-grid">
          {portfolioUseCases.map((item) => (
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
              IA do sistema
            </div>
            <textarea
              className="assistant-textarea"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Pergunte sobre o sistema como um todo..."
            />
            <div className="assistant-compose-footer">
              <div className="assistant-compose-hint">Visão geral do portfólio</div>
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
            {starterQuestions.map((item) => (
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
                  {renderMetaBlocks(message.answer, submitQuestion, onSelectObra)}
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
          {followUps.map((item) => (
            <button key={item} type="button" className="assistant-bottom-chip" onClick={() => submitQuestion(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
