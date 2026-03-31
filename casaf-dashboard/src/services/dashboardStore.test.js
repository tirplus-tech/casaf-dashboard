import { obras } from '../data/dashboardData';
import { prepareDashboardStateForPersistence } from './dashboardStore';

describe('dashboardStore persistence sanitization', () => {
  test('remove drafts transitórios e base64 das fotos antes de persistir', () => {
    const source = [{
      ...obras[0],
      fotosObra: [
        {
          id: 999,
          titulo: 'Registro local',
          data: '27 Mar 2026',
          tag: 'Teste',
          image: 'data:image/png;base64,abc123',
          storagePath: 'obra-1/registro.png',
        },
      ],
      operacao: {
        ...obras[0].operacao,
        novoApontamento: 'rascunho',
        novaTarefaTitulo: 'tarefa temporária',
        novaTarefaResponsavel: 'equipe',
        novaTarefaHorario: '10:00',
        novaPendenciaTitulo: 'pendência temporária',
        novaPendenciaImpacto: 'impacto',
        novaPendenciaDono: 'dono',
        novoChecklistItem: 'item temporário',
      },
      planejamento: {
        ...obras[0].planejamento,
        novaFaseNome: 'fase rascunho',
        novaFasePrazo: 'amanhã',
        novoMteCodigo: 'TMP-001',
        novoMteTitulo: 'MTE temporário',
        novoMteResponsavel: 'teste',
      },
    }];

    const [persisted] = prepareDashboardStateForPersistence(source);

    expect(persisted.fotosObra[0].image).toBe('');
    expect(persisted.fotosObra[0].storagePath).toBe('obra-1/registro.png');
    expect(persisted.operacao.novoApontamento).toBe('');
    expect(persisted.operacao.novaTarefaTitulo).toBe('');
    expect(persisted.operacao.novaPendenciaTitulo).toBe('');
    expect(persisted.operacao.novoChecklistItem).toBe('');
    expect(persisted.planejamento.novaFaseNome).toBe('');
    expect(persisted.planejamento.novoMteCodigo).toBe('');
  });
});
