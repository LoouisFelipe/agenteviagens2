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
  const [isExpanded, setIsExpanded] = React.useState(false);
  
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

  // Localiza o nó do dia ativo para exibir no estado recolhido
  const noAtivo = nosTimeline.find((no) => no.dataDia === diaAtivoWorkspace) || nosTimeline[0];

  return (
    <div className="w-full flex flex-col gap-2 select-none">
      {/* O Card Principal Collapsed */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full glass-panel shadow-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer rounded-2xl border transition-all duration-300 relative overflow-hidden select-none hover:scale-[1.005] active:scale-[0.995] ${
          isExpanded ? "border-indigo-500/50 shadow-indigo-500/5" : "border-slate-800 hover:border-slate-750"
        }`}
      >
        {/* Linha decorativa no topo */}
        <div className="absolute top-0 left-0 w-full h-[2.5px] hazard-stripes" />

        {/* Lado Esquerdo - Resumo do Dia Selecionado */}
        <div className="flex items-center gap-3">
          <div className="text-xl">🛰️</div>
          <div>
            <div className="text-[9px] font-mono-tech text-slate-500 uppercase tracking-widest leading-none">Grade Operacional</div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-slate-105 font-black text-xs uppercase font-sans">
                {noAtivo ? `DIA ${String(noAtivo.diaNumero).padStart(2, "0")}` : "NENHUM DIA SELECIONADO"}
              </span>
              <span className="text-slate-750 font-normal">|</span>
              <span className="text-indigo-400 font-bold font-mono-tech text-[10.5px]">
                {noAtivo ? noAtivo.labelData : ""}
              </span>
              {noAtivo && (
                <>
                  <span className="text-slate-750 font-normal">|</span>
                  <span className={`text-[8.5px] px-1.5 py-0.5 font-extrabold rounded-md ${
                    noAtivo.hasHospedagem ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-950/65 text-slate-650"
                  }`}>
                    🏨 {noAtivo.hasHospedagem ? "HOSPEDAGEM RES." : "SEM HOSP."}
                  </span>
                  <span className="text-slate-750 font-normal">|</span>
                  <span className={`text-[8.5px] px-1.5 py-0.5 font-extrabold rounded-md ${
                    noAtivo.qtdeAtividades > 0 ? "bg-cyan-500/10 text-cyan-400" : "bg-slate-950/65 text-slate-650"
                  }`}>
                    🧭 {noAtivo.qtdeAtividades} PASSEIOS
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Lado Direito - Status de Gastos do Dia & Botão de Expandir */}
        <div className="flex items-center gap-4 flex-wrap">
          {noAtivo && (
            <div className="flex items-center gap-3 font-mono-tech text-[10px] bg-slate-950/40 px-3 py-1.5 border border-slate-850 rounded-lg shadow-inner select-none">
              <span className="text-slate-500">DIA: R$ {noAtivo.totalDia}</span>
              <span className="text-slate-750">|</span>
              <span className={`${noAtivo.estourouOrcamento ? "text-rose-400 font-black" : "text-[#10b981]"} font-bold`}>
                ACUMULADO: R$ {noAtivo.runningTotal}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 py-1.5 px-3.5 bg-indigo-600/10 border border-indigo-500/35 text-indigo-400 hover:text-indigo-300 font-bold text-[9.5px] uppercase transition-all rounded-lg cursor-pointer select-none">
            <span>{isExpanded ? "Recolher Grade" : "Selecionar outro dia"}</span>
            <span className="text-[10px] font-bold">{isExpanded ? "▲" : "▼"}</span>
          </div>
        </div>
      </div>

      {/* Grid de Dias Expandido (Renderiza apenas quando isExpanded é true) */}
      {isExpanded && (
        <div className="w-full glass-panel shadow-2xl p-4 text-xs font-sans rounded-2xl relative overflow-hidden border border-slate-800/80 workspace-fade-in transition-all duration-300 select-none">
          <div className="absolute top-0 left-0 w-full h-[2px] hazard-stripes-dark" />
          <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2 text-[10px] font-bold tracking-wide">
            <span className="text-slate-500 uppercase tracking-wider font-black select-none">
              SELECIONE O DIA DA OPERAÇÃO:
            </span>
            <span className="text-slate-500 font-mono-tech font-normal text-[8.5px] lowercase italic hidden sm:inline">
              clique em um card para fechar e carregar os dados no workspace
            </span>
          </div>

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
                  onClick={() => {
                    onSelecionarDia?.(no.dataDia);
                    setIsExpanded(false); // Auto-recolhe ao selecionar
                  }}
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
      )}
    </div>
  );
}
