import React from 'react';

export default function SectionIntroCard({ titulo, descricao, image, imageAlt }) {
  return (
    <div className="section-card animate-in stagger-1">
      <div className={`section-card-layout ${image ? 'has-media' : ''}`}>
        <div>
          <div className="section-card-title">{titulo}</div>
          <div className="section-card-description">{descricao}</div>
        </div>
        {image ? (
          <div className="section-card-media">
            <img src={image} alt={imageAlt || titulo} className="section-card-image" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
