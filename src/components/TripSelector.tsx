"use client";

import React, { useState } from "react";
import { Viagem } from "@/services/travelService";

interface TripSelectorProps {
  viagens: Viagem[];
  viagemAtiva: Viagem | null;
  onSelecionarViagem: (id: string) => void;
  onToggleFormCriacao: () => void;
  onToggleFormEdicao: () => void;
  onDeletarViagem: (id: string) => Promise<void>;
}

export default function TripSelector({
  viagens,
  viagemAtiva,
  onSelecionarViagem,
  onToggleFormCriacao,
  onToggleFormEdicao,
  onDeletarViagem,
}: TripSelectorProps) {
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  const handleExcluir = async (e: React.MouseEvent, id: string, destino: string) => {
    e.stopPropagation();
    if (confirm(`⚠️ VOCÊ ESTÁ PRESTES A EXCLUIR A VIAGEM PARA [${destino.toUpperCase()}].\nESSA AÇÃO REMOVERÁ DEFINITIVAMENTE TODOS OS DADOS DO SEU BANCO DE DADOS E NÃO PODERÁ SER DESFEITA.\n\nDESEJA CONTINUAR?`)) {
      await onDeletarViagem(id);
    }
  };

  const handleCarregar = (id: string) => {
    onSelecionarViagem(id);
    setIsManagerOpen(false);
  };

  const handleEditar = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFormEdicao();
    setIsManagerOpen(false);
  };

  const handleNovaViagem = () => {
    onToggleFormCriacao();
    setIsManagerOpen(false);
  };

  return (
    <div className="w-full select-none">
      {/* Card "Viagens" Principal na Tela */}
      <div
        onClick={() => setIsManagerOpen(true)}
        className="w-full glass-panel shadow-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer rounded-2xl border border-slate-800 hover:border-slate-750 transition-all duration-300 relative overflow-hidden group/trip hover:scale-[1.002]"
      >
        {/* Faixa decorativa indigo moderna */}
        <div className="absolute top-0 left-0 w-full h-[2.5px] hazard-stripes" />

        {/* Lado Esquerdo - Detalhes da Rota Ativa em Destaque */}
        <div className="flex items-center gap-3.5">
          <div className="text-3xl bg-indigo-500/10 border border-indigo-500/25 p-2 rounded-xl group-hover/trip:bg-indigo-500/15 transition-colors">
            🗺️
          </div>
          <div>
            <div className="text-[9px] font-mono-tech text-slate-500 uppercase tracking-widest leading-none">Roteador Ativo</div>
            {viagemAtiva ? (
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <span className="text-slate-100 font-black text-sm uppercase tracking-wide">
                  {viagemAtiva.origem} ➔ {viagemAtiva.destino}
                </span>
                <span className="text-slate-750 font-normal">|</span>
                <span className="text-indigo-400 font-bold font-mono-tech text-[10.5px]">
                  {viagemAtiva.data_inicio} até {viagemAtiva.data_fim}
                </span>
              </div>
            ) : (
              <div className="mt-1 text-slate-400 font-bold uppercase text-xs">
                NENHUMA ROTA ATIVA SELECIONADA
              </div>
            )}
          </div>
        </div>

        {/* Lado Direito - Ações do Dashboard */}
        <div className="flex items-center gap-3">
          {viagemAtiva && (
            <div className="hidden lg:flex flex-col text-right font-mono-tech bg-slate-900/40 border border-slate-850 px-3.5 py-1.5 rounded-xl shadow-inner">
              <span className="text-[9px] text-slate-500 font-bold uppercase">RASTREAMENTO</span>
              <span className="text-[#f59e0b] font-semibold text-[10px] uppercase tracking-wide mt-0.5">
                {viagemAtiva.id}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => handleEditar(e)}
              disabled={!viagemAtiva}
              className="h-10 px-4 flex items-center font-bold tracking-wide uppercase transition-all border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 bg-slate-950/40 hover:bg-slate-950/80 cursor-pointer rounded-lg text-[10.5px] disabled:opacity-30 disabled:pointer-events-none"
            >
              ✏️ [ EDITAR ROTA ]
            </button>
            <button
              onClick={() => setIsManagerOpen(true)}
              className="h-10 px-5 flex items-center font-black tracking-wide uppercase transition-all bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-lg shadow-indigo-500/10 cursor-pointer rounded-lg text-[10.5px] border-0"
            >
              🎛️ [ GERENCIAR VIAGENS ]
            </button>
          </div>
        </div>
      </div>

      {/* SUB-MODAL CENTRAL DE VIAGENS */}
      {isManagerOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans select-none animate-workspace-fade-in">
          <div className="w-full max-w-2xl glass-panel shadow-2xl overflow-hidden rounded-2xl relative border border-slate-800">
            {/* Listras decorativas no topo */}
            <div className="absolute top-0 left-0 w-full h-[3.5px] hazard-stripes" />

            {/* Header do Sub-Modal */}
            <div className="p-4 bg-slate-950/40 border-b border-slate-850 flex items-center justify-between">
              <div>
                <h2 className="text-[#f59e0b] font-black uppercase tracking-wider text-xs flex items-center gap-2">
                  <span>🎛️ GERENCIADOR CENTRAL DE ROTAS</span>
                  <span className="text-slate-500 font-mono-tech font-normal text-[10px]">|</span>
                  <span className="text-slate-250 font-mono-tech font-semibold uppercase">{viagens.length} VIAGENS CADASTRADAS</span>
                </h2>
                <p className="text-[9.5px] text-slate-400 uppercase font-semibold tracking-wide mt-0.5 font-mono-tech">
                  SELECIONE, EDITE OU EXCLUA OPERAÇÕES DO BANCO DE DADOS
                </p>
              </div>
              <button
                onClick={() => setIsManagerOpen(false)}
                className="px-3.5 py-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-all uppercase font-bold text-[10px] rounded-lg cursor-pointer shadow border-0"
              >
                [ FECHAR ]
              </button>
            </div>

            {/* Corpo - Listagem de Viagens */}
            <div className="p-4 max-h-[50vh] overflow-y-auto pr-2 divide-y divide-slate-850/60 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {viagens.length === 0 ? (
                <div className="py-12 text-center text-slate-500 font-bold uppercase text-xs tracking-wider">
                  NENHUMA VIAGEM CADASTRADA NO BANCO DE DADOS
                </div>
              ) : (
                viagens.map((v) => {
                  const isAtiva = viagemAtiva?.id === v.id;

                  return (
                    <div
                      key={v.id}
                      onClick={() => handleCarregar(v.id)}
                      className={`py-3.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all duration-200 cursor-pointer hover:bg-slate-950/30 rounded-xl border border-transparent ${
                        isAtiva ? "bg-indigo-600/5 border-indigo-500/20" : ""
                      }`}
                    >
                      {/* Dados da Rota */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-black text-[11px] uppercase tracking-wide ${isAtiva ? "text-indigo-400" : "text-slate-200"}`}>
                            {v.origem} ➔ {v.destino}
                          </span>
                          {isAtiva && (
                            <span className="bg-indigo-500/20 text-indigo-400 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider scale-90">
                              ATIVO
                            </span>
                          )}
                        </div>
                        <div className="text-[9.5px] font-mono-tech text-slate-500 mt-1 select-none flex items-center gap-2">
                          <span>PERÍODO: <span className="text-slate-400 font-semibold">{v.data_inicio} a {v.data_fim}</span></span>
                          <span>|</span>
                          <span>TETO: <span className="text-[#f59e0b] font-bold">R$ {v.orcamento_maximo.toLocaleString("pt-BR")}</span></span>
                        </div>
                      </div>

                      {/* Ações da Rota */}
                      <div className="flex items-center gap-2 select-none self-end sm:self-center">
                        <button
                          onClick={() => handleCarregar(v.id)}
                          className={`px-3 py-1.5 font-bold rounded-lg text-[9.5px] uppercase transition-all border border-transparent ${
                            isAtiva
                              ? "bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 border-indigo-500/20"
                              : "bg-slate-950/80 text-slate-400 hover:text-slate-200 hover:bg-slate-950 border-slate-800"
                          }`}
                        >
                          {isAtiva ? "[ SELECIONADA ]" : "[ ABRIR ]"}
                        </button>
                        <button
                          onClick={(e) => handleExcluir(e, v.id, v.destino)}
                          className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/25 text-rose-500 rounded-lg transition-colors cursor-pointer border-0 shadow-sm"
                          title="Excluir Viagem definitivamente"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Rodapé - Criar Nova Operação */}
            <div className="p-3 bg-slate-950/40 border-t border-slate-850 flex justify-between items-center gap-3 select-none">
              <span className="text-[9px] text-slate-500 font-mono-tech uppercase">
                VINCULADO: FIRESTORE LIVE
              </span>
              <button
                type="button"
                onClick={handleNovaViagem}
                className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold transition-all uppercase cursor-pointer rounded-lg text-[10px] shadow-md border-0"
              >
                [ ➕ VINCULAR NOVA OPERAÇÃO / VIAGEM ]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
