"use client";

import React, { useState, useEffect } from "react";

interface ChecklistItem {
  id: string;
  categoria: string;
  nome: string;
  marcado: boolean;
}

interface PackingChecklistProps {
  viagemId: string;
}

const DEFAULT_ITEMS: Omit<ChecklistItem, "id">[] = [
  { categoria: "Documentos", nome: "Passaporte / RG", marcado: false },
  { categoria: "Documentos", nome: "Passagens Aéreas", marcado: false },
  { categoria: "Documentos", nome: "Reserva de Hospedagem", marcado: false },
  { categoria: "Documentos", nome: "Seguro Viagem", marcado: false },
  
  { categoria: "Eletrônicos", nome: "Carregador de Celular", marcado: false },
  { categoria: "Eletrônicos", nome: "Adaptador de Tomada", marcado: false },
  { categoria: "Eletrônicos", nome: "Powerbank", marcado: false },
  
  { categoria: "Roupas", nome: "Casaco Corta Vento", marcado: false },
  { categoria: "Roupas", nome: "Tênis Confortável", marcado: false },
  { categoria: "Roupas", nome: "Roupas Térmicas", marcado: false },
  
  { categoria: "Higiene", nome: "Escova / Pasta de dente", marcado: false },
  { categoria: "Higiene", nome: "Protetor Solar", marcado: false },
  { categoria: "Higiene", nome: "Remédios de Uso Pessoal", marcado: false },
];

