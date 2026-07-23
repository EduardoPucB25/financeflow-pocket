import { useMemo } from "react";

/**
 * Fondo cósmico: estrellas parpadeando, monedas/billetes cruzando como cometas,
 * y "planetas" en forma de bolsas de monedas orbitando.
 */
export function CosmicBackground() {
  const stars = useMemo(
    () =>
      Array.from({ length: 90 }).map((_, i) => ({
        id: i,
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: Math.random() * 2 + 0.5,
        delay: Math.random() * 4,
        duration: 2 + Math.random() * 4,
      })),
    []
  );

  const comets = useMemo(
    () =>
      Array.from({ length: 6 }).map((_, i) => ({
        id: i,
        top: Math.random() * 80,
        delay: i * 3 + Math.random() * 4,
        duration: 6 + Math.random() * 5,
        symbol: i % 2 === 0 ? "$" : "€",
      })),
    []
  );

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[radial-gradient(ellipse_at_top,_#1a1043_0%,_#0a0620_45%,_#02010a_100%)]">
      {/* Nebulosa suave */}
      <div className="absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px]" />
      <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-accent/20 blur-[120px]" />

      {/* Estrellas */}
      {stars.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}

      {/* Planetas / bolsas de monedas */}
      <MoneyPlanet className="left-[8%] top-[15%] h-24 w-24" hue="#facc15" delay={0} />
      <MoneyPlanet className="right-[10%] top-[30%] h-16 w-16" hue="#34d399" delay={4} />
      <MoneyPlanet className="left-[15%] bottom-[12%] h-20 w-20" hue="#a78bfa" delay={8} />
      <MoneyPlanet className="right-[18%] bottom-[20%] h-14 w-14" hue="#f472b6" delay={2} />

      {/* Cometas de monedas/billetes */}
      {comets.map((c) => (
        <span
          key={c.id}
          className="absolute -left-24 flex items-center gap-2 text-yellow-300 drop-shadow-[0_0_12px_rgba(250,204,21,0.9)]"
          style={{
            top: `${c.top}%`,
            animation: `comet ${c.duration}s linear ${c.delay}s infinite`,
          }}
        >
          <span className="block h-[2px] w-24 bg-gradient-to-r from-transparent via-yellow-300/70 to-yellow-200" />
          <span className="text-2xl font-bold">{c.symbol}</span>
        </span>
      ))}

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes comet {
          0% { transform: translate(0, 0) rotate(15deg); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translate(120vw, 30vh) rotate(15deg); opacity: 0; }
        }
        @keyframes float-planet {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-14px) rotate(6deg); }
        }
      `}</style>
    </div>
  );
}

function MoneyPlanet({
  className,
  hue,
  delay,
}: {
  className: string;
  hue: string;
  delay: number;
}) {
  return (
    <div
      className={`absolute ${className}`}
      style={{ animation: `float-planet 8s ease-in-out ${delay}s infinite` }}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <defs>
          <radialGradient id={`g-${hue}`} cx="35%" cy="30%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
            <stop offset="40%" stopColor={hue} stopOpacity="0.95" />
            <stop offset="100%" stopColor="#1a0a3a" stopOpacity="1" />
          </radialGradient>
        </defs>
        {/* Bolsa */}
        <path
          d="M30 40 Q50 20 70 40 Q85 55 78 78 Q65 95 50 95 Q35 95 22 78 Q15 55 30 40 Z"
          fill={`url(#g-${hue})`}
          stroke={hue}
          strokeWidth="1.5"
        />
        {/* Cuerda de la bolsa */}
        <path
          d="M35 40 Q40 30 45 35 M55 35 Q60 30 65 40"
          fill="none"
          stroke={hue}
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Símbolo $ */}
        <text
          x="50"
          y="72"
          textAnchor="middle"
          fontSize="30"
          fontWeight="bold"
          fill="#fff"
          opacity="0.9"
        >
          $
        </text>
      </svg>
    </div>
  );
}
