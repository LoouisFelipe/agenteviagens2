"use client";

import React, { useState, useEffect } from "react";
import { emitLog, Viagem } from "@/services/travelService";

interface TripFormProps {
  onCriarViagem: (viagem: {
    origem: string;
    destino: string;
    data_inicio: string;
    data_fim: string;
    orcamento: number;
  }) => Promise<void>;
  onClose: () => void;
  viagemParaEditar?: Viagem | null;
  onEditarViagem?: (id: string, viagem: {
    origem: string;
    destino: string;
    data_inicio: string;
    data_fim: string;
    orcamento: number;
  }) => Promise<void>;
}

interface Sugestao {
  label: string;
  valor: string;
}

interface GeocodingResult {
  name: string;
  country_code: string;
  country?: string;
}

// Mapeia cidades conhecidas para seus códigos IATA correspondentes para manter a estética do projeto
function obterIataOuPais(cidade: string, countryCode: string): string {
  const cityLower = cidade.toLowerCase();
  const iatas: Record<string, string> = {
    "são paulo": "GRU",
    "sao paulo": "GRU",
    "santiago": "SCL",
    "rio de janeiro": "GIG",
    "buenos aires": "EZE",
    "nova iorque": "JFK",
    "new york": "JFK",
    "miami": "MIA",
    "londres": "LHR",
    "london": "LHR",
    "paris": "CDG",
    "roma": "FCO",
    "rome": "FCO",
    "lisboa": "LIS",
    "lisbon": "LIS",
    "madrid": "MAD",
    "tóquio": "NRT",
    "tokyo": "NRT",
    "são francisco": "SFO",
    "san francisco": "SFO",
    "lima": "LIM",
    "bogotá": "BOG",
    "bogota": "BOG",
    "montevidéu": "MVD",
    "montevideo": "MVD",
  };
  
  for (const [key, value] of Object.entries(iatas)) {
    if (cityLower.includes(key)) {
      return value;
    }
  }
  return countryCode ? countryCode.toUpperCase() : "GLO";
}

