import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'casaf-account-profile-v1';

function getInitials(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase() || '')
    .join('') || 'CA';
}

function readStoredProfile() {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function buildProfile(user) {
  const stored = readStoredProfile();
  const metadata = user?.user_metadata || {};

  return {
    fullName: metadata.full_name || stored.fullName || '',
    email: user?.email || stored.email || '',
    sector: metadata.sector || stored.sector || '',
    role: metadata.role_title || stored.role || '',
    phone: metadata.phone || stored.phone || '',
    photo: metadata.avatar_url || stored.photo || '',
  };
}

export function useAccountProfile({ user, hasSupabaseConfig, supabase, onSaved, onError }) {
  const [profile, setProfile] = useState(() => buildProfile(user));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProfile(buildProfile(user));
  }, [user]);

  const displayName = useMemo(() => {
    return profile.fullName || user?.user_metadata?.full_name || user?.email || 'Equipe CASAF';
  }, [profile.fullName, user]);

  async function saveProfile() {
    const nextProfile = {
      fullName: profile.fullName.trim(),
      email: profile.email,
      sector: profile.sector.trim(),
      role: profile.role.trim(),
      phone: profile.phone.trim(),
      photo: profile.photo,
    };

    setSaving(true);

    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProfile));
      }

      if (hasSupabaseConfig && supabase && user) {
        const { error } = await supabase.auth.updateUser({
          data: {
            full_name: nextProfile.fullName || user.email || 'Equipe CASAF',
            sector: nextProfile.sector,
            role_title: nextProfile.role,
            phone: nextProfile.phone,
            avatar_url: nextProfile.photo,
          },
        });

        if (error) {
          throw error;
        }
      }

      if (typeof onSaved === 'function') {
        onSaved();
      }
    } catch (error) {
      if (typeof onError === 'function') {
        onError(error);
      }
    } finally {
      setSaving(false);
    }
  }

  return {
    profile,
    saving,
    displayName,
    initials: getInitials(displayName),
    setField: (field, value) => {
      setProfile((current) => ({ ...current, [field]: value }));
    },
    saveProfile,
  };
}
