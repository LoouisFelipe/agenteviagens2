"use client";

import React, { useState } from "react";

interface TravelersManagerProps {
  viajantes: string[];
  onAtualizarViajantes: (viajantes: string[]) => Promise<void>;
}

export default function TravelersManager({
  viajantes = [],
  onAtualizarViajantes,
}: TravelersManagerProps) {
  const [novoViajante, setNovoViajante] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const handleAdicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    const nome = novoViajante.trim();
    if (!nome) return;

    if (viajantes.includes(nome)) {
      setErro("Este viajante já está cadastrado.");
      return;
    }

    setSalvando(true);
    try {
      const novaLista = [...viajantes, nome];
      await onAtualizarViajantes(novaLista);
      setNovoViajante("");
    } catch {
      setErro("Falha ao salvar viajante.");
    } finally {
      setSalvando(false);
    }
  };

  const handleRemover = async (nome: string) => {
    if (!confirm(`Deseja remover ${nome} da viagem?`)) return;

    setSalvando(true);
    try {
      const novaLista = viajantes.filter((v) => v !== nome);
      await onAtualizarViajantes(novaLista);
    } catch {
      setErro("Falha ao remover viajante.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 shadow-md relative overflow-hidden select-none space-y-4">
      <div className="absolute top-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-violet-500 to-indigo-600" />
      
      <div className="flex items-center justify-between border-b border-slate-850 pb-2">
        <h3 className="text-[10px] font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
          <span>👥 Viajantes ({viajantes.length})</span>
        </h3>
        <span className="text-[8px] text-slate-550 lowercase italic">membros da rota</span>
      </div>

      {/* Formulário de Inclusão */}
      <form onSubmit={handleAdicionar} className="flex gap-2">
        <input
          type="text"
          placeholder="Nome do Viajante..."
          value={novoViajante}
          onChange={(e) => setNovoViajante(e.target.value)}
          disabled={salvando}
          className="flex-1 bg-slate-950 border border-slate-850 hover:border-slate-800 text-slate-100 px-3 py-1.5 placeholder-slate-750 text-[10px] rounded-lg focus:outline-none focus:border-[#007aff] uppercase font-semibold"
        />
        <button
          type="submit"
          disabled={salvando || !novoViajante.trim()}
          className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-[9px] rounded-lg uppercase cursor-pointer border-0 shadow-md transition-all active:scale-95 disabled:opacity-50"
        >
          ➕ Add
        </button>
      </form>

      {erro && <div className="text-[8.5px] text-rose-455 font-mono-tech leading-none">⚠️ {erro}</div>}

      {/* Lista de Viajantes */}
      <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
        {viajantes.length === 0 ? (
          <div className="text-[9.5px] text-slate-500 font-semibold uppercase italic py-2">
            Nenhum viajante adicionado. Apenas você está na rota.
          </div>
        ) : (
          viajantes.map((viajante) => (
            <div
              key={viajante}
              className="flex items-center gap-2 px-2.5 py-1 bg-slate-900/60 border border-slate-850 rounded-xl hover:border-indigo-500/30 transition-all group shadow-sm"
            >
              <span className="text-slate-300 font-bold uppercase text-[9.5px]">{viajante}</span>
              <button
                type="button"
                onClick={() => handleRemover(viajante)}
                disabled={salvando}
                className="text-slate-650 hover:text-rose-500 font-bold bg-transparent border-0 cursor-pointer text-[8px] transition-colors leading-none"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
