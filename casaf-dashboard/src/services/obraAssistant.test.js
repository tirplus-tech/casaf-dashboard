import { obras } from '../data/dashboardData';
import { answerObraQuestion, answerPortfolioQuestion, getPortfolioSnapshot, parseDashboardDateLabel } from './obraAssistant';

describe('obraAssistant greetings', () => {
  test('trata variações de saudação no portfólio sem abrir análise pesada', async () => {
    const answer = await answerPortfolioQuestion(obras, 'oolá!');

    expect(answer.message).toMatch(/estou por aqui/i);
    expect(answer.message).not.toMatch(/olhando o sistema como um todo/i);
  });

  test('trata saudação curta na obra sem cair em leitura executiva completa', async () => {
    const answer = await answerObraQuestion(obras[0], 'oiii');

    expect(answer.message).toMatch(/estou por aqui/i);
    expect(answer.message).not.toMatch(/me parece em um ponto de avanço razoável/i);
  });

  test('ordena checkpoint do portfólio por data real e não por texto', () => {
    const snapshot = getPortfolioSnapshot([
      { ...obras[0], proximaData: '02 Abr 2026' },
      { ...obras[1], proximaData: '31 Mar 2026' },
    ]);

    expect(snapshot.nextVisit.nome).toBe(obras[1].nomeCurto);
    expect(parseDashboardDateLabel('31 Mar 2026')).toBeInstanceOf(Date);
  });

  test('mantém resposta curta e conversacional para pergunta curta', async () => {
    const answer = await answerPortfolioQuestion(obras, 'e agora?');

    expect(answer.displayMode).toBe('compact');
    expect(answer.agentPlan).toEqual([]);
    expect(String(answer.message).split('\n\n').filter(Boolean).length).toBeLessThanOrEqual(2);
  });
});
