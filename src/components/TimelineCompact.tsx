"use client";

import React from "react";
import { RoteiroDiario } from "@/services/travelService";

interface TimelineCompactProps {
  datasViagem: string[];
  roteiroDiario: Record<string, RoteiroDiario>;
  orcamentoMaximo: number;
  onSelecionarDia?: (dataDia: string) => void;
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
    <div className="w-full glass-panel shadow-md p-4 text-xs font-sans select-none relative overflow-hidden rounded-2xl">
      {/* Linha decorativa no topo */}
      <div className="absolute top-0 left-0 w-full h-[2.5px] hazard-stripes" />
      
      {/* Indicadores do Painel da Timeline */}
      <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2 text-[10.5px] font-bold tracking-wide">
        <span className="text-slate-400 uppercase tracking-wider font-black select-none">
          🛰️ VISÃO DIA-A-DIA
        </span>
        <div className="flex items-center space-x-3.5 text-slate-450 font-mono-tech select-none">
          <span>TETO DE VERBA: <span className="text-[#f59e0b] font-bold">R$ {orcamentoMaximo.toLocaleString("pt-BR")}</span></span>
          <span className="text-slate-800 font-normal">|</span>
          <span>ACUMULADO: <span className={`font-bold ${runningTotalAcumulado > orcamentoMaximo ? "text-rose-500" : "text-[#10b981]"}`}>
            R$ {runningTotalAcumulado.toLocaleString("pt-BR")}
          </span></span>
        </div>
      </div>

      {/* Kanban/Linha Horizontal de Nós */}
      <div className="w-full overflow-x-auto flex items-stretch gap-0 py-2.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent min-h-[95px]">
        {nosTimeline.map((no, idx) => {
          const isLast = idx === nosTimeline.length - 1;
          const statusColor = no.estourouOrcamento
            ? "border-rose-500/60 bg-rose-950/10 shadow-md shadow-rose-500/2"
            : "border-slate-800 bg-slate-900/60 shadow-sm shadow-black/10";
          
          const runningColor = no.estourouOrcamento
            ? "text-rose-400"
            : "text-[#10b981]";

          return (
            <div key={no.dataDia} className="flex items-center flex-1 min-w-[175px] relative group select-none">
              
              {/* Card do Nó diário arredondado */}
              <div
                onClick={() => onSelecionarDia?.(no.dataDia)}
                className={`flex-1 border p-3 flex flex-col justify-between ${statusColor} relative h-[82px] rounded-xl hover:border-slate-700/60 transition-all duration-200 cursor-pointer active:scale-[0.98] select-none`}
              >
                {no.estourouOrcamento && (
                  <div className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full animate-ping led-red" title="Teto de Orçamento Excedido neste dia" />
                )}
                
                {/* Linha 1: Dia e Data */}
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 font-bold">DIA {String(no.diaNumero).padStart(2, "0")}</span>
                  <span className="text-slate-500 font-semibold font-mono-tech">{no.labelData}</span>
                </div>

                {/* Linha 2: Marcadores Rápidos */}
                <div className="flex items-center space-x-2 my-0.5 select-none font-sans">
                  <span
                    className={`text-[8.5px] px-1.5 py-0.5 font-bold rounded-md transition-all duration-150 border-0 ${
                      no.hasHospedagem ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-950/40 text-slate-650"
                    }`}
                    title={no.hasHospedagem ? "Hospedagem Alocada" : "Sem Hospedagem"}
                  >
                    HOSP
                  </span>
                  <span
                    className={`text-[8.5px] px-1.5 py-0.5 font-bold rounded-md transition-all duration-150 border-0 ${
                      no.qtdeAtividades > 0 ? "bg-cyan-500/10 text-cyan-400" : "bg-slate-950/40 text-slate-650"
                    }`}
                    title={`${no.qtdeAtividades} Atividade(s) Escalada(s)`}
                  >
                    ATV: {no.qtdeAtividades}
                  </span>
                </div>

                {/* Linha 3: Orçamentos */}
                <div className="flex items-center justify-between text-[9px] font-mono-tech leading-none">
                  <span className="text-slate-455" title="Custo individual do dia">
                    DIA: R$ {no.totalDia}
                  </span>
                  <span className={`${runningColor} font-bold`} title="Soma acumulativa total até este dia">
                    ACUM: R$ {no.runningTotal}
                  </span>
                </div>

                {/* Micro barra de progresso acumulado */}
                {orcamentoMaximo > 0 && (
                  <div className="w-full h-[3px] bg-slate-950 rounded-full overflow-hidden flex select-none mt-1 relative">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        no.estourouOrcamento ? "bg-rose-500" : "bg-indigo-500"
                      }`}
                      style={{ width: `${orcamentoMaximo > 0 ? Math.min(100, Math.round((no.runningTotal / orcamentoMaximo) * 100)) : 0}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Conector Line entre os nós */}
              {!isLast && (
                <div className="w-6 flex flex-col items-center justify-center relative select-none">
                  <div className={`h-[2px] w-full rounded-full ${no.estourouOrcamento ? "bg-rose-900/60" : "bg-slate-800/80"}`} />
                  <span className={`text-[8px] absolute font-bold leading-none ${no.estourouOrcamento ? "text-rose-500" : "text-slate-650"}`}>➔</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
