import React from 'react';

export default function AccountPanel({
  open,
  profile,
  initials,
  displayName,
  saving,
  onClose,
  onFieldChange,
  onPhotoChange,
  onSave,
  onLogout,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="account-overlay account-overlay-open" role="dialog" aria-modal="true" aria-label="Conta do usuário">
      <button type="button" className="account-overlay-backdrop" onClick={onClose} aria-label="Fechar painel de conta" />
      <aside className="account-panel">
        <div className="account-panel-header">
          <div>
            <div className="account-panel-eyebrow">Conta</div>
            <h2>Perfil e preferências</h2>
            <p>Atualize seus dados para personalizar a experiência da equipe dentro do painel.</p>
          </div>
          <button type="button" className="account-close" onClick={onClose}>Fechar</button>
        </div>

        <div className="account-hero">
          {profile.photo ? (
            <img className="account-avatar-image" src={profile.photo} alt={displayName} />
          ) : (
            <div className="account-avatar-fallback">{initials}</div>
          )}
          <div className="account-hero-copy">
            <strong>{displayName}</strong>
            <span>{profile.role || 'Defina seu cargo'}</span>
            <span>{profile.sector || 'Defina seu setor'}</span>
          </div>
        </div>

        <div className="account-upload-row">
          <label className="account-upload-button">
            <input
              type="file"
              accept="image/*"
              onChange={onPhotoChange}
            />
            Alterar foto
          </label>
          <span className="account-upload-help">Use uma imagem quadrada para melhor resultado.</span>
        </div>

        <div className="account-form-grid">
          <label className="account-field">
            <span>Nome completo</span>
            <input value={profile.fullName} onChange={(event) => onFieldChange('fullName', event.target.value)} placeholder="Seu nome" />
          </label>
          <label className="account-field">
            <span>E-mail</span>
            <input value={profile.email} disabled placeholder="seuemail@empresa.com" />
          </label>
          <label className="account-field">
            <span>Setor</span>
            <input value={profile.sector} onChange={(event) => onFieldChange('sector', event.target.value)} placeholder="Ex.: Engenharia" />
          </label>
          <label className="account-field">
            <span>Cargo</span>
            <input value={profile.role} onChange={(event) => onFieldChange('role', event.target.value)} placeholder="Ex.: Coordenador de obras" />
          </label>
          <label className="account-field account-field-wide">
            <span>Telefone</span>
            <input value={profile.phone} onChange={(event) => onFieldChange('phone', event.target.value)} placeholder="(61) 99999-9999" />
          </label>
        </div>

        <div className="account-actions">
          <button type="button" className="account-secondary" onClick={onLogout}>Sair da conta</button>
          <button type="button" className="account-primary" onClick={onSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar perfil'}
          </button>
        </div>
      </aside>
    </div>
  );
}
