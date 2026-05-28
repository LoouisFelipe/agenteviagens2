"use client";

import React from "react";
import { Viagem } from "@/services/travelService";

interface TripSelectorProps {
  viagens: Viagem[];
  viagemAtiva: Viagem | null;
  onSelecionarViagem: (id: string) => void;
  onToggleFormCriacao: () => void;
  isFormCriacaoAberto: boolean;
  onToggleFormEdicao: () => void;
}

export default function TripSelector({
  viagens,
  viagemAtiva,
  onSelecionarViagem,
  onToggleFormCriacao,
  isFormCriacaoAberto,
  onToggleFormEdicao,
}: TripSelectorProps) {
  return (
    <div className="w-full glass-panel shadow-md p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs select-none rounded-xl">
      {/* Lado Esquerdo - Status da Rota Ativa */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center space-x-2.5 bg-slate-950/50 px-3 py-2 border border-slate-850 h-10 rounded-lg">
          <div className="w-2.5 h-2.5 bg-[#10b981] led-green rounded-full animate-pulse" />
          <div className="font-mono-tech text-slate-300">
            DISPATCHER ACTIVE | OPERATOR: <span className="text-[#10b981] font-bold">OP-01</span>
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
            Selecione a Rota de Operação:
          </span>
          <div className="relative mt-1">
            <select
              value={viagemAtiva?.id || ""}
              onChange={(e) => onSelecionarViagem(e.target.value)}
              className="w-full md:w-80 bg-slate-950 border border-slate-800 text-slate-200 px-3.5 py-1.5 focus:border-indigo-500 focus:outline-none font-mono-tech cursor-pointer hover:bg-slate-900 transition-colors uppercase rounded-lg shadow-inner"
            >
              {viagens.length === 0 ? (
                <option value="">NENHUMA ROTA ENCONTRADA</option>
              ) : (
                viagens.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.origem} ➔ {v.destino} ({v.data_inicio} a {v.data_fim})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Lado Direito - Painel de Detalhes Rápidos / Ação */}
      <div className="flex items-center gap-3">
        {viagemAtiva && (
          <div className="hidden lg:flex flex-col text-right font-mono-tech bg-slate-900/30 border border-slate-800/40 px-3.5 py-1 rounded-lg">
            <span className="text-[9px] text-slate-500 font-bold uppercase">ID DE RASTREAMENTO</span>
            <span className="text-[#f59e0b] font-semibold text-[10px] uppercase tracking-wide">
              {viagemAtiva.id}
            </span>
          </div>
        )}

        {viagemAtiva && (
          <button
            onClick={onToggleFormEdicao}
            className="h-10 px-4.5 flex items-center font-bold tracking-wide uppercase transition-all duration-200 border border-slate-700 hover:border-slate-500 text-slate-300 hover:bg-slate-800/30 cursor-pointer rounded-lg font-sans text-xs select-none shadow-md hover:scale-[1.02] active:scale-[0.98]"
          >
            [ ✏️ Editar Rota ]
          </button>
        )}

        <button
          onClick={onToggleFormCriacao}
          className={`h-10 px-5 flex items-center font-bold tracking-wide uppercase transition-all duration-200 border-0 cursor-pointer rounded-lg font-sans text-xs select-none shadow-md ${
            isFormCriacaoAberto
              ? "bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-rose-500/10 hover:shadow-rose-500/20"
              : "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-indigo-500/10 hover:shadow-indigo-500/20"
          } hover:scale-[1.02] active:scale-[0.98]`}
        >
          {isFormCriacaoAberto ? "[ CANCELAR CADASTRO ]" : "[ + REGISTRAR NOVA ROTA ]"}
        </button>
      </div>
    </div>
  );
}
