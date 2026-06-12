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
  checklist: ChecklistItem[];
  onAdicionar: (item: Omit<ChecklistItem, "id">) => Promise<string>;
  onAlternar: (id: string, marcado: boolean) => Promise<void>;
  onRemover: (id: string) => Promise<void>;
  onDesmarcarTodos: () => Promise<void>;
}

const DEFAULT_ITEMS: Omit<ChecklistItem, "id">[] = [
  { categoria: "Documentos", nome: "Passaporte / RG", marcado: false },
  { categoria: "Documentos", nome: "Passagens Aéreas", marcado: false },
  { categoria: "Documentos", nome: "Reserva de Hospedagem", marcado: false },
  { categoria: "Documentos", nome: "Seguro Viagem", marcado: false },
  
  { categoria: "Eletrônicos", nome: "Carregador de Celular", marcado: false },
  { categoria: "Eletrônicos", nome: "Adaptador de Tomada", marcado: false },
  { categoria: "Eletrônicos", nome: "Powerbank (20.000mAh)", marcado: false },
  
  { categoria: "Roupas", nome: "Casaco Corta Vento", marcado: false },
  { categoria: "Roupas", nome: "Tênis Confortável", marcado: false },
  { categoria: "Roupas", nome: "Roupas Térmicas", marcado: false },
  
  { categoria: "Higiene", nome: "Escova / Pasta de dente", marcado: false },
  { categoria: "Higiene", nome: "Protetor Solar", marcado: false },
  { categoria: "Higiene", nome: "Remédios de Uso Pessoal", marcado: false },
];

