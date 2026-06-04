"use client";

import React from "react";

export default function CurrencyWidget() {
  // Mock exchange rates corresponding to travelService
  const quotes = [
    { code: "USD", name: "Dólar Comercial", rate: 5.25, icon: "💵" },
    { code: "EUR", name: "Euro", rate: 5.65, icon: "💶" },
    { code: "CLP", name: "Peso Chileno", rate: 0.0054, icon: "🇨🇱", detail: "1 BRL = 185 CLP" },
  ];

  return (
    <div className="w-full select-none">
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
    </div>
  );
}
