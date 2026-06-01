"use client";

import React, { useState, useEffect } from "react";
import { Hospedagem, Atividade, emitLog } from "@/services/travelService";
import { obterPrecosLocais } from "@/services/priceService";

interface SideAListProps {
  datasViagem: string[]; // Lista de datas do roteiro gerado
  onInjetarHospedagem: (dataDia: string, hospedagem: Hospedagem) => Promise<void>;
  onInjetarAtividade: (dataDia: string, atividade: Atividade) => Promise<void>;
  onInjetarDespesa: (dataDia: string, despesa: { nome: string; valor: number; categoria: string }) => Promise<void>;
  viagemDestino: string;
}

function obterCategoriaItem(nome: string, tipo: "hospedagem" | "atividade" | "despesa") {
  const n = nome.toLowerCase();
  if (tipo === "hospedagem") {
    if (n.includes("luxury") || n.includes("singular") || n.includes("bristol") || n.includes("palace") || n.includes("alvear") || n.includes("faena") || n.includes("grand") || n.includes("w santiago")) {
      return { label: "Luxo ✦", style: "bg-amber-500/10 text-[#f59e0b] border-amber-500/20", glow: "glow-card-amber" };
    }
    if (n.includes("hostal") || n.includes("generator") || n.includes("eco") || n.includes("backpackers") || n.includes("inn")) {
      return { label: "Econômico ⚡", style: "bg-teal-500/10 text-[#10b981] border-teal-500/20", glow: "glow-card-emerald" };
    }
    return { label: "Boutique 🏨", style: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", glow: "glow-card-indigo" };
  } else if (tipo === "atividade") {
    if (n.includes("cajón") || n.includes("neve") || n.includes("ski") || n.includes("trekking") || n.includes("trilhas") || n.includes("aventura") || n.includes("el yeso")) {
      return { label: "Aventura 🧭", style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", glow: "glow-card-emerald" };
    }
    if (n.includes("tango") || n.includes("concha") || n.includes("louvre") || n.includes("versalhes") || n.includes("torre") || n.includes("museu") || n.includes("historico") || n.includes("centro") || n.includes("tour") || n.includes("histórico")) {
      return { label: "Cultural 🏛️", style: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", glow: "glow-card-indigo" };
    }
    if (n.includes("jantar") || n.includes("dinner") || n.includes("bali") || n.includes("gastronomia") || n.includes("culinário") || n.includes("show")) {
      return { label: "Gastronomia 🍽️", style: "bg-rose-500/10 text-rose-400 border-rose-500/20", glow: "glow-card-rose" };
    }
    return { label: "Lazer 🪁", style: "bg-slate-500/10 text-slate-400 border-slate-500/20", glow: "glow-card-indigo" };
  } else {
    // Despesas
    if (n.includes("restaurante") || n.includes("almoço") || n.includes("janta") || n.includes("lanche") || n.includes("café")) {
      return { label: "Alimentação 🍽️", style: "bg-rose-500/10 text-rose-400 border-rose-500/20", glow: "glow-card-rose" };
    }
    if (n.includes("táxi") || n.includes("taxi") || n.includes("uber") || n.includes("metrô") || n.includes("passagem") || n.includes("combustível")) {
      return { label: "Transporte 🚗", style: "bg-cyan-500/10 text-cyan-405 border-cyan-500/20", glow: "glow-card-indigo" };
    }
    if (n.includes("suvenir") || n.includes("lembrança") || n.includes("compra") || n.includes("shopping")) {
      return { label: "Compras 🛍️", style: "bg-amber-500/10 text-amber-450 border-amber-500/20", glow: "glow-card-amber" };
    }
    return { label: "Outros 💰", style: "bg-slate-500/10 text-slate-400 border-slate-500/20", glow: "glow-card-indigo" };
  }
}

export default function SideAList({
  datasViagem,
  onInjetarHospedagem,
  onInjetarAtividade,
  onInjetarDespesa,
  viagemDestino,
}: SideAListProps) {
  const [tabAtiva, setTabAtiva] = useState<"hospedagem" | "atividade" | "despesa">("hospedagem");
  const [filtro, setFiltro] = useState("");
  const [menuAbertoIndex, setMenuAbertoIndex] = useState<number | null>(null);

  const [hospedagens, setHospedagens] = useState<Hospedagem[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Estados para hospedagem customizada/já fechada
  const [isCustomFormOpen, setIsCustomFormOpen] = useState(false);
  const [customNome, setCustomNome] = useState("");
  const [customPreco, setCustomPreco] = useState("");
  const [customLink, setCustomLink] = useState("");
  const [customDiasSelecionados, setCustomDiasSelecionados] = useState<string[]>([]);
  const [customFormError, setCustomFormError] = useState("");

  const toggleCustomDiaSelecionado = (dia: string) => {
    setCustomDiasSelecionados((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    );
  };

  const selecionarTodosCustomDias = () => {
    setCustomDiasSelecionados([...datasViagem]);
  };

  const limparCustomDias = () => {
    setCustomDiasSelecionados([]);
  };

  // Estados para despesas customizadas
  const [despesaNome, setDespesaNome] = useState("");
  const [despesaPreco, setDespesaPreco] = useState("");
  const [despesaCategoria, setDespesaCategoria] = useState("Alimentação");
  const [despesaDiasSelecionados, setDespesaDiasSelecionados] = useState<string[]>([]);
  const [despesaFormError, setDespesaFormError] = useState("");
  const [isGlobalDespesa, setIsGlobalDespesa] = useState(false);

  const toggleDespesaDiaSelecionado = (dia: string) => {
    setDespesaDiasSelecionados((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    );
  };

  const selecionarTodosDespesaDias = () => {
    setDespesaDiasSelecionados([...datasViagem]);
  };

  const limparDespesaDias = () => {
    setDespesaDiasSelecionados([]);
  };

  // Estados para alocação avançada de passeios (pessoas e dias consecutivos)
  const [pessoasAtividade, setPessoasAtividade] = useState(2);
  const [duracaoAtividade, setDuracaoAtividade] = useState(2);
  const [diaInicioAtividade, setDiaInicioAtividade] = useState("");

  const handleInjetarAtividadeAvancada = async (item: Atividade) => {
    if (!diaInicioAtividade) {
      alert("POR FAVOR, SELECIONE O DIA DE INÍCIO DA ATIVIDADE.");
      return;
    }
    
    setMenuAbertoIndex(null);
    const startIdx = datasViagem.indexOf(diaInicioAtividade);
    if (startIdx === -1) return;

    emitLog(`SYSTEM: Alocando passeio [${item.nome}] para ${pessoasAtividade} pessoas por ${duracaoAtividade} dias...`);
    
    for (let i = 0; i < duracaoAtividade; i++) {
      const targetIdx = startIdx + i;
      if (targetIdx < datasViagem.length) {
        const targetDia = datasViagem[targetIdx];
        const atvPayload: Atividade = {
          nome: `${item.nome} (${pessoasAtividade} Px - Dia ${i+1}/${duracaoAtividade})`,
          valor: item.valor * pessoasAtividade,
          link: item.link
        };
        await onInjetarAtividade(targetDia, atvPayload);
      }
    }
    
    // Reseta estados
    setDiaInicioAtividade("");
    setPessoasAtividade(2);
    setDuracaoAtividade(2);
  };

  useEffect(() => {
    let active = true;
    const fetchPrecos = () => {
      setIsLoading(true);
      emitLog(`SYSTEM: Conectando ao robô de scraping para pesquisar custos em [${viagemDestino}]...`);
      setTimeout(() => {
        try {
          const data = obterPrecosLocais(viagemDestino);
          if (active) {
            setHospedagens(data.hospedagens);
            setAtividades(data.atividades);
            emitLog(`SYSTEM: Scraping finalizado. ${data.hospedagens.length} hotéis e ${data.atividades.length} passeios importados.`);
          }
        } catch (err) {
          console.error("Falha ao carregar cotações:", err);
          emitLog("SYSTEM WARNING: Falha ao carregar cotações do banco local.");
        } finally {
          if (active) setIsLoading(false);
        }
      }, 500);
    };
    fetchPrecos();
    return () => { active = false; };
  }, [viagemDestino]);

  const listaAtual = tabAtiva === "hospedagem" ? hospedagens : tabAtiva === "atividade" ? atividades : [];
  const itensFiltrados = listaAtual.filter((item) =>
    item.nome.toLowerCase().includes(filtro.toLowerCase())
  );

  const handleInjetar = async (item: Hospedagem | Atividade, dataDia: string) => {
    setMenuAbertoIndex(null);
    if (tabAtiva === "hospedagem") {
      await onInjetarHospedagem(dataDia, item as Hospedagem);
    } else if (tabAtiva === "atividade") {
      await onInjetarAtividade(dataDia, item as Atividade);
    }
  };

  return (
    <div className="w-full glass-panel shadow-xl flex flex-col h-full text-xs font-sans rounded-2xl select-none">
      
      {/* Abas Superiores com Design Moderno em Pílula */}
      <div className="p-3 bg-slate-950/30 border-b border-slate-800/80 flex space-x-2 rounded-t-2xl">
        <button
          onClick={() => {
            setTabAtiva("hospedagem");
            setFiltro("");
            setMenuAbertoIndex(null);
          }}
          className={`flex-1 py-2.5 font-bold tracking-wide text-center transition-all duration-200 cursor-pointer rounded-lg text-[10px] ${
            tabAtiva === "hospedagem"
              ? "bg-slate-900 text-blue-400 shadow-md shadow-black/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          🏨 Hospedagens
        </button>
        <button
          onClick={() => {
            setTabAtiva("atividade");
            setFiltro("");
            setMenuAbertoIndex(null);
          }}
          className={`flex-1 py-2.5 font-bold tracking-wide text-center transition-all duration-200 cursor-pointer rounded-lg text-[10px] ${
            tabAtiva === "atividade"
              ? "bg-slate-900 text-emerald-400 shadow-md shadow-black/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          🧭 Passeios
        </button>
        <button
          onClick={() => {
            setTabAtiva("despesa");
            setFiltro("");
            setMenuAbertoIndex(null);
          }}
          className={`flex-1 py-2.5 font-bold tracking-wide text-center transition-all duration-200 cursor-pointer rounded-lg text-[10px] ${
            tabAtiva === "despesa"
              ? "bg-slate-900 text-[#f59e0b] shadow-md shadow-black/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          💰 Despesas
        </button>
      </div>

      {/* Caixa de Busca Industrial */}
      <div className="p-3.5 bg-slate-950/10 border-b border-slate-800/40 flex items-center justify-between gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder={`Filtrar por ${tabAtiva === "hospedagem" ? "nome da hospedagem" : "nome da atividade"}...`}
            value={filtro}
            onChange={(e) => {
              setFiltro(e.target.value);
              setMenuAbertoIndex(null);
            }}
            className="w-full bg-slate-950 border border-slate-800/80 text-slate-200 px-3.5 py-2 pl-9 focus:border-blue-500 focus:outline-none placeholder-slate-750 text-[11px] rounded-lg shadow-inner font-medium"
          />
          <span className="absolute left-3.5 top-2.5 text-slate-650 text-xs">🔎</span>
        </div>
        <div className="text-[10px] text-slate-500 font-bold hidden sm:block font-mono-tech select-none">
          Resultados: {itensFiltrados.length}
        </div>
      </div>

      {/* Formulário de Hospedagem Fechada/Personalizada */}
      {tabAtiva === "hospedagem" && (
        <div className="px-3.5 py-2.5 bg-slate-950/20 border-b border-slate-800/40 select-none">
          <button
            onClick={() => {
              setIsCustomFormOpen(!isCustomFormOpen);
              setCustomFormError("");
            }}
            disabled={datasViagem.length === 0}
            className="w-full py-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 hover:border-blue-400/50 text-blue-400 font-bold transition-all text-[10.5px] rounded-lg cursor-pointer flex items-center justify-center gap-1.5 shadow-md animate-fade-in"
          >
            <span>{isCustomFormOpen ? "▲ Fechar Formulário" : "➕ Inserir Hospedagem Personalizada"}</span>
          </button>

          {isCustomFormOpen && (
            <div className="mt-3 p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-3 shadow-inner">
              <div className="text-[9.5px] font-bold text-slate-400 tracking-wider">
                Nova Hospedagem Fechada (Airbnb / Hotel Reservado)
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="flex flex-col">
                  <label className="text-[10px] font-semibold text-slate-400 mb-1">Nome do Hotel/Local</label>
                  <input
                    type="text"
                    placeholder="Ex: Airbnb Providencia"
                    value={customNome}
                    onChange={(e) => setCustomNome(e.target.value)}
                    className="bg-slate-900 border border-slate-800 text-slate-200 px-2.5 py-1.5 focus:border-blue-500 focus:outline-none text-[10px] rounded-lg shadow-inner font-medium"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] font-semibold text-slate-400 mb-1">Valor Diário (R$)</label>
                  <input
                    type="number"
                    placeholder="Ex: 300"
                    value={customPreco}
                    onChange={(e) => setCustomPreco(e.target.value)}
                    className="bg-slate-900 border border-slate-800 text-slate-200 px-2.5 py-1.5 focus:border-blue-500 focus:outline-none text-[10px] rounded-lg shadow-inner font-mono-tech"
                  />
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-slate-400 mb-1">Link / URL de Acompanhamento (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: https://airbnb.com.br/rooms/..."
                  value={customLink}
                  onChange={(e) => setCustomLink(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-slate-200 px-2.5 py-1.5 focus:border-blue-500 focus:outline-none text-[10px] rounded-lg shadow-inner w-full"
                />
              </div>

              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-semibold text-slate-400">Dias de Alocação ({customDiasSelecionados.length} selecionados)</label>
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={selecionarTodosCustomDias}
                      className="text-[9px] font-bold text-blue-400 hover:text-blue-300 cursor-pointer bg-transparent border-0 p-0"
                    >
                      Selecionar Todos
                    </button>
                    <button
                      type="button"
                      onClick={limparCustomDias}
                      className="text-[9px] font-bold text-slate-500 hover:text-slate-400 cursor-pointer bg-transparent border-0 p-0"
                    >
                      Limpar
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-900/60 rounded-xl border border-slate-800/60 max-h-36 overflow-y-auto">
                  {datasViagem.map((dia, dIdx) => {
                    const isSelected = customDiasSelecionados.includes(dia);
                    const dateObj = new Date(dia + "T12:00:00");
                    return (
                      <button
                        key={dia}
                        type="button"
                        onClick={() => toggleCustomDiaSelecionado(dia)}
                        className={`px-2.5 py-1.5 rounded-lg text-[9.5px] font-semibold transition-all duration-150 flex items-center gap-1.5 border cursor-pointer ${
                          isSelected
                            ? "bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-500/10 scale-[1.02]"
                            : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white led-white animate-pulse" : "bg-slate-600"}`} />
                        <span>Dia {String(dIdx + 1).padStart(2, "0")} - {dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {customFormError && (
                <div className="text-[9.5px] text-rose-450 font-mono-tech leading-none">
                  ⚠️ {customFormError}
                </div>
              )}

              <button
                onClick={async () => {
                  setCustomFormError("");
                  if (!customNome.trim() || !customPreco.trim() || customDiasSelecionados.length === 0) {
                    setCustomFormError("Preencha todos os campos e selecione pelo menos um dia.");
                    return;
                  }
                  const precoVal = Number(customPreco);
                  if (isNaN(precoVal) || precoVal <= 0) {
                    setCustomFormError("Valor diário inválido.");
                    return;
                  }
                  
                  try {
                    emitLog(`SYSTEM: Vinculando hospedagem customizada [${customNome.trim()}] nos dias [${customDiasSelecionados.join(", ")}]...`);
                    
                    const finalLink = customLink.trim() || `https://www.google.com.br/travel/search?q=${encodeURIComponent(`${customNome.trim()} ${viagemDestino}`)}`;
                    
                    await Promise.all(
                      customDiasSelecionados.map((dia) =>
                        onInjetarHospedagem(dia, {
                          nome: `${customNome.trim()} [FECHADO]`,
                          preco_diario: precoVal,
                          link: finalLink
                        })
                      )
                    );
                    
                    // Limpar form e fechar
                    setCustomNome("");
                    setCustomPreco("");
                    setCustomLink("");
                    setCustomDiasSelecionados([]);
                    setIsCustomFormOpen(false);
                    emitLog(`SYSTEM: Hospedagem customizada vinculada com sucesso para ${customDiasSelecionados.length} dias.`);
                  } catch (error) {
                    console.error(error);
                    setCustomFormError("Falha ao salvar hospedagem.");
                  }
                }}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10.5px] transition-all rounded-lg cursor-pointer flex items-center justify-center gap-1 shadow-md hover:scale-[1.01]"
              >
                Vincular Hospedagem Fechada
              </button>
            </div>
          )}
        </div>
      )}

      {tabAtiva === "despesa" && (
        <div className="px-3.5 py-3 bg-slate-950/20 border-b border-slate-800/40 select-none space-y-3">
          <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-3.5 shadow-inner">
            <div className="text-[10px] font-black text-[#f59e0b] tracking-wider flex items-center gap-1">
              <span>💰 Registro de Nova Despesa</span>
            </div>

            {/* Seletor Premium de Tipo de Despesa */}
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 gap-1 select-none">
              <button
                type="button"
                onClick={() => setIsGlobalDespesa(false)}
                className={`flex-1 py-1.5 rounded-md font-bold text-[9.5px] uppercase transition-all duration-200 cursor-pointer ${
                  !isGlobalDespesa
                    ? "bg-amber-500/10 text-amber-550 border border-amber-500/20"
                    : "text-slate-500 hover:text-slate-350 bg-transparent border-0"
                }`}
              >
                📅 Vincular a Dias
              </button>
              <button
                type="button"
                onClick={() => setIsGlobalDespesa(true)}
                className={`flex-1 py-1.5 rounded-md font-bold text-[9.5px] uppercase transition-all duration-200 cursor-pointer ${
                  isGlobalDespesa
                    ? "bg-amber-500/10 text-amber-550 border border-amber-500/20"
                    : "text-slate-500 hover:text-slate-350 bg-transparent border-0"
                }`}
              >
                ✈️ Despesa Geral (Orçamento)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-slate-400 mb-1">Nome da Despesa</label>
                <input
                  type="text"
                  placeholder="Ex: Passagens Aéreas"
                  value={despesaNome}
                  onChange={(e) => setDespesaNome(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-slate-200 px-2.5 py-1.5 focus:border-[#f59e0b] focus:outline-none text-[10px] rounded-lg shadow-inner font-medium"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-slate-400 mb-1">Valor Unitário (R$)</label>
                <input
                  type="number"
                  placeholder="Ex: 1500"
                  value={despesaPreco}
                  onChange={(e) => setDespesaPreco(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-slate-200 px-2.5 py-1.5 focus:border-[#f59e0b] focus:outline-none text-[10px] rounded-lg shadow-inner font-mono-tech"
                />
              </div>
            </div>

            <div className="flex flex-col">
              <label className="text-[10px] font-semibold text-slate-400 mb-1">Categoria do Gasto</label>
              <select
                value={despesaCategoria}
                onChange={(e) => setDespesaCategoria(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-355 px-2.5 py-1.5 focus:border-[#f59e0b] focus:outline-none text-[10px] rounded-lg cursor-pointer font-bold"
              >
                <option value="Alimentação">Alimentação 🍽️</option>
                <option value="Transporte">Transporte 🚗</option>
                <option value="Lazer">Lazer 🪁</option>
                <option value="Compras">Compras 🛍️</option>
                <option value="Outros">Outros 💰</option>
              </select>
            </div>

            {!isGlobalDespesa ? (
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-semibold text-slate-400">Dias de Lançamento ({despesaDiasSelecionados.length} selecionados)</label>
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={selecionarTodosDespesaDias}
                      className="text-[9px] font-bold text-blue-400 hover:text-blue-300 cursor-pointer bg-transparent border-0 p-0"
                    >
                      Selecionar Todos
                    </button>
                    <button
                      type="button"
                      onClick={limparDespesaDias}
                      className="text-[9px] font-bold text-slate-500 hover:text-slate-400 cursor-pointer bg-transparent border-0 p-0"
                    >
                      Limpar
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-900/60 rounded-xl border border-slate-800/60 max-h-36 overflow-y-auto">
                  {datasViagem.map((dia, dIdx) => {
                    const isSelected = despesaDiasSelecionados.includes(dia);
                    const dateObj = new Date(dia + "T12:00:00");
                    return (
                      <button
                        key={dia}
                        type="button"
                        onClick={() => toggleDespesaDiaSelecionado(dia)}
                        className={`px-2.5 py-1.5 rounded-lg text-[9.5px] font-semibold transition-all duration-150 flex items-center gap-1.5 border cursor-pointer ${
                          isSelected
                            ? "bg-amber-600 border-amber-400 text-white shadow-md shadow-amber-500/10 scale-[1.02]"
                            : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white led-white animate-pulse" : "bg-slate-600"}`} />
                        <span>Dia {String(dIdx + 1).padStart(2, "0")} - {dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-lg text-slate-400 font-semibold text-[9.5px] tracking-wide leading-relaxed">
                💡 <strong>Despesa Geral:</strong> Este custo (ex: passagens, chip de viagem, etc.) será adicionado como um valor geral ao orçamento final, sem vínculo com dias específicos no cronograma.
              </div>
            )}

            {despesaFormError && (
              <div className="text-[9.5px] text-rose-450 font-mono-tech leading-none">
                ⚠️ {despesaFormError}
              </div>
            )}

            <button
              onClick={async () => {
                setDespesaFormError("");
                if (!despesaNome.trim() || !despesaPreco.trim() || (!isGlobalDespesa && despesaDiasSelecionados.length === 0)) {
                  setDespesaFormError(isGlobalDespesa ? "Preencha todos os campos." : "Preencha todos os campos e selecione pelo menos um dia.");
                  return;
                }
                const precoVal = Number(despesaPreco);
                if (isNaN(precoVal) || precoVal <= 0) {
                  setDespesaFormError("Valor diário inválido.");
                  return;
                }

                try {
                  if (isGlobalDespesa) {
                    emitLog(`SYSTEM: Sincronizando despesa geral [${despesaNome.trim()}]...`);
                    await onInjetarDespesa("global", {
                      nome: despesaNome.trim(),
                      valor: precoVal,
                      categoria: despesaCategoria
                    });
                  } else {
                    emitLog(`SYSTEM: Sincronizando despesa [${despesaNome.trim()}] nos dias [${despesaDiasSelecionados.join(", ")}]...`);
                    await Promise.all(
                      despesaDiasSelecionados.map((dia) =>
                        onInjetarDespesa(dia, {
                          nome: despesaNome.trim(),
                          valor: precoVal,
                          categoria: despesaCategoria
                        })
                      )
                    );
                  }

                  // Limpar
                  setDespesaNome("");
                  setDespesaPreco("");
                  setDespesaCategoria("Alimentação");
                  setDespesaDiasSelecionados([]);
                  emitLog("SYSTEM: Despesa vinculada com sucesso.");
                } catch (e) {
                  console.error(e);
                  setDespesaFormError("Erro ao registrar gasto.");
                }
              }}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-[#f59e0b] hover:from-amber-400 hover:to-amber-500 text-white font-bold text-[10.5px] transition-all rounded-lg cursor-pointer flex items-center justify-center gap-1 shadow-md hover:scale-[1.01] border-0"
            >
              Lançar e Salvar Despesa
            </button>
          </div>
        </div>
      )}

      {/* Lista de Registros */}
      <div className="flex-1 overflow-y-auto max-h-[460px] divide-y divide-slate-900/60 bg-slate-950/5 rounded-b-2xl scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {isLoading ? (
          <div className="p-16 text-center text-[#f59e0b] font-bold uppercase space-y-3.5 animate-pulse font-sans">
            <div className="text-sm font-black tracking-wider">⚙️ Captura Online Ativa</div>
            <div className="text-[10px] text-slate-500 font-mono-tech tracking-widest leading-relaxed">
              Executando coleta em tempo real...<br/>
              Carregando cotações de {viagemDestino}...
            </div>
          </div>
        ) : itensFiltrados.length === 0 ? (
          <div className="p-10 text-center text-slate-650 font-semibold tracking-wide font-sans">
            Nenhum registro correspondente ao filtro
          </div>
        ) : (
          itensFiltrados.map((item, index) => {
            const valorExibido =
              tabAtiva === "hospedagem"
                ? `R$ ${(item as Hospedagem).preco_diario}/dia`
                : `R$ ${(item as Atividade).valor}`;
                
            const badge = obterCategoriaItem(item.nome, tabAtiva);

            return (
              <div
                key={index}
                className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all duration-250 group border border-transparent hover:border-slate-850/60 rounded-xl hover:-translate-y-0.5 ${badge.glow}`}
              >
                {/* Dados da Coluna Esquerda */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-200 group-hover:text-blue-400 transition-colors text-[11px] font-sans tracking-wide">
                      {item.nome}
                    </span>
                    <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded border font-mono-tech select-none leading-none ${badge.style}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 text-[10px] font-mono-tech select-none">
                    <span className="text-slate-400">
                      Custo: <span className="text-slate-100 font-semibold">{valorExibido}</span>
                    </span>
                    {tabAtiva === "hospedagem" ? (
                      <a
                        href={
                          item.link && item.link.startsWith("http")
                            ? item.link
                            : `https://www.google.com.br/travel/search?q=${encodeURIComponent(
                                `${item.nome} ${viagemDestino}`
                              )}${
                                datasViagem && datasViagem.length > 0
                                  ? `&checkin=${datasViagem[0]}&checkout=${datasViagem[datasViagem.length - 1]}`
                                  : ""
                              }`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 font-bold hover:underline transition-colors font-sans"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Google Travel ↗
                      </a>
                    ) : (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 font-sans">
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 font-bold hover:underline transition-colors text-[9.5px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Site Oficial ↗
                        </a>
                        <span className="text-slate-800">|</span>
                        <a
                          href={`https://www.viator.com/search/${encodeURIComponent(
                            `${item.nome} ${viagemDestino}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 font-bold hover:underline transition-colors text-[9.5px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Viator ↗
                        </a>
                        <span className="text-slate-800">|</span>
                        <a
                          href={`https://www.getyourguide.com.br/s?q=${encodeURIComponent(
                            `${item.nome} ${viagemDestino}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#10b981] hover:text-[#34d399] font-bold hover:underline transition-colors text-[9.5px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          GetYourGuide ↗
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Coluna Direita - Ação de Injeção */}
                <div className="relative self-start sm:self-center">
                  <button
                    onClick={() => setMenuAbertoIndex(menuAbertoIndex === index ? null : index)}
                    disabled={datasViagem.length === 0}
                    className={`px-4 py-1.5 font-bold border-0 transition-all duration-200 cursor-pointer rounded-lg text-[10.5px] shadow-md flex items-center gap-1 ${
                      tabAtiva === "hospedagem"
                        ? "bg-blue-600/10 hover:bg-blue-600/25 text-blue-400 hover:text-blue-300"
                        : "bg-emerald-600/10 hover:bg-emerald-600/25 text-emerald-400 hover:text-emerald-300"
                    } disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:scale-100 hover:scale-[1.02] active:scale-[0.98]`}
                  >
                    <span>{datasViagem.length === 0 ? "Sem dias" : "Injetar"}</span>
                    {datasViagem.length > 0 && <span className="text-[9px] group-hover:translate-x-0.5 transition-transform">➔</span>}
                  </button>

                  {/* Dropdown de Seleção de Dia para Injetar - Estilo SaaS Popover */}
                  {menuAbertoIndex === index && (
                    tabAtiva === "hospedagem" ? (
                      <div className="absolute right-0 mt-2 w-60 bg-slate-900 border border-slate-800 shadow-2xl z-20 font-sans p-1 rounded-xl">
                        <div className="border-b border-slate-800 px-3 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-wider select-none">
                          Selecione o Dia de Alocação:
                        </div>
                        <div className="max-h-48 overflow-y-auto divide-y divide-slate-850/60 mt-1 scrollbar-thin">
                          {datasViagem.map((dataDia, dIdx) => {
                            const dateObj = new Date(dataDia + "T12:00:00");
                            const labelDia = `Dia ${String(dIdx + 1).padStart(2, "0")} - ${dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} (${dataDia})`;

                            return (
                              <button
                                key={dataDia}
                                onClick={() => handleInjetar(item, dataDia)}
                                className="w-full text-left px-3 py-2 text-[10.5px] text-slate-300 hover:bg-blue-600/10 hover:text-white transition-colors cursor-pointer font-semibold flex items-center justify-between rounded-lg border-0"
                              >
                                <span>{labelDia}</span>
                                <span className="text-slate-650 text-[9px] group-hover:text-blue-400">➔</span>
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => setMenuAbertoIndex(null)}
                          className="w-full text-center py-2 bg-rose-950/20 text-rose-450 hover:bg-rose-950/40 text-[9.5px] font-bold border-t border-slate-800 mt-1.5 rounded-b-lg border-0 cursor-pointer"
                        >
                          Fechar
                        </button>
                      </div>
                    ) : (
                      <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 shadow-2xl z-30 font-sans p-3.5 rounded-xl text-left space-y-3.5 select-none text-[11px]">
                        <div className="border-b border-slate-850 pb-2 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                          🧭 Parametrizar Atividade
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col">
                            <label className="text-[10px] font-semibold text-slate-400 mb-1">Nº Pessoas</label>
                            <input
                              type="number"
                              min="1"
                              value={pessoasAtividade}
                              onChange={(e) => setPessoasAtividade(Math.max(1, Number(e.target.value)))}
                              className="bg-slate-950 border border-slate-800 text-slate-100 px-2.5 py-1 focus:border-emerald-500 focus:outline-none rounded-md text-[10.5px] font-mono-tech"
                            />
                          </div>
                          <div className="flex flex-col">
                            <label className="text-[10px] font-semibold text-slate-400 mb-1">Duração (Dias)</label>
                            <input
                              type="number"
                              min="1"
                              value={duracaoAtividade}
                              onChange={(e) => setDuracaoAtividade(Math.max(1, Number(e.target.value)))}
                              className="bg-slate-950 border border-slate-800 text-slate-100 px-2.5 py-1 focus:border-emerald-500 focus:outline-none rounded-md text-[10.5px] font-mono-tech"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col">
                          <label className="text-[10px] font-semibold text-slate-400 mb-1">Dia de Início</label>
                          <select
                            value={diaInicioAtividade}
                            onChange={(e) => setDiaInicioAtividade(e.target.value)}
                            className="bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 focus:border-emerald-500 focus:outline-none rounded-md text-[10.5px] font-sans cursor-pointer"
                          >
                            <option value="">-- Selecione o Dia --</option>
                            {datasViagem.map((dia, dIdx) => {
                              const dateObj = new Date(dia + "T12:00:00");
                              return (
                                <option key={dia} value={dia}>
                                  Dia {String(dIdx + 1).padStart(2, "0")} - {dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div className="bg-slate-950/40 border border-slate-850 p-2.5 rounded-lg space-y-1 font-mono-tech text-[10px]">
                          <div className="text-slate-400">
                            Custo base: <span className="text-slate-200">R$ {(item as Atividade).valor}/px</span>
                          </div>
                          <div className="text-slate-400">
                            Total: <span className="text-emerald-400 font-bold">R$ {((item as Atividade).valor * pessoasAtividade).toLocaleString("pt-BR")}/dia</span>
                          </div>
                          <div className="text-[9px] text-slate-500 leading-normal border-t border-slate-850 mt-1.5 pt-1 uppercase">
                            Inserido em {duracaoAtividade} dia(s) consecutivo(s).
                          </div>
                        </div>

                        <div className="flex gap-2 select-none pt-0.5">
                          <button
                            type="button"
                            onClick={() => setMenuAbertoIndex(null)}
                            className="flex-1 py-1.5 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/30 text-slate-400 hover:text-slate-300 text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInjetarAtividadeAvancada(item as Atividade)}
                            className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-black rounded-lg cursor-pointer transition-all hover:scale-[1.02] border-0"
                          >
                            Vincular
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Rodapé Informativo */}
      <div className="bg-slate-950/40 border-t border-slate-800/80 p-2 flex items-center justify-between text-[10px] text-slate-500 rounded-b-2xl font-mono-tech select-none">
        <span>Estado: Seleção Ativa</span>
        <span>Scraper API: Ativa</span>
      </div>
    </div>
  );
}
