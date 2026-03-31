import React, { useEffect, useMemo, useState } from 'react';
import { hasSupabaseConfig, supabase } from '../lib/supabase';

const MODES = {
  login: { title: 'Entrar', subtitle: 'Acesse sua área com segurança.' },
  signup: { title: 'Criar conta', subtitle: 'Abra um novo acesso.' },
  recover: { title: 'Recuperar senha', subtitle: 'Receba um link por e-mail.' },
  reset: { title: 'Redefinir senha', subtitle: 'Crie uma nova senha para continuar.' },
};

function getCanonicalAppUrl() {
  const configuredUrl = process.env.REACT_APP_APP_URL || process.env.REACT_APP_PUBLIC_APP_URL;

  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:4173';
  }

  const { protocol, hostname, port } = window.location;

  if (port === '4173') {
    return window.location.origin;
  }

  return `${protocol}//${hostname}:4173`;
}

export default function LoginScreen({ onLogin, onBack, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const currentMode = useMemo(() => MODES[mode], [mode]);

  useEffect(() => {
    setMode(initialMode);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
  }, [initialMode]);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
    setSuccess('');

    if (nextMode !== 'signup') {
      setName('');
    }

    if (nextMode === 'recover') {
      setPassword('');
      setConfirmPassword('');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!hasSupabaseConfig || !supabase) {
      if (mode === 'recover' || mode === 'reset') {
        setError('Configure o Supabase para usar recuperação de senha.');
        return;
      }

      setSuccess('Supabase não configurado. Entrando em modo local para preview.');
      onLogin();
      return;
    }

    if (mode === 'signup' || mode === 'reset') {
      if (password.length < 6) {
        setError('A senha precisa ter pelo menos 6 caracteres.');
        return;
      }

      if (password !== confirmPassword) {
        setError('As senhas não conferem.');
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

        if (signInError) {
          setError('E-mail ou senha incorretos.');
          return;
        }

        onLogin();
        return;
      }

      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name || email },
            emailRedirectTo: getCanonicalAppUrl(),
          },
        });

        if (signUpError) {
          setError(signUpError.message || 'Não foi possível criar a conta agora.');
          return;
        }

        if (data.session) {
          onLogin();
          return;
        }

        setSuccess('Conta criada. Verifique seu e-mail para confirmar o acesso.');
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        return;
      }

      if (mode === 'reset') {
        const { error: updateError } = await supabase.auth.updateUser({ password });

        if (updateError) {
          setError(updateError.message || 'Não foi possível atualizar a senha agora.');
          return;
        }

        if (typeof window !== 'undefined') {
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        await supabase.auth.signOut();
        setMode('login');
        setError('');
        setSuccess('Senha atualizada com sucesso. Faça login com a nova senha.');
        setPassword('');
        setConfirmPassword('');
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getCanonicalAppUrl(),
      });

      if (resetError) {
        setError(resetError.message || 'Não foi possível enviar o e-mail de recuperação.');
        return;
      }

      setSuccess('Enviamos um link de recuperação para o seu e-mail.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-layout">
        <div className="auth-aside">
          {mode === 'reset'
            ? <span className="auth-back auth-back-static">Recuperação segura</span>
            : <button type="button" className="auth-back" onClick={onBack}>Voltar</button>}
          <div className="auth-mark-wrap">
            <img src={`${process.env.PUBLIC_URL || ''}/casaf-logo.png`} alt="CASAF" className="auth-mark" />
          </div>
          <div className="auth-aside-copy">
            <span>Sistema CASAF</span>
            <h1>{mode === 'reset' ? 'Defina uma nova senha e retome o acesso com segurança.' : 'Acesse sua central com uma experiência mais refinada e intuitiva.'}</h1>
            <p>{mode === 'reset' ? 'Essa etapa finaliza a recuperação da conta e devolve o acesso ao painel com uma nova credencial.' : 'Tudo o que você precisa para entrar, criar acesso ou recuperar senha em um fluxo claro e elegante.'}</p>
          </div>
        </div>

        <div className="auth-card">
          {mode !== 'reset' && (
            <div className="auth-tabs">
              <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Entrar</button>
              <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')}>Criar</button>
              <button type="button" className={mode === 'recover' ? 'active' : ''} onClick={() => switchMode('recover')}>Recuperar</button>
            </div>
          )}

          <div className="auth-header">
            <h2>{currentMode.title}</h2>
            <p>{currentMode.subtitle}</p>
          </div>

          {!hasSupabaseConfig && (
            <div className="auth-message auth-warning">Modo local ativo para preview.</div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'signup' && (
              <label className="auth-field">
                <span>Nome</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
              </label>
            )}

            {mode !== 'reset' && (
              <label className="auth-field">
                <span>E-mail</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@casaf.com" required />
              </label>
            )}

            {mode !== 'recover' && (
              <label className="auth-field">
                <span>{mode === 'reset' ? 'Nova senha' : 'Senha'}</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
              </label>
            )}

            {(mode === 'signup' || mode === 'reset') && (
              <label className="auth-field">
                <span>Confirmar senha</span>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita sua senha" required />
              </label>
            )}

            {error && <div className="auth-message auth-error">{error}</div>}
            {success && <div className="auth-message auth-success">{success}</div>}

            <button type="submit" disabled={loading} className="auth-submit">
              {loading ? 'Processando...' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : mode === 'recover' ? 'Enviar link' : 'Atualizar senha'}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        .auth-shell {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
          background:
            radial-gradient(circle at top left, rgba(59, 130, 246, 0.14), transparent 22%),
            radial-gradient(circle at bottom right, rgba(45, 212, 191, 0.1), transparent 18%),
            linear-gradient(145deg, #05111f 0%, #0a1d35 48%, #112d4f 100%);
          font-family: "Avenir Next", "Segoe UI", sans-serif;
          color: #f8fbff;
          overflow: hidden;
          position: relative;
          isolation: isolate;
        }

        .auth-shell::before {
          content: '';
          position: absolute;
          inset: auto -10% -18% -10%;
          height: 46%;
          background: radial-gradient(circle at 50% 50%, rgba(96, 165, 250, 0.18), transparent 64%);
          filter: blur(40px);
          pointer-events: none;
          z-index: 0;
        }

        .auth-shell::after {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 0;
          background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.05) 44%, rgba(219,234,254,0.1) 50%, transparent 70%);
          transform: translateX(-140%);
          animation: authSweep 6.6s cubic-bezier(0.19, 1, 0.22, 1) 220ms 1 both;
          pointer-events: none;
        }

        .auth-layout {
          width: min(940px, 100%);
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(320px, 380px);
          gap: 22px;
          align-items: stretch;
          position: relative;
          z-index: 2;
          perspective: 1400px;
          animation: authStageIn 950ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .auth-aside,
        .auth-card {
          border-radius: 30px;
          border: 1px solid rgba(191, 219, 254, 0.12);
          box-shadow: 0 24px 70px rgba(2, 6, 23, 0.32);
          backdrop-filter: none;
        }

        .auth-aside {
          padding: 32px;
          background: linear-gradient(180deg, rgba(8, 18, 35, 0.76), rgba(8, 18, 35, 0.58));
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transform-origin: left center;
          animation: authPaneLeft 1100ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .auth-back {
          border: none;
          background: transparent;
          color: rgba(191, 219, 254, 0.8);
          font: inherit;
          cursor: pointer;
          padding: 0;
          text-align: left;
        }

        .auth-back-static {
          cursor: default;
        }

        .auth-mark-wrap {
          width: 92px;
          height: 92px;
          margin-top: 18px;
          border-radius: 26px;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.04));
          border: 1px solid rgba(191, 219, 254, 0.14);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 26px 54px rgba(15, 23, 42, 0.3), 0 0 0 rgba(96, 165, 250, 0.0);
          animation: authFloat 5.8s ease-in-out infinite, authPulse 3.1s ease-in-out infinite;
        }

        .auth-mark {
          width: 54px;
          height: 54px;
          object-fit: contain;
        }

        .auth-aside-copy span {
          display: inline-block;
          margin-top: 28px;
          color: rgba(191, 219, 254, 0.76);
          font-size: 12px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .auth-aside-copy h1 {
          margin: 14px 0 0;
          font-size: clamp(30px, 5vw, 48px);
          line-height: 0.98;
          letter-spacing: -0.05em;
        }

        .auth-aside-copy p {
          margin: 16px 0 0;
          max-width: 360px;
          color: rgba(226, 232, 240, 0.7);
          line-height: 1.8;
          font-size: 15px;
        }

        .auth-card {
          padding: 24px;
          background: linear-gradient(180deg, rgba(8, 18, 35, 0.88), rgba(8, 18, 35, 0.76));
          transform-origin: right center;
          animation: authPaneRight 1180ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .auth-tabs {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          padding: 6px;
          border-radius: 18px;
          background: rgba(255,255,255,0.05);
          margin-bottom: 24px;
        }

        .auth-tabs button {
          border: none;
          background: transparent;
          color: rgba(191, 219, 254, 0.74);
          font: inherit;
          font-size: 13px;
          padding: 11px 10px;
          border-radius: 14px;
          cursor: pointer;
        }

        .auth-tabs button.active {
          background: rgba(255,255,255,0.08);
          color: #f8fbff;
        }

        .auth-header h2 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }

        .auth-header p {
          margin: 8px 0 0;
          color: rgba(226, 232, 240, 0.66);
          font-size: 14px;
        }

        .auth-form {
          display: grid;
          gap: 14px;
          margin-top: 20px;
        }

        .auth-field {
          display: grid;
          gap: 6px;
        }

        .auth-field span {
          color: rgba(191, 219, 254, 0.74);
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .auth-field input {
          width: 100%;
          padding: 14px 15px;
          border-radius: 16px;
          border: 1px solid rgba(191, 219, 254, 0.1);
          background: rgba(255,255,255,0.05);
          color: #f8fbff;
          outline: none;
          font: inherit;
        }

        .auth-field input:focus {
          border-color: rgba(148, 163, 184, 0.34);
          box-shadow: 0 0 0 4px rgba(148, 163, 184, 0.08);
        }

        .auth-message {
          padding: 12px 14px;
          border-radius: 14px;
          font-size: 13px;
          line-height: 1.6;
        }

        .auth-warning {
          background: rgba(250, 204, 21, 0.1);
          border: 1px solid rgba(250, 204, 21, 0.18);
          color: #fde68a;
        }

        .auth-error {
          background: rgba(248, 113, 113, 0.12);
          border: 1px solid rgba(248, 113, 113, 0.18);
          color: #fecaca;
        }

        .auth-success {
          background: rgba(52, 211, 153, 0.12);
          border: 1px solid rgba(52, 211, 153, 0.18);
          color: #bbf7d0;
        }

        .auth-submit {
          margin-top: 4px;
          padding: 15px 18px;
          border: none;
          border-radius: 999px;
          background: linear-gradient(135deg, #dbeafe 0%, #99f6e4 100%);
          color: #07111e;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        .auth-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        @keyframes authStageIn {
          from {
            opacity: 0;
            transform: translateY(42px) scale(0.955);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes authPaneLeft {
          from {
            opacity: 0;
            transform: translateX(-56px) rotateY(12deg) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateX(0) rotateY(0deg) scale(1);
          }
        }

        @keyframes authPaneRight {
          from {
            opacity: 0;
            transform: translateX(60px) rotateY(-12deg) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateX(0) rotateY(0deg) scale(1);
          }
        }

        @keyframes authFloat {
          0%, 100% {
            transform: translateY(0px) scale(1);
          }
          50% {
            transform: translateY(-14px) scale(1.045);
          }
        }

        @keyframes authPulse {
          0%, 100% {
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 24px 46px rgba(15, 23, 42, 0.26), 0 0 0 rgba(96, 165, 250, 0);
          }
          50% {
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 28px 54px rgba(15, 23, 42, 0.3), 0 0 52px rgba(96, 165, 250, 0.26);
          }
        }

        @keyframes authSweep {
          from {
            transform: translateX(-140%);
            opacity: 0;
          }
          22% {
            opacity: 0.9;
          }
          to {
            transform: translateX(140%);
            opacity: 0;
          }
        }

        @media (max-width: 860px) {
          .auth-layout {
            grid-template-columns: 1fr;
          }

          .auth-shell {
            overflow: auto;
            padding: 18px;
          }

          .auth-aside {
            min-height: 0;
            gap: 20px;
          }

          .auth-aside-copy p {
            max-width: none;
          }
        }

        @media (max-width: 640px) {
          .auth-shell {
            padding: 12px;
          }

          .auth-aside,
          .auth-card {
            padding: 18px;
            border-radius: 22px;
          }

          .auth-tabs {
            grid-template-columns: 1fr;
          }

          .auth-layout {
            gap: 14px;
          }

          .auth-back {
            min-height: 42px;
          }

          .auth-mark-wrap {
            width: 76px;
            height: 76px;
            border-radius: 22px;
            margin-top: 8px;
          }

          .auth-mark {
            width: 46px;
            height: 46px;
          }

          .auth-aside-copy span {
            margin-top: 18px;
            font-size: 11px;
          }

          .auth-aside-copy h1 {
            font-size: clamp(26px, 9vw, 34px);
            line-height: 1.02;
          }

          .auth-aside-copy p,
          .auth-header p,
          .auth-message {
            font-size: 13px;
          }

          .auth-header h2 {
            font-size: 24px;
          }

          .auth-field input {
            padding: 14px;
            font-size: 16px;
          }

          .auth-submit {
            width: 100%;
            min-height: 48px;
          }
        }

        @media (max-width: 420px) {
          .auth-shell {
            padding: 8px;
          }

          .auth-aside,
          .auth-card {
            padding: 16px;
            border-radius: 20px;
          }

          .auth-tabs button {
            font-size: 12px;
            padding: 10px 8px;
          }
        }
      `}</style>
    </div>
  );
}
