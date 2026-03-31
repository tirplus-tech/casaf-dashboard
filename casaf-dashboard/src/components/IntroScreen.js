import React from 'react';

export default function IntroScreen({ onEnter }) {
  return (
    <div className="intro-screen">
      <div className="intro-shell">
        <div className="intro-mark-wrap">
          <img src={`${process.env.PUBLIC_URL || ''}/casaf-logo.png`} alt="CASAF" className="intro-mark" />
        </div>

        <div className="intro-copy">
          <span className="intro-kicker">Sistema CASAF</span>
          <h1>Gestão de obras com presença, clareza e ritmo.</h1>
          <p>Uma entrada mais limpa, mais sofisticada e mais alinhada com a experiência do produto.</p>
        </div>

        <div className="intro-footer">
          <button type="button" onClick={onEnter} className="intro-button">Entrar</button>
          <span className="intro-note">Ambiente seguro para operação, planejamento e financeiro</span>
        </div>
      </div>

      <style>{`
        .intro-screen {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
          background:
            radial-gradient(circle at top left, rgba(59, 130, 246, 0.16), transparent 22%),
            radial-gradient(circle at bottom right, rgba(45, 212, 191, 0.12), transparent 20%),
            linear-gradient(145deg, #05111f 0%, #0a1d35 48%, #112d4f 100%);
          font-family: "Avenir Next", "Segoe UI", sans-serif;
          color: #f8fbff;
        }

        .intro-shell {
          width: min(760px, 100%);
          padding: 52px 48px 42px;
          border-radius: 32px;
          border: 1px solid rgba(191, 219, 254, 0.12);
          background: linear-gradient(180deg, rgba(8, 18, 35, 0.78), rgba(8, 18, 35, 0.58));
          box-shadow: 0 28px 80px rgba(2, 6, 23, 0.34);
          backdrop-filter: blur(24px);
          text-align: center;
        }

        .intro-mark-wrap {
          width: 108px;
          height: 108px;
          margin: 0 auto 28px;
          border-radius: 28px;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.04));
          border: 1px solid rgba(191, 219, 254, 0.14);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 40px rgba(15, 23, 42, 0.26);
        }

        .intro-mark {
          width: 62px;
          height: 62px;
          object-fit: contain;
          display: block;
        }

        .intro-kicker {
          display: inline-block;
          margin-bottom: 14px;
          color: rgba(191, 219, 254, 0.82);
          font-size: 12px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .intro-copy h1 {
          margin: 0;
          font-size: clamp(38px, 7vw, 64px);
          line-height: 0.96;
          letter-spacing: -0.05em;
        }

        .intro-copy p {
          margin: 18px auto 0;
          max-width: 520px;
          color: rgba(226, 232, 240, 0.72);
          font-size: 15px;
          line-height: 1.8;
        }

        .intro-footer {
          margin-top: 34px;
          display: grid;
          gap: 14px;
          justify-items: center;
        }

        .intro-button {
          min-width: 180px;
          padding: 15px 24px;
          border: none;
          border-radius: 999px;
          background: linear-gradient(135deg, #dbeafe 0%, #99f6e4 100%);
          color: #07111e;
          font: inherit;
          font-weight: 700;
          letter-spacing: 0.02em;
          cursor: pointer;
          box-shadow: 0 16px 32px rgba(153, 246, 228, 0.16);
          transition: transform 180ms ease, box-shadow 180ms ease;
        }

        .intro-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 20px 36px rgba(153, 246, 228, 0.2);
        }

        .intro-note {
          color: rgba(191, 219, 254, 0.66);
          font-size: 12px;
          letter-spacing: 0.04em;
        }

        @media (max-width: 640px) {
          .intro-screen {
            padding: 16px;
            align-items: stretch;
          }

          .intro-shell {
            width: 100%;
            min-height: calc(100vh - 32px);
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 32px 22px 26px;
            border-radius: 24px;
          }

          .intro-mark-wrap {
            width: 88px;
            height: 88px;
            border-radius: 24px;
          }

          .intro-mark {
            width: 52px;
            height: 52px;
          }

          .intro-copy h1 {
            font-size: clamp(30px, 11vw, 42px);
            line-height: 1;
          }

          .intro-copy p {
            font-size: 14px;
            line-height: 1.75;
          }

          .intro-button {
            width: 100%;
            min-width: 0;
            min-height: 50px;
          }
        }

        @media (max-width: 420px) {
          .intro-screen {
            padding: 10px;
          }

          .intro-shell {
            min-height: calc(100vh - 20px);
            padding: 28px 18px 22px;
            border-radius: 20px;
          }

          .intro-kicker,
          .intro-note {
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  );
}
