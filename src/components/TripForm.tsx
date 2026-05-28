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
      setErro("ERRO: TODOS OS PARÂMETROS DA ROTA DEVERÃO SER PREENCHIDOS.");
      emitLog("SYSTEM WARNING: Parâmetros de criação incompletos.");
      return;
    }

    const start = new Date(dataInicio);
    const end = new Date(dataFim);

    if (end < start) {
      setErro("ERRO: DATA DE VOLTA INCOMPATÍVEL COM DATA DE PARTIDA.");
      emitLog("SYSTEM WARNING: Inconsistência cronológica nas datas de ida/volta.");
      return;
    }

    const budgetVal = Number(orcamento);
    if (isNaN(budgetVal) || budgetVal <= 0) {
      setErro("ERRO: ORÇAMENTO OPERACIONAL DEVE SER UM VALOR MAIOR QUE ZERO.");
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
        setErro("FALHA DE PERSISTÊNCIA NA EDIÇÃO: ENTRE EM CONTATO COM O SUPORTE.");
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
      setErro("FALHA DE PERSISTÊNCIA: ENTRE EM CONTATO COM O SUPORTE.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full glass-panel shadow-2xl p-5 text-xs font-sans relative overflow-hidden rounded-2xl select-none">
      {/* Decoração da borda superior */}
      <div className="absolute top-0 left-0 w-full h-[3px] hazard-stripes" />

      <div className="flex items-center justify-between mb-4.5 border-b border-slate-800/80 pb-2.5">
        <span className="text-[#f59e0b] font-black tracking-wider uppercase">
          {viagemParaEditar ? "[ CONSOLE DE EDIÇÃO DE ROTA DE VIAGEM ]" : "[ CONSOLE DE CADASTRO DE NOVA ROTA DE VIAGEM ]"}
        </span>
        <span className="text-[10px] text-slate-500 font-mono-tech uppercase">
          {viagemParaEditar ? "TRIP_EDIT_V3" : "TRIP_ADD_V3"}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4">
        
        {/* Origem com Autocomplete */}
        <div className="flex flex-col relative">
          <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">
            01. LOCAL DE PARTIDA (ORIGEM)
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
            className="bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 focus:border-indigo-500 focus:outline-none placeholder-slate-700 uppercase rounded-lg transition-all duration-150 font-medium tracking-wide shadow-inner"
            autoComplete="off"
          />
          
          {/* Dropdown de sugestões de Origem */}
          {activeDropdown === "origem" && (origemSugestoes.length > 0 || isSearchingOrigem) && (
            <div className="absolute top-full left-0 w-full mt-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-800 z-30 shadow-2xl max-h-48 overflow-y-auto rounded-lg divide-y divide-slate-800/40">
              {isSearchingOrigem ? (
                <div className="p-3 text-slate-500 text-[10px] uppercase animate-pulse font-mono-tech">
                  [ Pesquisando diretório... ]
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
                    className="p-3 hover:bg-slate-800/60 hover:text-[#f59e0b] text-slate-300 cursor-pointer uppercase text-[10.5px] transition-colors font-semibold leading-none"
                  >
                    {sug.label}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Destino com Autocomplete */}
        <div className="flex flex-col relative">
          <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">
            02. DESTINO DA VIAGEM
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
            className="bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 focus:border-indigo-500 focus:outline-none placeholder-slate-700 uppercase rounded-lg transition-all duration-150 font-medium tracking-wide shadow-inner"
            autoComplete="off"
          />
          
          {/* Dropdown de sugestões de Destino */}
          {activeDropdown === "destino" && (destinoSugestoes.length > 0 || isSearchingDestino) && (
            <div className="absolute top-full left-0 w-full mt-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-800 z-30 shadow-2xl max-h-48 overflow-y-auto rounded-lg divide-y divide-slate-800/40">
              {isSearchingDestino ? (
                <div className="p-3 text-slate-500 text-[10px] uppercase animate-pulse font-mono-tech">
                  [ Pesquisando diretório... ]
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
                    className="p-3 hover:bg-slate-800/60 hover:text-[#10b981] text-slate-300 cursor-pointer uppercase text-[10.5px] transition-colors font-semibold leading-none"
                  >
                    {sug.label}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Data Partida */}
        <div className="flex flex-col">
          <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">
            03. DATA IDA (PARTIDA)
          </label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            onClick={(e) => e.currentTarget.showPicker?.()}
            disabled={isLoading}
            className="bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 focus:border-indigo-500 focus:outline-none cursor-pointer rounded-lg transition-all duration-150 font-mono-tech shadow-inner"
          />
        </div>

        {/* Data Volta */}
        <div className="flex flex-col">
          <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">
            04. DATA VOLTA (RETORNO)
          </label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            onClick={(e) => e.currentTarget.showPicker?.()}
            disabled={isLoading}
            className="bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 focus:border-indigo-500 focus:outline-none cursor-pointer rounded-lg transition-all duration-150 font-mono-tech shadow-inner"
          />
        </div>

        {/* Orçamento Máximo */}
        <div className="flex flex-col">
          <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">
            05. ORÇAMENTO MÁXIMO (BRL)
          </label>
          <input
            type="number"
            placeholder="Ex: 5000"
            value={orcamento}
            onChange={(e) => setOrcamento(e.target.value)}
            disabled={isLoading}
            className="bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 focus:border-indigo-500 focus:outline-none placeholder-slate-700 font-mono-tech rounded-lg transition-all duration-150 shadow-inner"
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

        {/* Botões de Ação */}
        <div className="md:col-span-5 flex justify-end gap-3 pt-2 select-none">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4.5 py-2 border border-slate-700 hover:border-slate-500 text-slate-300 hover:bg-slate-800/30 transition-all rounded-lg uppercase cursor-pointer text-[10.5px] font-bold"
          >
            [ DISMISS ]
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2 bg-gradient-to-r from-[#f59e0b] to-amber-600 hover:from-amber-500 hover:to-amber-600 text-white font-bold transition-all uppercase cursor-pointer flex items-center gap-2 rounded-lg text-[10.5px] hover:scale-[1.02] active:scale-[0.98] border-0 shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20"
          >
            {isLoading ? (
              <>
                <span className="w-1.5 h-1.5 bg-white led-amber rounded-full animate-ping" />
                {viagemParaEditar ? "SALVANDO..." : "GRAVANDO..."}
              </>
            ) : (
              viagemParaEditar ? "[ SALVAR ALTERAÇÕES DE ROTA ]" : "[ CONFIRMAR E SALVAR ROTA ]"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
