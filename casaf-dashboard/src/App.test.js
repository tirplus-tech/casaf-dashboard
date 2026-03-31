import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IntroScreen from './components/IntroScreen';
import LoginScreen from './components/LoginScreen';
import { resolveDecisionIndex, resolveObraIndex } from './App';

describe('App auth flow', () => {
  test('a intro dispara a entrada no fluxo de autenticação', async () => {
    const onEnter = jest.fn();

    render(<IntroScreen onEnter={onEnter} />);

    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));

    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  test('renderiza o modo de redefinição de senha', () => {
    render(<LoginScreen initialMode="reset" onLogin={jest.fn()} onBack={jest.fn()} />);

    expect(screen.getByRole('heading', { name: /redefinir senha/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/nova senha/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar senha/i)).toBeInTheDocument();
  });

  test('prioriza o id da obra antes do índice numérico', () => {
    const obras = [
      { id: 1, nome: 'Imprensa IV' },
      { id: 2, nome: 'Casa Jardim Botânico' },
    ];

    expect(resolveObraIndex(obras, 1)).toBe(0);
    expect(resolveObraIndex(obras, 2)).toBe(1);
    expect(resolveObraIndex(obras, 0)).toBe(0);
  });

  test('prioriza o id da decisão antes do índice numérico', () => {
    const decisions = [
      { id: 'imprensa-cor-fachada', titulo: 'Cor da fachada' },
      { id: 'imprensa-balancins', titulo: 'Checklist balancins' },
    ];

    expect(resolveDecisionIndex(decisions, 'imprensa-cor-fachada')).toBe(0);
    expect(resolveDecisionIndex(decisions, 'imprensa-balancins')).toBe(1);
    expect(resolveDecisionIndex(decisions, 0)).toBe(0);
  });
});
