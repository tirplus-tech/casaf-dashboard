import React, { useState } from 'react';

export default function FotosSection({ fotos, onAddPhoto }) {
  const [titulo, setTitulo] = useState('');
  const [tag, setTag] = useState('');
  const [purpose, setPurpose] = useState('Avanço');
  const [preview, setPreview] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  function handleFileChange(event) {
    const file = event.target.files && event.target.files[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPreview(String(reader.result || ''));
      setArquivo(file);
    };
    reader.readAsDataURL(file);
  }

  async function handleAddPhoto() {
    if (!titulo.trim() || !tag.trim() || !purpose.trim() || !preview) {
      return;
    }

    setIsSaving(true);
    await onAddPhoto({ title: titulo, tag, purpose, image: preview, file: arquivo });
    setTitulo('');
    setTag('');
    setPurpose('Avanço');
    setPreview('');
    setArquivo(null);
    setIsSaving(false);
  }

  return (
    <>
      <div className="surface-card photo-upload-card animate-in">
        <div className="card-title">Adicionar novo registro fotográfico</div>
        <div className="photo-upload-grid">
          <div className="photo-upload-form">
            <input
              className="operation-input"
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              placeholder="Título da foto"
            />
            <input
              className="operation-input"
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              placeholder="Categoria ou frente da obra"
            />
            <select className="operation-select" value={purpose} onChange={(event) => setPurpose(event.target.value)}>
              <option>Avanço</option>
              <option>Problema</option>
              <option>Segurança</option>
              <option>Retrabalho</option>
            </select>
            <label className="photo-file-label">
              <input type="file" accept="image/*" onChange={handleFileChange} />
              <span>Escolher imagem</span>
            </label>
            <button type="button" className="portfolio-card-button photo-upload-button" onClick={handleAddPhoto} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar na galeria'}
            </button>
            <div className="photo-upload-help">
              As fotos enviadas entram na galeria operacional da obra e, com o Supabase configurado, passam a ficar disponíveis também na base compartilhada do projeto.
            </div>
          </div>

          <div className="photo-upload-preview">
            {preview ? (
              <img src={preview} alt="Prévia do novo registro" className="photo-preview-image" />
            ) : (
              <div className="photo-preview-placeholder">
                A prévia da imagem aparece aqui antes de salvar.
              </div>
            )}
          </div>
        </div>
      </div>

      {fotos[0] ? (
        <div className="surface-card photo-highlight-card animate-in">
          <div className="photo-highlight-grid">
            <div
              className="photo-highlight-hero"
              role="button"
              tabIndex={0}
              onClick={() => setSelectedPhoto(fotos[0])}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedPhoto(fotos[0]);
                }
              }}
              style={fotos[0].image
                ? { backgroundImage: `url(${fotos[0].image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : { background: 'linear-gradient(135deg, #1d4ed8 0%, #38bdf8 45%, #0f766e 100%)' }}
            />
            <div className="photo-highlight-copy">
              <div className="portfolio-eyebrow">Registro em destaque</div>
              <div className="section-card-title" style={{ marginBottom: 8 }}>{fotos[0].titulo}</div>
              <div className="section-card-description" style={{ maxWidth: '100%' }}>
                Última imagem disponível na galeria operacional. Use este bloco para destacar avanço visual, liberação de frente ou situação que precise de aprovação rápida.
              </div>
              <div className="photo-highlight-meta">
                <span className="foto-tag">{fotos[0].tag}</span>
                {fotos[0].purpose ? <span className={`foto-purpose-chip ${String(fotos[0].purpose).toLowerCase()}`}>{fotos[0].purpose}</span> : null}
                <strong>{fotos[0].data}</strong>
              </div>
              <button type="button" className="inline-action-button photo-open-button" onClick={() => setSelectedPhoto(fotos[0])}>
                Abrir foto em destaque
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="photos-grid">
        {fotos.length > 0 ? fotos.map((foto) => (
          <button key={foto.id} type="button" className="foto-card animate-in foto-card-button" onClick={() => setSelectedPhoto(foto)}>
            <div
              className="foto-hero"
              style={foto.image
                ? { backgroundImage: `url(${foto.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : { background: 'linear-gradient(135deg, #1d4ed8 0%, #38bdf8 45%, #0f766e 100%)' }}
            >
              <span className="foto-tag">{foto.tag}</span>
            </div>
            <div className="foto-body">
              {foto.purpose ? <div className={`foto-purpose-chip ${String(foto.purpose).toLowerCase()}`}>{foto.purpose}</div> : null}
              <div className="foto-title">{foto.titulo}</div>
              <div className="foto-date">Registro enviado em {foto.data}</div>
            </div>
          </button>
        )) : (
          <div className="photo-gallery-empty">
            A galeria ainda não tem registros. Assim que a equipe começar a subir fotos, esta área vira a principal base visual da obra.
          </div>
        )}
      </div>

      {selectedPhoto ? (
        <div className="photo-lightbox" role="dialog" aria-modal="true">
          <button type="button" className="photo-lightbox-backdrop" onClick={() => setSelectedPhoto(null)} aria-label="Fechar visualização" />
          <div className="photo-lightbox-panel">
            <button type="button" className="photo-lightbox-close" onClick={() => setSelectedPhoto(null)}>
              Fechar
            </button>
            <div className="photo-lightbox-media">
              {selectedPhoto.image ? (
                <img src={selectedPhoto.image} alt={selectedPhoto.titulo} className="photo-lightbox-image" />
              ) : (
                <div className="photo-lightbox-placeholder">Imagem indisponível neste momento.</div>
              )}
            </div>
            <div className="photo-lightbox-copy">
              <div className="photo-lightbox-title">{selectedPhoto.titulo}</div>
              <div className="photo-lightbox-meta">
                <span className="foto-tag">{selectedPhoto.tag}</span>
                {selectedPhoto.purpose ? <span className={`foto-purpose-chip ${String(selectedPhoto.purpose).toLowerCase()}`}>{selectedPhoto.purpose}</span> : null}
                <strong>{selectedPhoto.data}</strong>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
