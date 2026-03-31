import { useEffect, useState } from 'react';

function isRecoveryFlow() {
  if (typeof window === 'undefined') {
    return false;
  }

  const hash = window.location.hash || '';
  const search = window.location.search || '';
  return hash.includes('type=recovery') || search.includes('type=recovery');
}

export function useAuthFlow({ hasSupabaseConfig, supabase }) {
  const [phase, setPhase] = useState('intro');
  const [authMode, setAuthMode] = useState('login');
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    function openLogin(nextMode = 'login') {
      setAuthMode(nextMode);
      setPhase('login');
    }

    if (!hasSupabaseConfig || !supabase) {
      setPhase('intro');
      setAuthChecked(true);
      return undefined;
    }

    let active = true;

    supabase.auth.getSession()
      .then(({ data }) => {
        if (!active) {
          return;
        }

        if (isRecoveryFlow()) {
          openLogin('reset');
          setUser(data.session?.user || null);
          return;
        }

        setUser(data.session?.user || null);
        setAuthMode('login');
        setPhase(data.session ? 'dashboard' : 'intro');
      })
      .catch(() => {
        if (active) {
          setPhase('intro');
        }
      })
      .finally(() => {
        if (active) {
          setAuthChecked(true);
        }
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) {
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        openLogin('reset');
        setAuthChecked(true);
        return;
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setAuthMode('login');
        setPhase('intro');
        setAuthChecked(true);
        return;
      }

      if (event === 'USER_UPDATED') {
        setUser(session?.user || null);
        setAuthMode('login');
        setAuthChecked(true);
        return;
      }

      setUser(session?.user || null);
      setAuthMode('login');
      setPhase(session ? 'dashboard' : 'intro');
      setAuthChecked(true);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [hasSupabaseConfig, supabase]);

  async function logout() {
    if (hasSupabaseConfig && supabase) {
      await supabase.auth.signOut();
      return;
    }

    setAuthMode('login');
    setPhase('intro');
  }

  return {
    phase,
    authMode,
    authChecked,
    user,
    setPhase,
    setAuthMode,
    enterLogin: (mode = 'login') => {
      setAuthMode(mode);
      setPhase('login');
    },
    completeLogin: () => {
      setAuthMode('login');
      setPhase('dashboard');
    },
    logout,
  };
}
