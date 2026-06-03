"use client";

import React, { useState, useEffect } from "react";

interface CurrencyWidgetProps {
  destino: string;
}

export default function CurrencyWidget({ destino }: CurrencyWidgetProps) {
  // Mock exchange rates corresponding to travelService
  const quotes = [
    { code: "USD", name: "Dólar Comercial", rate: 5.25, icon: "💵" },
    { code: "EUR", name: "Euro", rate: 5.65, icon: "💶" },
    { code: "CLP", name: "Peso Chileno", rate: 0.0054, icon: "🇨🇱", detail: "1 BRL = 185 CLP" },
  ];

  // Mock Flight Data
  const [flightProgress, setFlightProgress] = useState(65);

  useEffect(() => {
    const timer = setInterval(() => {
      setFlightProgress((prev) => (prev >= 100 ? 0 : prev + 1));
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full select-none">
      {/* Câmbio / Cotações Rápidas */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 shadow-md relative overflow-hidden flex flex-col justify-between space-y-4">
        <div className="absolute top-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-indigo-500 to-purple-600" />
        <div className="space-y-3">
          <h3 className="text-[10px] font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
            <span>🪙</span>
            <span>Câmbio de Moedas (Ref. BRL)</span>
          </h3>
          <div className="grid grid-cols-3 gap-2 pt-1">
            {quotes.map((q) => (
              <div
                key={q.code}
                className="bg-slate-950/50 border border-slate-850 p-2.5 rounded-xl flex flex-col items-center justify-center text-center shadow-inner relative hover:border-indigo-500/30 transition-colors group"
              >
                <span className="text-base mb-1">{q.icon}</span>
                <span className="text-[9px] font-black text-slate-200 font-mono-tech">{q.code}</span>
                <span className="text-[11px] font-black text-emerald-450 font-mono-tech mt-0.5">
                  R$ {q.rate.toFixed(4)}
                </span>
                {q.detail && (
                  <span className="text-[6.5px] text-slate-550 font-bold uppercase mt-1">
                    {q.detail}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="text-[8.5px] text-slate-500 font-mono-tech font-bold uppercase text-center border-t border-slate-850/60 pt-2.5">
          Cotações locais de câmbio fixadas
        </div>
      </div>

      {/* Flight Tracker Decorativo */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 shadow-md relative overflow-hidden flex flex-col justify-between space-y-4">
        <div className="absolute top-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-blue-500 to-indigo-500" />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase text-blue-400 tracking-wider flex items-center gap-1.5">
              <span>✈️</span>
              <span>Flight Tracker (Decorativo)</span>
            </h3>
            <span className="text-[7.5px] bg-emerald-500/20 text-[#10b981] font-black px-1.5 py-0.5 rounded leading-none led-green uppercase">
              Em Rota
            </span>
          </div>

          <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl space-y-3 shadow-inner">
            <div className="flex items-center justify-between text-[10px]">
              <div>
                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider block">Origem</span>
                <span className="font-black text-slate-200">GRU</span>
                <span className="text-[8.5px] text-slate-400 font-medium block">08:15</span>
              </div>
              <div className="flex-1 flex flex-col items-center px-4 relative">
                <span className="text-[8.5px] font-mono-tech font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">
                  LA-8024
                </span>
                <div className="w-full h-1 bg-slate-900 rounded-full relative overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                    style={{ width: `${flightProgress}%` }}
                  />
                  <div
                    className="absolute -top-0.5 w-2 h-2 bg-indigo-400 rounded-full border border-slate-950 animate-ping"
                    style={{ left: `${flightProgress}%` }}
                  />
                </div>
                <span className="text-[7px] text-slate-500 uppercase font-bold mt-1 tracking-wider">
                  Progresso: {flightProgress}%
                </span>
              </div>
              <div className="text-right">
                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider block">Destino</span>
                <span className="font-black text-slate-200">
                  {destino.includes("Santiago") || destino.includes("Chile") ? "SCL" : "CDG"}
                </span>
                <span className="text-[8.5px] text-slate-400 font-medium block">12:35</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center text-[8.5px] text-slate-500 font-mono-tech font-bold uppercase border-t border-slate-850/60 pt-2.5">
          <span>PORTÃO: T3-G32</span>
          <span>ASSENTO: 12C (CONFIRMADO)</span>
        </div>
      </div>
    </div>
  );
}