export default function TripForm({
  onCriarViagem,
  onClose,
  viagemParaEditar = null,
  onEditarViagem,
}: TripFormProps) {
  const [origem, setOrigem] = useState(viagemParaEditar?.origem || "");
  const [destino, setDestino] = useState(viagemParaEditar?.destino || "");
  const [dataInicio, setDataInicio] = useState(viagemParaEditar?.data_inicio || "");
  const [dataFim, setDataFim] = useState(viagemParaEditar?.data_fim || "");
  const [orcamento, setOrcamento] = useState(
    viagemParaEditar ? String(viagemParaEditar.orcamento_maximo) : "5000"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState("");

  // Estados de Autocomplete
  const [origemSugestoes, setOrigemSugestoes] = useState<Sugestao[]>([]);
  const [destinoSugestoes, setDestinoSugestoes] = useState<Sugestao[]>([]);
  const [isSearchingOrigem, setIsSearchingOrigem] = useState(false);
  const [isSearchingDestino, setIsSearchingDestino] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<"origem" | "destino" | null>(null);

  // Debouncing simples para as chamadas de API de busca
  useEffect(() => {
    if (origem.trim().length < 2) {
      setOrigemSugestoes([]);
      return;
    }

    // Se o valor já contém o código do aeroporto formatado, não pesquisa novamente
    if (origem.includes("(") && origem.includes(")")) return;

    const delayDebounce = setTimeout(async () => {
      setIsSearchingOrigem(true);
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(origem)}&count=5&language=pt`
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (data.results) {
          const mapped = data.results.map((r: GeocodingResult) => {
            const iataOrPais = obterIataOuPais(r.name, r.country_code);
            return {
              label: `${r.name} (${iataOrPais}) - ${r.country || ""}`,
              valor: `${r.name} (${iataOrPais})`,
            };
          });
          setOrigemSugestoes(mapped);
        } else {
          setOrigemSugestoes([]);
        }
      } catch (err) {
        console.error(err);
        setOrigemSugestoes([]);
      } finally {
        setIsSearchingOrigem(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [origem]);

  useEffect(() => {
    if (destino.trim().length < 2) {
      setDestinoSugestoes([]);
      return;
    }

    if (destino.includes("(") && destino.includes(")")) return;

    const delayDebounce = setTimeout(async () => {
      setIsSearchingDestino(true);
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destino)}&count=5&language=pt`
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (data.results) {
          const mapped = data.results.map((r: GeocodingResult) => {
            const iataOrPais = obterIataOuPais(r.name, r.country_code);
            return {
              label: `${r.name} (${iataOrPais}) - ${r.country || ""}`,
              valor: `${r.name} (${iataOrPais})`,
            };
          });
          setDestinoSugestoes(mapped);
        } else {
          setDestinoSugestoes([]);
        }
      } catch (err) {
        console.error(err);
        setDestinoSugestoes([]);
      } finally {
        setIsSearchingDestino(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [destino]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");

    if (!origem || !destino || !dataInicio || !dataFim || !orcamento) {
      setErro("Todos os parâmetros da rota deverão ser preenchidos.");
      emitLog("SYSTEM WARNING: Parâmetros de criação incompletos.");
      return;
    }

    const start = new Date(dataInicio);
    const end = new Date(dataFim);

    if (end < start) {
      setErro("Data de volta incompatível com a data de partida.");
      emitLog("SYSTEM WARNING: Inconsistência cronológica nas datas de ida/volta.");
      return;
    }

    const budgetVal = Number(orcamento);
    if (isNaN(budgetVal) || budgetVal <= 0) {
      setErro("O orçamento operacional deve ser um valor maior que zero.");
      emitLog("SYSTEM WARNING: Orçamento inválido fornecido.");
      return;
    }

    setIsLoading(true);
    
    if (viagemParaEditar && onEditarViagem) {
      emitLog(`SYSTEM: Iniciando edição de rota ID ${viagemParaEditar.id} (${origem} -> ${destino}) com verba de R$ ${budgetVal}...`);
      try {
        await onEditarViagem(viagemParaEditar.id, {
          origem: origem.trim(),
          destino: destino.trim(),
          data_inicio: dataInicio,
          data_fim: dataFim,
          orcamento: budgetVal,
        });
        onClose();
      } catch (error) {
        console.error(error);
        setErro("Falha ao salvar as alterações da viagem.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    emitLog(`SYSTEM: Iniciando registro de rota ${origem} -> ${destino} com verba de R$ ${budgetVal}...`);

    try {
      await onCriarViagem({
        origem: origem.trim(),
        destino: destino.trim(),
        data_inicio: dataInicio,
        data_fim: dataFim,
        orcamento: budgetVal,
      });
      // Limpa formulário
      setOrigem("");
      setDestino("");
      setDataInicio("");
      setDataFim("");
      setOrcamento("5000");
      onClose();
    } catch (error) {
      console.error(error);
      setErro("Falha ao criar a viagem.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full glass-panel shadow-2xl p-5 text-xs font-sans relative overflow-hidden rounded-2xl select-none">
      {/* Decoração da borda superior */}
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 to-[#007aff]" />

      {/* Modal Header inspired by Image 4 */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-3">
          <span className="bg-blue-600/10 text-[#007aff] p-2.5 rounded-xl text-lg select-none shadow-sm border border-blue-550/15">✈️</span>
          <div>
            <h3 className="text-xs font-black text-slate-100 uppercase tracking-wide leading-none font-heading pt-0.5">
              {viagemParaEditar ? "Editar Rota Operacional" : "Nova Rota Operacional"}
            </h3>
            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider font-mono-tech mt-1">
              {viagemParaEditar ? "trip_edit_system_v3" : "trip_creation_system_v3"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-750 text-slate-500 hover:text-slate-100 rounded-lg cursor-pointer transition-colors text-[10px] font-bold border-0 shadow-inner"
        >
          ✕
        </button>
      </div>

      {/* Sub-tab menu selectors (inspired by Image 4) */}
      <div className="flex border-b border-slate-850/80 mb-4.5 select-none gap-1 bg-slate-950/45 p-1 rounded-xl border border-slate-900">
        <div className="flex-1 py-2 bg-slate-900/60 rounded-lg border border-slate-850/60 text-[#007aff] text-[9.5px] font-black uppercase text-center flex items-center justify-center gap-1.5 cursor-default">
          <span>✈️</span>
          <span>Logística</span>
        </div>
        <div className="flex-1 py-2 text-slate-550 text-[9.5px] font-black uppercase text-center flex items-center justify-center gap-1.5 cursor-default">
          <span>💰</span>
          <span>Orçamento</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4">
        
        {/* Origem com Autocomplete */}
        <div className="flex flex-col relative">
          <label className="text-[9.5px] font-bold text-slate-400 mb-1.5 tracking-wider uppercase">
            01. Local de Partida (Origem)
          </label>
          <input
            type="text"
            placeholder="Ex: São Paulo"
            value={origem}
            onChange={(e) => {
              setOrigem(e.target.value);
              setActiveDropdown("origem");
            }}
            onFocus={() => setActiveDropdown("origem")}
            onBlur={() => setTimeout(() => setActiveDropdown(null), 200)}
            disabled={isLoading}
            className="bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 focus:border-blue-500 focus:outline-none placeholder-slate-750 rounded-lg transition-all duration-150 font-medium tracking-wide shadow-inner"
            autoComplete="off"
          />
          
          {/* Dropdown de sugestões de Origem (inspired by Image 3) */}
          {activeDropdown === "origem" && (origemSugestoes.length > 0 || isSearchingOrigem) && (
            <div className="absolute top-full left-0 w-full mt-1.5 bg-slate-900 border border-slate-800 z-30 shadow-2xl max-h-48 overflow-y-auto rounded-xl divide-y divide-slate-800/40 p-1">
              {isSearchingOrigem ? (
                <div className="p-3 text-slate-500 text-[10px] animate-pulse font-mono-tech">
                  Pesquisando...
                </div>
              ) : (
                origemSugestoes.map((sug, sIdx) => (
                  <div
                    key={sIdx}
                    onMouseDown={() => {
                      setOrigem(sug.valor);
                      setOrigemSugestoes([]);
                      setActiveDropdown(null);
                    }}
                    className="p-2.5 hover:bg-[#007aff] hover:text-white text-slate-300 cursor-pointer text-[10px] transition-colors font-semibold leading-none rounded-lg flex items-center justify-between"
                  >
                    <span>{sug.label}</span>
                    <span className="text-[10px] opacity-0 hover:opacity-100">✓</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Destino com Autocomplete */}
        <div className="flex flex-col relative">
          <label className="text-[9.5px] font-bold text-slate-400 mb-1.5 tracking-wider uppercase">
            02. Destino da Viagem
          </label>
          <input
            type="text"
            placeholder="Ex: Santiago"
            value={destino}
            onChange={(e) => {
              setDestino(e.target.value);
              setActiveDropdown("destino");
            }}
            onFocus={() => setActiveDropdown("destino")}
            onBlur={() => setTimeout(() => setActiveDropdown(null), 200)}
            disabled={isLoading}
            className="bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 focus:border-blue-500 focus:outline-none placeholder-slate-750 rounded-lg transition-all duration-150 font-medium tracking-wide shadow-inner"
            autoComplete="off"
          />
          
          {/* Dropdown de sugestões de Destino (inspired by Image 3) */}
          {activeDropdown === "destino" && (destinoSugestoes.length > 0 || isSearchingDestino) && (
            <div className="absolute top-full left-0 w-full mt-1.5 bg-slate-900 border border-slate-800 z-30 shadow-2xl max-h-48 overflow-y-auto rounded-xl divide-y divide-slate-800/40 p-1">
              {isSearchingDestino ? (
                <div className="p-3 text-slate-500 text-[10px] animate-pulse font-mono-tech">
                  Pesquisando...
                </div>
              ) : (
                destinoSugestoes.map((sug, sIdx) => (
                  <div
                    key={sIdx}
                    onMouseDown={() => {
                      setDestino(sug.valor);
                      setDestinoSugestoes([]);
                      setActiveDropdown(null);
                    }}
                    className="p-2.5 hover:bg-[#007aff] hover:text-white text-slate-300 cursor-pointer text-[10px] transition-colors font-semibold leading-none rounded-lg flex items-center justify-between"
                  >
                    <span>{sug.label}</span>
                    <span className="text-[10px] opacity-0 hover:opacity-100">✓</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Data Partida */}
        <div className="flex flex-col">
          <label className="text-[9.5px] font-bold text-slate-400 mb-1.5 tracking-wider uppercase">
            03. Data Ida (Partida)
          </label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            onClick={(e) => e.currentTarget.showPicker?.()}
            disabled={isLoading}
            className="bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 focus:border-blue-500 focus:outline-none cursor-pointer rounded-lg transition-all duration-150 font-mono-tech shadow-inner"
          />
        </div>

        {/* Data Volta */}
        <div className="flex flex-col">
          <label className="text-[9.5px] font-bold text-slate-400 mb-1.5 tracking-wider uppercase">
            04. Data Volta (Retorno)
          </label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            onClick={(e) => e.currentTarget.showPicker?.()}
            disabled={isLoading}
            className="bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 focus:border-blue-500 focus:outline-none cursor-pointer rounded-lg transition-all duration-150 font-mono-tech shadow-inner"
          />
        </div>

        {/* Orçamento Máximo */}
        <div className="flex flex-col">
          <label className="text-[9.5px] font-bold text-slate-400 mb-1.5 tracking-wider uppercase">
            05. Orçamento Máximo (BRL)
          </label>
          <input
            type="number"
            placeholder="Ex: 5000"
            value={orcamento}
            onChange={(e) => setOrcamento(e.target.value)}
            disabled={isLoading}
            className="bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 focus:border-blue-500 focus:outline-none placeholder-slate-750 font-mono-tech rounded-lg transition-all duration-150 shadow-inner"
            min="1"
          />
        </div>

        {/* Mensagem de Erro */}
        {erro && (
          <div className="md:col-span-5 bg-rose-950/20 border border-rose-900/40 text-rose-400 p-3 rounded-lg flex items-center gap-2 font-mono-tech shadow-md">
            <span className="w-1.5 h-1.5 bg-rose-500 led-red rounded-full animate-ping" />
            <span className="font-bold tracking-wide">{erro}</span>
          </div>
        )}

        {/* Botões de Ação (inspired by Image 4) */}
        <div className="md:col-span-5 flex justify-end gap-3 pt-2.5 select-none font-sans">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4.5 py-2.5 border border-slate-800 hover:border-slate-650 hover:bg-slate-900/20 text-slate-400 hover:text-slate-200 transition-colors rounded-lg cursor-pointer text-[10px] font-bold uppercase"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2.5 bg-gradient-to-r from-[#007aff] to-blue-600 hover:from-blue-550 hover:to-blue-600 text-white font-bold transition-all cursor-pointer flex items-center gap-2 rounded-lg text-[10px] hover:scale-[1.01] active:scale-[0.99] border-0 shadow-lg shadow-blue-500/20 uppercase"
          >
            {isLoading ? (
              <>
                <span className="w-1.5 h-1.5 bg-white led-blue rounded-full animate-ping" />
                {viagemParaEditar ? "Sincronizando..." : "Registrando..."}
              </>
            ) : (
              viagemParaEditar ? "Salvar Alterações" : "Gravar Rota Operacional"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