export default function PackingChecklist({
  viagemId,
  checklist = [],
  onAdicionar,
  onAlternar,
  onRemover,
  onDesmarcarTodos,
}: PackingChecklistProps) {
  const [novoItem, setNovoItem] = useState("");
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("Documentos");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [searchTerm, setSearchTerm] = useState("");

  // Inicializa com padrões se vazio
  useEffect(() => {
    if (typeof window !== "undefined" && checklist.length === 0 && viagemId) {
      const initKey = `chilinho_checklist_init_${viagemId}`;
      const isInitialized = localStorage.getItem(initKey);
      if (!isInitialized) {
        DEFAULT_ITEMS.forEach((item) => {
          onAdicionar(item);
        });
        localStorage.setItem(initKey, "true");
      }
    }
  }, [viagemId, checklist.length, onAdicionar]);

  const handleToggle = (id: string, atualMarcado: boolean) => {
    onAlternar(id, !atualMarcado);
  };

  const handleAdicionar = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const nome = novoItem.trim();
    if (!nome) return;

    onAdicionar({
      categoria: categoriaSelecionada,
      nome,
      marcado: false,
    });
    setNovoItem("");
  };

  const handleLimparMarcados = () => {
    if (!confirm("⚠️ Desmarcar todos os itens do seu manifesto de bagagem?")) return;
    onDesmarcarTodos();
  };

  // Progress Calculations
  const totalItens = checklist.length;
  const marcadosItens = checklist.filter((i) => i.marcado).length;
  const percentual = totalItens > 0 ? Math.round((marcadosItens / totalItens) * 100) : 0;
  const pendentesItens = totalItens - marcadosItens;

  // Filtering list
  const itensExibidos = checklist.filter((item) => {
    const matchesCategory = filtroCategoria === "todas" ? true : item.categoria === filtroCategoria;
    const matchesSearch = item.nome.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categorias = ["Documentos", "Eletrônicos", "Roupas", "Higiene", "Outros"];

  // Mapping categories to Stitch styling & icons
  const getCategoryDetails = (cat: string) => {
    switch (cat) {
      case "Documentos":
        return { display: "Documentos", icon: "badge", iconColor: "text-amber-400" };
      case "Eletrônicos":
        return { display: "Tecnologia", icon: "bolt", iconColor: "text-cyan-400" };
      case "Roupas":
        return { display: "Vestuário", icon: "ac_unit", iconColor: "text-blue-400" };
      case "Higiene":
        return { display: "Higiene", icon: "clean_hands", iconColor: "text-teal-400" };
      default:
        return { display: "Outros", icon: "inventory_2", iconColor: "text-purple-400" };
    }
  };

  // Group items by category for display
  const groupedItems: Record<string, ChecklistItem[]> = {};
  categorias.forEach((cat) => {
    groupedItems[cat] = [];
  });
  itensExibidos.forEach((item) => {
    const cat = item.categoria || "Outros";
    if (!groupedItems[cat]) groupedItems[cat] = [];
    groupedItems[cat].push(item);
  });

  return (
    <div className="w-full space-y-6 select-none font-sans">
      {/* Header Section with Linear Progress */}
      <section className="relative rounded-2xl overflow-hidden glass-panel p-6 md:p-8 min-h-[160px] flex flex-col justify-end shadow-xl border border-white/5 bg-[#130D20]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#6ee8f8]/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />
        <div className="absolute top-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-[#6ee8f8] to-[#A855F7]" />
        
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <span className="font-mono text-[10px] font-black uppercase text-[#6ee8f8] tracking-[0.3em] block mb-3">Módulo de Preparação</span>
              <h2 className="text-xl md:text-3xl lg:text-[44px] font-black text-white leading-tight mb-2">Checklist de Bagagem</h2>
              <p className="text-slate-400 text-xs max-w-lg mt-2 font-medium">Otimize sua carga para a próxima missão inter-estelar ou transcontinental com protocolos de segurança.</p>
            </div>
            
            <div className="flex flex-col items-end shrink-0 min-w-[200px]">
              <div className="font-mono text-[9px] font-bold text-slate-400 mb-3 uppercase tracking-widest flex items-center gap-2">
                Prontidão Operacional: <span className="text-[#6ee8f8] font-black">{percentual}%</span>
              </div>
              <div className="w-full md:w-56 h-2 bg-slate-950/80 rounded-full overflow-hidden border border-white/10 p-[1px] relative">
                <div 
                  className="h-full bg-gradient-to-r from-[#6ee8f8] via-[#6ee8f8] to-[#A855F7] transition-all duration-1000 ease-out" 
                  style={{ width: `${percentual}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-950/20 p-2.5 rounded-xl border border-white/5">
        <div className="flex-1 flex gap-2 overflow-x-auto pb-1.5 md:pb-0 scrollbar-none w-full">
          <button 
            onClick={() => setFiltroCategoria("todas")}
            className={`px-4 py-2 rounded-full border text-[9px] font-bold uppercase transition-all duration-200 cursor-pointer ${
              filtroCategoria === "todas"
                ? "border-[#6ee8f8] text-[#6ee8f8] bg-[#6ee8f8]/10 shadow-[0_0_10px_rgba(110,232,248,0.2)]"
                : "border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
            }`}
          >
            TODOS
          </button>
          {categorias.map((cat) => {
            const details = getCategoryDetails(cat);
            return (
              <button 
                key={cat}
                onClick={() => setFiltroCategoria(cat)}
                className={`px-4 py-2 rounded-full border text-[9px] font-bold uppercase transition-all duration-200 cursor-pointer whitespace-nowrap ${
                  filtroCategoria === cat
                    ? "border-[#6ee8f8] text-[#6ee8f8] bg-[#6ee8f8]/10 shadow-[0_0_10px_rgba(110,232,248,0.2)]"
                    : "border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
                }`}
              >
                {details.display}
              </button>
            );
          })}
        </div>
        
        <div className="relative w-full md:w-72 shrink-0">
          <span className="absolute left-3.5 top-2.5 text-slate-500 text-xs">🔎</span>
          <input 
            type="text" 
            placeholder="Filtrar itens..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-[#6ee8f8]/50 transition-all font-semibold uppercase placeholder-slate-600"
          />
        </div>
      </div>

      {/* Main Interactive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Side: Items Container */}
        <div className="md:col-span-8 space-y-5">
          {Object.keys(groupedItems).map((categoria) => {
            const items = groupedItems[categoria];
            if (items.length === 0) return null;
            const details = getCategoryDetails(categoria);

            return (
              <div key={categoria} className="space-y-4 mb-6">
                {/* Category Header */}
                <div className="flex items-center gap-4 mb-4 select-none">
                  <span className="font-mono text-[10px] text-[#6ee8f8]/60 font-bold tracking-[0.3em] uppercase">
                    {details.display}
                  </span>
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                </div>

                {/* Items in this Category */}
                <div className="space-y-3">
                  {items.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => handleToggle(item.id, item.marcado)}
                      className={`rounded-xl group flex items-center justify-between p-5 border hover:border-[#6ee8f8]/40 hover:shadow-[0_0_15px_rgba(110,232,248,0.1)] transition-all cursor-pointer relative overflow-hidden ${
                        item.marcado 
                          ? "border-[#6ee8f8] bg-[#6ee8f8]/10" 
                          : "border-white/5 bg-[#1a1230]/40"
                      }`}
                    >
                      <div className="flex items-center gap-6 min-w-0">
                        {/* Custom Checkbox */}
                        <div 
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                            item.marcado 
                              ? "border-[#6ee8f8] bg-[#6ee8f8]/25 text-[#6ee8f8] shadow-[0_0_10px_rgba(110,232,248,0.8)]" 
                              : "border-white/20 group-hover:border-[#6ee8f8]/50"
                          }`}
                        >
                          {item.marcado && (
                            <span className="material-symbols-outlined text-[14px] font-black select-none">check</span>
                          )}
                        </div>
                        
                        <div className="min-w-0">
                          <h4 className={`text-[15px] font-bold transition-all truncate leading-tight ${
                            item.marcado 
                              ? "text-slate-500/60 line-through" 
                              : "text-white"
                          }`}>
                            {item.nome}
                          </h4>
                          <p className={`font-mono text-[8.5px] mt-0.5 uppercase tracking-wider ${
                            item.marcado ? "text-slate-600 opacity-50" : "text-slate-400"
                          }`}>
                            {item.marcado ? "Carga verificada e alocada" : "Pendente de alocação"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <span className={`material-symbols-outlined text-sm ${details.iconColor} opacity-70 group-hover:opacity-100 transition-opacity`}>
                          {details.icon}
                        </span>
                        
                        <button 
                          type="button"
                          onClick={() => onRemover(item.id)}
                          className="w-5 h-5 flex items-center justify-center border-0 bg-rose-500/10 hover:bg-rose-500/25 text-rose-500 rounded-lg text-[10px] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remover Item"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {itensExibidos.length === 0 && (
            <div className="glass-panel py-16 text-center text-slate-500 font-bold uppercase text-[9px] tracking-widest select-none rounded-xl">
              Nenhum item correspondente aos filtros
            </div>
          )}
        </div>

        {/* Right Side: Action Panel (Quick Add, Stats, Specialists Tip) */}
        <div className="md:col-span-4 space-y-6">
          {/* Quick Add Form */}
          <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-[#130D20] space-y-4">
            <h3 className="text-[10px] font-black uppercase text-white tracking-wider">Adição Rápida</h3>
            
            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="font-mono text-[8px] text-slate-450 font-bold uppercase tracking-wider">Nome do Item</label>
                <input 
                  type="text" 
                  placeholder="Ex: Protetor Solar"
                  value={novoItem}
                  onChange={(e) => setNovoItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdicionar();
                    }
                  }}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-[#6ee8f8] font-semibold uppercase placeholder-slate-700"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[8px] text-slate-455 font-bold uppercase tracking-wider">Categoria</label>
                <select 
                  value={categoriaSelecionada}
                  onChange={(e) => setCategoriaSelecionada(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-[#6ee8f8] font-bold cursor-pointer uppercase h-9"
                >
                  {categorias.map((cat) => {
                    const d = getCategoryDetails(cat);
                    return (
                      <option key={cat} value={cat}>
                        {d.display}
                      </option>
                    );
                  })}
                </select>
              </div>

              <button 
                onClick={() => handleAdicionar()}
                disabled={!novoItem.trim()}
                className="w-full py-2.5 bg-slate-900 hover:bg-[#6ee8f8] text-[#6ee8f8] hover:text-[#00363c] border border-[#6ee8f8]/20 font-mono text-[9px] font-black rounded-lg transition-all uppercase tracking-widest mt-1.5 disabled:opacity-40 disabled:hover:bg-slate-900 disabled:hover:text-[#6ee8f8] cursor-pointer"
              >
                + Adicionar à Lista
              </button>
            </div>
          </div>

          {/* Mission Summary stats */}
          <div className="glass-panel p-5 rounded-2xl relative overflow-hidden border border-white/5 bg-[#130D20] space-y-4">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#6ee8f8]/5 rounded-full blur-3xl -mr-16 -mt-16" />
            <h3 className="text-[10px] font-black uppercase text-white tracking-wider relative z-10">Resumo da Missão</h3>
            
            <div className="space-y-3 text-xs relative z-10">
              <div className="flex justify-between items-end border-b border-white/5 pb-2">
                <span className="text-slate-400 font-medium">Total de Itens</span>
                <span className="font-mono font-bold text-white text-sm">{totalItens}</span>
              </div>
              <div className="flex justify-between items-end border-b border-white/5 pb-2">
                <span className="text-slate-400 font-medium">Prontos</span>
                <span className="font-mono font-bold text-[#6ee8f8] text-sm">{marcadosItens}</span>
              </div>
              <div className="flex justify-between items-end border-b border-white/5 pb-2">
                <span className="text-slate-400 font-medium">Pendentes</span>
                <span className="font-mono font-bold text-[#F97316] text-sm">{pendentesItens}</span>
              </div>
            </div>
            
            <div className="pt-2 relative z-10">
              <button 
                onClick={handleLimparMarcados}
                disabled={marcadosItens === 0}
                className="w-full py-3 bg-[#6ee8f8]/10 border border-[#6ee8f8]/35 hover:border-[#6ee8f8] text-[#6ee8f8] font-mono text-[9px] font-black rounded-lg flex items-center justify-center gap-1.5 hover:bg-[#6ee8f8]/20 transition-all uppercase cursor-pointer disabled:opacity-40 disabled:hover:bg-[#6ee8f8]/10 disabled:hover:text-[#6ee8f8]"
              >
                <span className="material-symbols-outlined text-[15px] font-black">restart_alt</span>
                Resetar Manifesto
              </button>
            </div>
          </div>

          {/* Luggage Visual Tip */}
          <div className="rounded-2xl overflow-hidden border border-white/5 relative group bg-black/40">
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuC0NodpB2wIUu7ExVd5OTYejOgOPsBEeT4iOfsCJvO7QjdVkePQg5f5Q5LMCnj5x75EOyGLYffezzCEhS68O8ReJqo-dI7mov4tFP_3AmSAu_yPVPZDT4BUPtGJUJMd8fCC2LW_vnyWZw92abIbcarxWhQDkyalm-D2P_FOZc5gsszz3JRQV8Gf-TH43UV5zn7Zinxjcyb5SGHE4FBW-b_qAqjbj1B-URkl-1x4xqKbphi9vYgNUGiA4uyP8l6jqTxbNoD-kZ1ejmM" 
              alt="Futuristic Suitcase Organize" 
              className="w-full h-44 object-cover opacity-50 grayscale group-hover:grayscale-0 group-hover:opacity-75 transition-all duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f1415] to-transparent p-5 flex flex-col justify-end">
              <span className="font-mono text-[8px] text-[#6ee8f8] font-black uppercase tracking-widest">Dica de Especialista</span>
              <h4 className="text-white text-[11px] font-bold leading-normal mt-1.5 uppercase tracking-wide">
                Organização por zonas térmicas otimiza o acesso rápido em trânsito.
              </h4>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
