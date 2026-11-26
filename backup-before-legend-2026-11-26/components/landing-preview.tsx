"use client";
import { useEffect, useRef, useState } from "react";
import { Search, Radar, TrendingUp, Sparkles, Activity, BarChart3 } from "lucide-react";

/** Prévia animada do workspace (ilustrativa), no estilo da página de instalação da extensão. */
function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (!("IntersectionObserver" in window)) { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el); return () => io.disconnect();
  }, []);
  return { ref, seen };
}

function CountUp({ to, decimals = 0, suffix = "", run }: { to: number; decimals?: number; suffix?: string; run: boolean }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setV(to); return; }
    let raf = 0; const start = performance.now(); const dur = 1400;
    const tick = (t: number) => { const p = Math.min(1, (t - start) / dur); setV(to * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [run, to]);
  return <>{v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>;
}

const LINE = "M0,92 C30,88 45,70 75,72 C105,74 120,86 150,80 C180,74 195,54 225,56 C255,58 270,66 300,58 C330,50 345,34 375,38 C405,42 420,48 450,36 C480,24 495,30 520,22";
const BARS = [38, 52, 44, 61, 57, 72, 66, 84, 78, 92];

export default function LandingPreview() {
  const { ref, seen } = useInView<HTMLDivElement>();
  const nav = [[Search, "SEO Explorer"], [Radar, "Channel Intel"], [TrendingUp, "ViewsStats"], [Sparkles, "IA Studio"], [Activity, "Trends"]] as const;
  return (
    <div ref={ref} className={`tx-lp ${seen ? "is-on" : ""}`}>
      <div className="tx-lp-chrome">
        <span className="tx-lp-dots"><i /><i /><i /></span>
        <span className="tx-lp-title"><b>Tube<em>X</em></b> ANALYTICS WORKSPACE</span>
        <span className="tx-lp-tag">PRÉVIA</span>
      </div>
      <div className="tx-lp-body">
        <aside className="tx-lp-side">
          <p>WORKSPACE</p>
          {nav.map(([Icon, label], i) => <div key={label} className={`tx-lp-nav ${i === 0 ? "is-active" : ""}`}><Icon size={13} />{label}</div>)}
          <p className="mt-4">INSIGHTS</p>
          <div className="tx-lp-nav"><BarChart3 size={13} />Engajamento</div>
        </aside>
        <div className="tx-lp-main">
          <div className="tx-lp-head"><b>Visão geral</b><span>PRÉVIA ILUSTRATIVA</span></div>
          <div className="tx-lp-search"><Search size={13} /><span className="tx-lp-typing">como crescer no youtube 2026</span><button type="button" tabIndex={-1}>ANALISAR</button></div>
          <div className="tx-lp-cards">
            <div><small>SEO SCORE</small><b><CountUp to={86} run={seen} /></b><span className="is-good">Indicador</span></div>
            <div><small>VOLUME</small><b><CountUp to={7.8} decimals={1} suffix="k" run={seen} /></b><span className="is-blue">Estimativa</span></div>
            <div><small>COMPETIÇÃO</small><b>Baixa</b><span className="is-good">Oportunidade</span></div>
          </div>
          <div className="tx-lp-chart">
            <div className="tx-lp-chart-head"><span>Indicadores de tendência</span><span className="tx-lp-live"><i />ao vivo</span></div>
            <svg viewBox="0 0 520 110" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="txlpfill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#3b82f6" stopOpacity=".35" /><stop offset="1" stopColor="#3b82f6" stopOpacity="0" /></linearGradient>
              </defs>
              {BARS.map((h, i) => <rect key={i} className="tx-lp-bar" style={{ animationDelay: `${i * 70}ms` }} x={i * 52 + 14} y={110 - h * 0.9} width="24" height={h * 0.9} rx="4" />)}
              <path className="tx-lp-area" d={`${LINE} L520,110 L0,110 Z`} fill="url(#txlpfill)" />
              <path className="tx-lp-line" d={LINE} fill="none" stroke="#5b9bff" strokeWidth="2.5" strokeLinecap="round" pathLength={1} />
              <circle className="tx-lp-dot" cx="520" cy="22" r="4.5" fill="#f2c94c" />
            </svg>
          </div>
        </div>
      </div>
      <div className="tx-lp-foot">
        <div><b>SEO &amp; Pesquisa</b><span>Encontre temas para investigar</span></div>
        <div><b>Channel Intelligence</b><span>Entenda seu cenário competitivo</span></div>
        <div><b>IA &amp; Performance</b><span>Otimize seu processo criativo</span></div>
      </div>
    </div>
  );
}
