import { hasSupabaseConfig, supabase } from '../lib/supabase';

const STORAGE_KEY = 'casaf-dashboard-state-v1';
const STORAGE_BUCKET = 'obra-midias';

function sanitizeFileName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripSessionImage(image) {
  return typeof image === 'string' && image.startsWith('data:') ? '' : image;
}

function normalizeStoredPhoto(foto) {
  return {
    ...foto,
    image: stripSessionImage(foto.image),
    storagePath: foto.storagePath || '',
  };
}

function sanitizeObraForPersistence(obra) {
  return {
    ...obra,
    fotosObra: (obra.fotosObra || []).map((foto) => normalizeStoredPhoto(foto)),
    operacao: {
      ...obra.operacao,
      novoApontamento: '',
      novaTarefaTitulo: '',
      novaTarefaResponsavel: '',
      novaTarefaHorario: '',
      novaPendenciaTitulo: '',
      novaPendenciaImpacto: '',
      novaPendenciaDono: '',
      novoChecklistItem: '',
    },
    planejamento: {
      ...obra.planejamento,
      novaFaseNome: '',
      novaFasePrazo: '',
      novoMteCodigo: '',
      novoMteTitulo: '',
      novoMteResponsavel: '',
    },
  };
}

function mergeWithInitialObra(initialObra, storedObra) {
  if (!initialObra) {
    return storedObra;
  }

  return {
    ...initialObra,
    ...storedObra,
    operacao: {
      ...initialObra.operacao,
      ...storedObra.operacao,
    },
    planejamento: {
      ...initialObra.planejamento,
      ...storedObra.planejamento,
    },
    financeiroOperacional: {
      ...initialObra.financeiroOperacional,
      ...storedObra.financeiroOperacional,
    },
  };
}

function applyInitialObraDefaults(initialState, loadedState) {
  const initialMap = new Map((initialState || []).map((obra) => [obra.id, obra]));

  return (loadedState || []).map((obra) => mergeWithInitialObra(initialMap.get(obra.id), obra));
}

export function prepareDashboardStateForPersistence(obras) {
  return (obras || []).map((obra) => sanitizeObraForPersistence(obra));
}

async function createSignedPhotoUrl(storagePath) {
  if (!hasSupabaseConfig || !supabase || !storagePath) {
    return '';
  }

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  if (error) {
    return '';
  }

  return data?.signedUrl || '';
}

async function hydrateObraPhotoAssets(obra) {
  const fotosObra = await Promise.all((obra.fotosObra || []).map(async (foto) => {
    if (!foto?.storagePath) {
      return normalizeStoredPhoto(foto);
    }

    const signedUrl = await createSignedPhotoUrl(foto.storagePath);

    return {
      ...normalizeStoredPhoto(foto),
      image: signedUrl || stripSessionImage(foto.image),
    };
  }));

  return {
    ...obra,
    fotosObra,
  };
}

export async function hydrateDashboardStateAssets(obras) {
  return Promise.all((obras || []).map((obra) => hydrateObraPhotoAssets(obra)));
}

export function getLocalDashboardState(initialState) {
  if (typeof window === 'undefined') {
    return initialState;
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return initialState;
    }

    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? applyInitialObraDefaults(initialState, parsed) : initialState;
  } catch (error) {
    return initialState;
  }
}

export async function loadDashboardState(initialState) {
  const localState = getLocalDashboardState(initialState);

  if (!hasSupabaseConfig || !supabase) {
    return hydrateDashboardStateAssets(localState);
  }

  const { data, error } = await supabase
    .from('dashboard_obras')
    .select('id, payload')
    .order('id', { ascending: true });

  if (error || !data || data.length === 0) {
    return hydrateDashboardStateAssets(localState);
  }

  const remoteState = data
    .map((item) => item.payload)
    .filter(Boolean);

  return hydrateDashboardStateAssets(applyInitialObraDefaults(initialState, remoteState.length > 0 ? remoteState : localState));
}

export async function saveDashboardState(obras) {
  const preparedState = prepareDashboardStateForPersistence(obras);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preparedState));
  }

  if (!hasSupabaseConfig || !supabase) {
    return { mode: 'local' };
  }

  const payload = preparedState.map((obra) => ({
    id: obra.id,
    nome: obra.nome,
    slug: obra.nomeCurto || obra.nome,
    payload: obra,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('dashboard_obras')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    throw error;
  }

  return { mode: 'remote' };
}

export async function uploadObraPhotoAsset({ obraId, file, previewDataUrl }) {
  if (!hasSupabaseConfig || !supabase || !file) {
    return {
      imageUrl: previewDataUrl,
      storagePath: '',
    };
  }

  const extension = file.name.split('.').pop() || 'jpg';
  const safeName = sanitizeFileName(file.name.replace(`.${extension}`, ''));
  const path = `obra-${obraId}/${Date.now()}-${safeName}.${extension}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    return {
      imageUrl: previewDataUrl,
      storagePath: '',
    };
  }

  const signedUrl = await createSignedPhotoUrl(path);

  return {
    imageUrl: signedUrl || previewDataUrl,
    storagePath: path,
  };
}

export function getPersistenceModeLabel() {
  return hasSupabaseConfig ? 'Supabase conectado' : 'Modo local';
}