export default function PackingChecklist({ viagemId }: PackingChecklistProps) {
  const [itens, setItens] = useState<ChecklistItem[]>([]);
  const [novoItem, setNovoItem] = useState("");
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("Documentos");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");

  // Carrega itens do localStorage para a viagem ativa
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storageKey = `chilinho_checklist_${viagemId}`;
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setItens(JSON.parse(raw));
      } else {
        // Inicializa com os itens padrões
        const inicial = DEFAULT_ITEMS.map((item, idx) => ({
          id: `item_def_${idx}`,
          ...item,
        }));
        setItens(inicial);
        localStorage.setItem(storageKey, JSON.stringify(inicial));
      }
    }
  }, [viagemId]);

  // Salva no localStorage quando itens mudam
  const salvarItens = (novosItens: ChecklistItem[]) => {
    setItens(novosItens);
    if (typeof window !== "undefined") {
      const storageKey = `chilinho_checklist_${viagemId}`;
      localStorage.setItem(storageKey, JSON.stringify(novosItens));
    }
  };

  const handleToggle = (id: string) => {
    const novosItens = itens.map((item) =>
      item.id === id ? { ...item, marcado: !item.marcado } : item
    );
    salvarItens(novosItens);
  };

  const handleAdicionar = (e: React.FormEvent) => {
    e.preventDefault();
    const nome = novoItem.trim();
    if (!nome) return;

    const item: ChecklistItem = {
      id: "item_" + Math.random().toString(36).substring(2, 9),
      categoria: categoriaSelecionada,
      nome,
      marcado: false,
    };

    salvarItens([...itens, item]);
    setNovoItem("");
  };

  const handleRemover = (id: string) => {
    const filtrados = itens.filter((item) => item.id !== id);
    salvarItens(filtrados);
  };

  const handleLimparMarcados = () => {
    if (!confirm("Limpar todos os itens marcados?")) return;
    const desmarcados = itens.map((item) => ({ ...item, marcado: false }));
    salvarItens(desmarcados);
  };

  // Cálculos de Progresso
  const totalItens = itens.length;
  const marcadosItens = itens.filter((i) => i.marcado).length;
  const percentual = totalItens > 0 ? Math.round((marcadosItens / totalItens) * 100) : 0;

  // Parâmetros do Círculo de Progresso SVG
  const raio = 32;
  const circunferencia = 2 * Math.PI * raio;
  const strokeDashoffset = circunferencia - (percentual / 100) * circunferencia;

  // Filtragem dos itens para exibição
  const itensExibidos = itens.filter((item) =>
    filtroCategoria === "todas" ? true : item.categoria === filtroCategoria
  );

  const categorias = ["Documentos", "Eletrônicos", "Roupas", "Higiene", "Outros"];

  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 shadow-md relative overflow-hidden select-none space-y-5">
      <div className="absolute top-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-emerald-500 to-teal-600" />

      {/* Cabeçalho da Lista com Progresso Circular */}
      <div className="flex items-center justify-between border-b border-slate-850 pb-3">
        <div className="flex items-center space-x-3.5">
          {/* Círculo SVG de Progresso */}
          <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r={raio}
                className="stroke-slate-950/80 fill-transparent"
                strokeWidth="4.5"
              />
              <circle
                cx="32"
                cy="32"
                r={raio}
                className="stroke-emerald-500 fill-transparent transition-all duration-500"
                strokeWidth="4.5"
                strokeDasharray={circunferencia}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-[10px] font-mono-tech font-black text-emerald-450 leading-none">
              {percentual}%
            </span>
          </div>

          <div>
            <h3 className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
              🎒 Checklist de Viagem (Bagagem)
            </h3>
            <p className="text-[8px] text-slate-550 font-bold uppercase tracking-wider font-mono-tech mt-1">
              Concluído: {marcadosItens} / {totalItens} itens
            </p>
          </div>
        </div>

        <button
          onClick={handleLimparMarcados}
          disabled={marcadosItens === 0}
          className="px-2.5 py-1.5 bg-slate-950 border border-slate-850 hover:border-slate-850 text-slate-500 hover:text-slate-300 font-bold text-[8.5px] rounded-lg transition-colors uppercase cursor-pointer disabled:opacity-40 select-none"
        >
          Desmarcar Todos
        </button>
      </div>

      {/* Formulário de Novo Item */}
      <form onSubmit={handleAdicionar} className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-[10px]">
        <div className="sm:col-span-4 flex flex-col">
          <select
            value={categoriaSelecionada}
            onChange={(e) => setCategoriaSelecionada(e.target.value)}
            className="w-full bg-slate-950 border border-slate-850 text-slate-300 px-2 py-1.5 focus:outline-none cursor-pointer uppercase font-bold text-[9.5px] rounded-lg h-9"
          >
            {categorias.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-8 flex gap-2">
          <input
            type="text"
            placeholder="Novo item de bagagem..."
            value={novoItem}
            onChange={(e) => setNovoItem(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-850 hover:border-slate-800 text-slate-100 px-3 py-1.5 placeholder-slate-750 text-[10px] rounded-lg focus:outline-none focus:border-[#007aff] uppercase font-semibold h-9"
            maxLength={32}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!novoItem.trim()}
            className="px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[9.5px] rounded-lg uppercase cursor-pointer border-0 shadow-md transition-all active:scale-95 disabled:opacity-50 h-9 shrink-0"
          >
            ➕ Add
          </button>
        </div>
      </form>

      {/* Abas de Filtro por Categoria */}
      <div className="flex items-center gap-1.5 pb-2 border-b border-slate-850 overflow-x-auto scrollbar-none select-none">
        <button
          onClick={() => setFiltroCategoria("todas")}
          className={`px-3 py-1 font-mono-tech text-[8px] uppercase font-bold rounded-lg border transition-all cursor-pointer ${
            filtroCategoria === "todas"
              ? "bg-emerald-600/20 border-emerald-500/60 text-emerald-300 font-extrabold shadow-sm"
              : "bg-slate-950/60 border-slate-850 text-slate-500 hover:text-slate-300"
          }`}
        >
          📂 Todas
        </button>
        {categorias.map((cat) => (
          <button
            key={cat}
            onClick={() => setFiltroCategoria(cat)}
            className={`px-3 py-1 font-mono-tech text-[8px] uppercase font-bold rounded-lg border transition-all cursor-pointer ${
              filtroCategoria === cat
                ? "bg-emerald-600/20 border-emerald-500/60 text-emerald-300 font-extrabold shadow-sm"
                : "bg-slate-950/60 border-slate-850 text-slate-500 hover:text-slate-300"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Lista de Itens do Checklist */}
      <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto pr-1.5 scrollbar-thin">
        {itensExibidos.length === 0 ? (
          <div className="py-8 text-center text-slate-650 font-bold uppercase text-[9px] tracking-wider select-none animate-pulse">
            Nenhum item nesta categoria
          </div>
        ) : (
          itensExibidos.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between gap-3 p-3 bg-slate-900/60 border rounded-xl transition-all shadow-sm group select-none ${
                item.marcado ? "border-slate-900 bg-slate-905/30" : "border-slate-850 hover:border-slate-750"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <input
                  type="checkbox"
                  id={item.id}
                  checked={item.marcado}
                  onChange={() => handleToggle(item.id)}
                  className="w-4 h-4 bg-slate-950 border border-slate-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer rounded checkbox-custom"
                />
                <label
                  htmlFor={item.id}
                  className={`text-[10px] font-semibold uppercase tracking-wide truncate cursor-pointer transition-all ${
                    item.marcado ? "text-slate-500 line-through" : "text-slate-200 group-hover:text-white"
                  }`}
                >
                  {item.nome}
                </label>
              </div>

              <div className="flex items-center gap-2 select-none">
                <span className="text-[7.5px] font-black px-1.5 py-0.2 bg-slate-950 border border-slate-850/80 text-slate-500 font-mono-tech select-none leading-none rounded uppercase">
                  {item.categoria}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemover(item.id)}
                  className="w-5 h-5 flex items-center justify-center border-0 bg-rose-500/10 hover:bg-rose-500/25 text-rose-500 rounded-lg text-[9px] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Excluir Item"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
