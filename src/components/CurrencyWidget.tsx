"use client";

import React, { useState } from "react";
import { emitLog } from "@/services/travelService";

interface CurrencyWidgetProps {
  destino: string;
}

export default function CurrencyWidget({ destino }: CurrencyWidgetProps) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("CLP");
  const [isLoading, setIsLoading] = useState(false);
  const [convertedVal, setConvertedVal] = useState<number | null>(null);
  const [rateUsed, setRateUsed] = useState<number | null>(null);
  const [predictiveText, setPredictiveText] = useState("");
  const [error, setError] = useState("");

  const quotes = [
    { code: "USD", name: "Dólar", rate: 5.25, icon: "💵" },
    { code: "EUR", name: "Euro", rate: 5.65, icon: "💶" },
    { code: "CLP", name: "Peso Chileno", rate: 0.0054, icon: "🇨🇱", detail: "1 BRL = 185 CLP" },
  ];

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setConvertedVal(null);
    setPredictiveText("");

    const numVal = Number(amount);
    if (!amount || isNaN(numVal) || numVal <= 0) {
      setError("Insira um valor válido.");
      return;
    }

    setIsLoading(true);
    emitLog(`REQUEST: Solicitando análise cambial preditiva de ${amount} ${currency} para ${destino || "destino"}...`);

    try {
      const res = await fetch("/api/predict-currency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: numVal,
          currency,
          destination: destino || "Destino",
        }),
      });

      if (!res.ok) {
        throw new Error("Erro na resposta da API.");
      }

      const data = await res.json();
      setConvertedVal(data.brlAmount);
      setRateUsed(data.predictedRate);
      setPredictiveText(data.predictiveTip);
      emitLog(`SYSTEM: Análise preditiva de câmbio concluída para ${currency} -> BRL.`);
    } catch (err) {
      console.error(err);
      setError("Falha na previsão de câmbio.");
      emitLog("SYSTEM ERROR: Falha na cotação preditiva de câmbio via IA.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full select-none">
      <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 shadow-md relative overflow-hidden flex flex-col justify-between space-y-4">
        <div className="absolute top-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-cyan-500 to-indigo-600" />
        
        <div className="space-y-3">
          <h3 className="text-[10px] font-black uppercase text-cyan-400 tracking-wider flex items-center gap-1.5">
            <span>🪙</span>
            <span>Câmbio Operacional Preditivo</span>
          </h3>

          {/* Quick Rates grid */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {quotes.map((q) => (
              <div
                key={q.code}
                className="bg-slate-950/50 border border-slate-850 p-2.5 rounded-xl flex flex-col items-center justify-center text-center shadow-inner relative hover:border-cyan-500/30 transition-colors group"
              >
                <span className="text-base mb-1">{q.icon}</span>
                <span className="text-[9px] font-black text-slate-200 font-mono">{q.code}</span>
                <span className="text-[11px] font-black text-emerald-400 font-mono mt-0.5">
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

          {/* Interactive Calculator Form */}
          <form onSubmit={handlePredict} className="border-t border-slate-850 pt-3 space-y-3">
            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
              Simulador Preditivo Inteligente (BRL)
            </div>

            <div className="grid grid-cols-12 gap-2 text-[10px]">
              <div className="col-span-5 flex flex-col">
                <input
                  type="number"
                  placeholder="Quantidade"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-slate-950 border border-slate-850 text-slate-100 px-3 py-1.5 placeholder-slate-750 text-[10px] rounded-lg focus:outline-none focus:border-cyan-500 font-mono"
                  min="0.01"
                  step="any"
                />
              </div>
              <div className="col-span-3">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 text-slate-300 px-2 py-1.5 focus:outline-none cursor-pointer uppercase font-bold text-[9.5px] rounded-lg h-9"
                >
                  <option value="CLP">CLP</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div className="col-span-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-9 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[9px] rounded-lg uppercase cursor-pointer border-0 shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {isLoading ? "Consultando..." : "✨ Prever"}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-rose-500 text-[8.5px] font-mono leading-none">
                ⚠️ {error}
              </div>
            )}
          </form>

          {/* Result Terminal Box */}
          {(convertedVal !== null || isLoading || predictiveText) && (
            <div className="border border-slate-850 bg-slate-950/70 p-3 rounded-xl space-y-2 font-mono text-[10px] leading-relaxed">
              <div className="flex justify-between items-center text-[9px] text-slate-500 uppercase tracking-wider">
                <span>CONVERSÃO & INSIGHTS DA IA</span>
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full led-blue animate-pulse" />
              </div>

              {isLoading ? (
                <div className="py-2 text-center text-slate-500 font-bold uppercase animate-pulse text-[9px]">
                  Executando análise cambial preditiva...
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-baseline py-1 border-b border-slate-900">
                    <span className="text-slate-455 font-bold uppercase text-[9px]">Total Convertido:</span>
                    <span className="text-xl font-black text-emerald-400 font-mono tracking-wide">
                      R$ {convertedVal?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  
                  {rateUsed && (
                    <div className="flex justify-between text-[8px] text-slate-500 py-0.5">
                      <span>Câmbio preditivo aplicado:</span>
                      <span className="font-bold">1 {currency} = R$ {rateUsed.toFixed(5)}</span>
                    </div>
                  )}

                  {predictiveText && (
                    <div className="text-[9px] text-slate-300 bg-slate-900/40 p-2 border border-slate-900 rounded-lg whitespace-pre-wrap leading-normal">
                      {predictiveText}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="text-[8.5px] text-slate-500 font-mono font-bold uppercase text-center border-t border-slate-850/60 pt-2.5">
          Câmbio preditivo com dados do Banco Central e IA
        </div>
      </div>
    </div>
  );
}
