"use client";
import React from "react";
import { RoteiroDiario } from "@/services/travelService";

interface TimelineCompactProps {
  datasViagem: string[];
  roteiroDiario: Record<string, RoteiroDiario>;
  orcamentoMaximo: number;
  onSelecionarDia?: (dataDia: string) => void;
  diaAtivoWorkspace?: string | null;
}

interface TimelineNo {
  dataDia: string;
  diaNumero: number;
  labelData: string;
  totalDia: number;
  runningTotal: number;
  hasHospedagem: boolean;
  qtdeAtividades: number;
  estourouOrcamento: boolean;
}

export default function TimelineCompact({
  datasViagem,
  roteiroDiario,
  orcamentoMaximo,
  onSelecionarDia,
  diaAtivoWorkspace,
}: TimelineCompactProps) {
  
  // Calcula o total de gastos de um dia específico
  const obterTotalDia = (dataDia: string): number => {
    const diario = roteiroDiario[dataDia];
    if (!diario) return 0;
    const custoHospedagem = diario.hospedagem?.preco_diario || 0;
    const custoAtividades = diario.atividades?.reduce((acc, act) => acc + act.valor, 0) || 0;
    return custoHospedagem + custoAtividades;
  };

  // Monta a lista de nós com os running totals
  let runningTotalAcumulado = 0;
  const nosTimeline: TimelineNo[] = datasViagem.map((dataDia, index) => {
    const totalDia = obterTotalDia(dataDia);
    runningTotalAcumulado += totalDia;
    const diario = roteiroDiario[dataDia] || { hospedagem: null, atividades: [] };
    const dateObj = new Date(dataDia + "T12:00:00");
    const labelData = dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

    return {
      dataDia,
      diaNumero: index + 1,
      labelData,
      totalDia,
      runningTotal: runningTotalAcumulado,
      hasHospedagem: !!diario.hospedagem,
      qtdeAtividades: diario.atividades?.length || 0,
      estourouOrcamento: runningTotalAcumulado > orcamentoMaximo,
    };
  });

  if (datasViagem.length === 0) return null;

  return (
    <div className="w-full glass-panel shadow-lg p-4 text-xs font-sans select-none relative overflow-hidden rounded-2xl">
      {/* Linha decorativa no topo */}
      <div className="absolute top-0 left-0 w-full h-[2.5px] hazard-stripes" />
      
      {/* Indicadores do Painel da Timeline */}
      <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2 text-[10.5px] font-bold tracking-wide">
        <span className="text-slate-400 uppercase tracking-wider font-black select-none">
          🛰️ GRADE OPERACIONAL DE ROTAS (MICRO-VIEW)
        </span>
        <span className="text-slate-500 font-mono-tech font-normal text-[9px] lowercase italic hidden sm:inline">
          clique em um card para focar no dia
        </span>
      </div>

      {/* Grid Responsivo de Cards de Dia */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 py-1">
        {nosTimeline.map((no) => {
          const isFocado = no.dataDia === diaAtivoWorkspace;
          
          const statusColor = no.estourouOrcamento
            ? isFocado 
              ? "active-focused-day-card border-rose-500/80 shadow-lg shadow-rose-500/10" 
              : "border-rose-950/70 bg-rose-950/5 hover:border-rose-900/60 shadow-sm"
            : isFocado 
              ? "active-focused-day-card" 
              : "border-slate-850 bg-slate-900/40 hover:border-slate-750/70 hover:bg-slate-900/60 shadow-sm";
          
          const runningColor = no.estourouOrcamento
            ? "text-rose-400"
            : "text-[#10b981]";

          return (
            <div
              key={no.dataDia}
              onClick={() => onSelecionarDia?.(no.dataDia)}
              className={`glow-card-3d border p-3 flex flex-col justify-between relative h-[88px] rounded-xl cursor-pointer select-none ${statusColor}`}
            >
              {no.estourouOrcamento && (
                <div className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse led-red" title="Teto de Orçamento Excedido" />
              )}

              {/* Linha 1: Dia e Data */}
              <div className="flex items-center justify-between text-[10px]">
                <span className={`font-black ${isFocado ? "text-indigo-400" : "text-slate-400"}`}>
                  DIA {String(no.diaNumero).padStart(2, "0")}
                </span>
                <span className="text-slate-500 font-bold font-mono-tech text-[9px]">{no.labelData}</span>
              </div>

              {/* Linha 2: Marcadores Rápidos */}
              <div className="flex items-center space-x-1.5 my-1 select-none font-sans">
                <span
                  className={`text-[8px] px-1.5 py-0.5 font-extrabold rounded-md transition-all border-0 ${
                    no.hasHospedagem ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-950/65 text-slate-600"
                  }`}
                  title={no.hasHospedagem ? "Hospedagem Reservada" : "Sem Hospedagem"}
                >
                  HOSP
                </span>
                <span
                  className={`text-[8px] px-1.5 py-0.5 font-extrabold rounded-md transition-all border-0 ${
                    no.qtdeAtividades > 0 ? "bg-cyan-500/10 text-cyan-400" : "bg-slate-950/65 text-slate-600"
                  }`}
                  title={`${no.qtdeAtividades} Atividades`}
                >
                  ATV: {no.qtdeAtividades}
                </span>
              </div>

              {/* Linha 3: Orçamentos */}
              <div className="flex items-center justify-between text-[9px] font-mono-tech leading-none">
                <span className="text-slate-500 font-semibold" title="Total do dia">
                  R$ {no.totalDia}
                </span>
                <span className={`${runningColor} font-bold`} title="Total acumulado">
                  R$ {no.runningTotal}
                </span>
              </div>

              {/* Micro barra de progresso acumulado */}
              {orcamentoMaximo > 0 && (
                <div className="w-full h-[3px] bg-slate-950 rounded-full overflow-hidden flex select-none mt-1.5 relative border border-slate-900/50">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      no.estourouOrcamento ? "bg-rose-500" : "bg-indigo-500"
                    }`}
                    style={{ width: `${Math.min(100, Math.round((no.runningTotal / orcamentoMaximo) * 100))}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
