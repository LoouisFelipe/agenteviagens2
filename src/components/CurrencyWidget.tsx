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
    {
      code: "USD",
      name: "Dólar",
      rate: 5.24,
      flagUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBP92oHDVklxu-BtJReig85iAlv55cY0YFqp_GLPMZ7W0pM4sRFfMUFCSkkq_0BwVlhmn9sdyVR_PTFAImuOo0cN5zg95e3joe98F-Un4l7PlFm5YNBKpDdmVxONNbTnlCPlgPaTVJodVflmR36WHFzvTM08q-ByfDR1B19ocSPcSUPDnN3QwjJvOS5FwUmnXrhD_HF_XUzFKvOgpEgEjVRgF0A3DchdWQxjsidk68YZBxYjBM5bCBkBzb2fR9O9xLQxedR7O86F_Q"
    },
    {
      code: "EUR",
      name: "Euro",
      rate: 5.71,
      flagUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuATmFz3KDkWoCYJjdqu71_NZ5YfgKXmAWd9m8OI2zLIjxuRrEC75TSQVGYb_5fWDSF0H90uckla-uVupdQgioA3nIYFUk8E20sOyYNNyyYqNl8EPScxGXT0N1sz-KXNOWsNZuFpBmWQr-Lnf4cCX0DuYzwnuc6p88lpPDyYKjZtJ0N2lZ1upFlhee2nunJ5jeSbvrhaaRBQUzzUeaAmTV0ZeNlrtliYpqlxY4gHb8IJ4-a4Y_tCceBVdQSnskwxrlj-Xd4wiRPiG04"
    },
    {
      code: "CLP",
      name: "Peso Chileno",
      rate: 0.0058,
      flagUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuCqFDcQVT-XXPEPFrbYBumko53Q_-t-JDeTgj80lTa7WEthHymFvKUfPCnGNiC8BYvxdc-O1PvDyhOIAJvyi2ujNgszA3eGLYB0Kap1WM9cu96xFJq8B1c4lZq8Ad76DigYyPdSI1xvXHVFZJdBNfhLBwosN6LcNznFGlhq00rTshiaXPckTXCB8uw2rgoo1VRiIONG9YgTpofjBizzPCdcDq0nb-NEN2rVS0-hOq9qkg8KqIwET5yXlJv2xZkUUR2FKfSQfAEGYbw"
    },
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
    <div className="glass-card p-6 select-none h-full flex flex-col justify-between">
      <div>
        <h3 className="font-label-caps text-label-caps text-on-surface-variant mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">currency_exchange</span>
          EXCHANGE_MODULE.v2
        </h3>
        
        {/* Exchange rates display */}
        <div className="space-y-4 mb-8">
          {quotes.map((q) => (
            <div key={q.code} className="flex justify-between items-center p-3 bg-surface-container-low border border-border-glow">
              <span className="font-data-sm text-data-sm text-on-surface-variant flex items-center gap-2">
                <img src={q.flagUrl} alt={q.code} className="w-5 h-3.5 object-cover rounded-sm" />
                {q.code} / BRL
              </span>
              <span className="font-data-lg text-data-lg text-on-surface">
                {q.rate.toFixed(q.code === "CLP" ? 4 : 2)}{" "}
                {q.code === "USD" && <span className="text-[10px] text-error font-sans font-bold">▼ 0.2%</span>}
                {q.code === "EUR" && <span className="text-[10px] text-neon-cyan font-sans font-bold">▲ 0.1%</span>}
                {q.code === "CLP" && <span className="text-[10px] text-on-surface-variant font-sans font-bold">--</span>}
              </span>
            </div>
          ))}
        </div>
        
        {/* Interactive Converter Form */}
        <form onSubmit={handlePredict} className="space-y-3">
          <label className="font-label-caps text-[9px] text-on-surface-variant uppercase">CONVERSION CALCULATOR</label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-transparent border-b border-border-glow focus:border-neon-cyan focus:ring-0 transition-colors text-data-sm py-2 text-on-surface placeholder:text-on-surface-variant/40 rounded-none focus:outline-none"
              min="0.01"
              step="any"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="bg-surface-container-high border-none text-[10px] font-bold text-neon-cyan px-4 rounded-none h-9 cursor-pointer focus:outline-none focus:ring-0"
            >
              <option value="CLP">CLP</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 bg-surface-container-highest text-on-surface font-label-caps text-label-caps hover:bg-surface-variant transition-all cursor-pointer disabled:opacity-40 uppercase border-none font-bold"
          >
            {isLoading ? "CALCULATING..." : "CALCULATE_ESTIMATE"}
          </button>
        </form>
      </div>

      {error && (
        <div className="text-error text-data-sm font-data-sm mt-3">
          ⚠️ {error}
        </div>
      )}

      {/* Conversion Result Insights Box */}
      {(convertedVal !== null || isLoading || predictiveText) && (
        <div className="border border-border-glow bg-surface-container-low/50 p-3 mt-4 text-data-sm font-data-sm leading-relaxed space-y-2 text-on-surface">
          <div className="flex justify-between items-center text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-wider">
            <span>CONVERSÃO & INSIGHTS DA IA</span>
            <span className="w-1.5 h-1.5 bg-neon-cyan rounded-full led-blue animate-pulse" />
          </div>

          {isLoading ? (
            <div className="py-2 text-center text-on-surface-variant/40 font-bold uppercase animate-pulse">
              Executando análise cambial...
            </div>
          ) : (
            <>
              <div className="flex justify-between items-baseline py-1 border-b border-outline-variant">
                <span className="text-on-surface-variant text-[10px] uppercase">Total Convertido:</span>
                <span className="text-lg font-bold text-neon-cyan neon-glow-text font-mono">
                  R$ {convertedVal?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
              
              {rateUsed && (
                <div className="flex justify-between text-[10px] text-on-surface-variant py-0.5">
                  <span>Câmbio aplicado:</span>
                  <span className="font-bold">1 {currency} = R$ {rateUsed.toFixed(5)}</span>
                </div>
              )}

              {predictiveText && (
                <div className="text-[11px] text-on-surface/80 bg-surface/30 p-2 border border-outline-variant rounded whitespace-pre-wrap leading-normal">
                  {predictiveText}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
