import React from 'react';

export default function MobileQuickBar({
  obra,
  navAtiva,
  portfolioFocus,
  onSelectNav,
  onOpenPortfolio,
  onOpenPriorityObra,
  onOpenPortfolioAssistant,
  onOpenPortfolioAlerts,
}) {
  const actions = obra ? [
    { id: 'visao', label: 'Visão', active: navAtiva === 'visao', onClick: () => onSelectNav('visao') },
    { id: 'operacao', label: 'Operação', active: navAtiva === 'operacao', onClick: () => onSelectNav('operacao') },
    { id: 'assistente', label: 'IA', active: navAtiva === 'assistente', onClick: () => onSelectNav('assistente') },
    { id: 'fotos', label: 'Fotos', active: navAtiva === 'fotos', onClick: () => onSelectNav('fotos') },
  ] : [
    { id: 'portfolio', label: 'Portfólio', active: navAtiva === 'visao', onClick: onOpenPortfolio },
    { id: 'prioritaria', label: 'Prioridade', active: portfolioFocus === 'prioritaria', onClick: onOpenPriorityObra },
    { id: 'ia', label: 'IA', active: navAtiva === 'assistente_portfolio', onClick: onOpenPortfolioAssistant },
    { id: 'alertas', label: 'Alertas', active: portfolioFocus === 'alerts', onClick: onOpenPortfolioAlerts },
  ];

  return (
    <div className="mobile-quickbar">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className={`mobile-quickbar-item ${action.active ? 'active' : ''}`}
          onClick={action.onClick}
        >
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}
