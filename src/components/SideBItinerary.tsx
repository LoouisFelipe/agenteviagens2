"use client";

import React from "react";
import { RoteiroDiario, Viagem } from "@/services/travelService";

interface SideBItineraryProps {
  datasViagem: string[];
  roteiroDiario: Record<string, RoteiroDiario>;
  onRemoverHospedagem: (dataDia: string) => Promise<void>;
  onRemoverAtividade: (dataDia: string, index: number) => Promise<void>;
  destino: string;
  viagemAtiva: Viagem | null;
  diaAtivoWorkspace?: string | null;
  isModoFoco?: boolean;
  onSalvarCronogramaInline?: (dataDia: string, cronograma: Record<string, string>) => Promise<void>;
}

export default function SideBItinerary({
  datasViagem,
  roteiroDiario,
  onRemoverHospedagem,
  onRemoverAtividade,
  destino,
  viagemAtiva,
  diaAtivoWorkspace,
  isModoFoco = true,
  onSalvarCronogramaInline,
}: SideBItineraryProps) {
  const [diasAbertos, setDiasAbertos] = React.useState<Record<string, boolean>>({});
  const [cronogramaLocal, setCronogramaLocal] = React.useState<Record<string, Record<string, string>>>({});
  const [salvandoDia, setSalvandoDia] = React.useState<Record<string, boolean>>({});

  // Abre o dia focado no Workspace por padrão
  React.useEffect(() => {
    if (diaAtivoWorkspace) {
      setDiasAbertos((prev) => ({
        ...prev,
        [diaAtivoWorkspace]: true,
      }));
    }
  }, [diaAtivoWorkspace]);

  // Sincroniza o cronograma vindo de obterRoteiroDiario para o estado editável local
  React.useEffect(() => {
    const novoCronograma: Record<string, Record<string, string>> = {};
    datasViagem.forEach((dia) => {
      const diario = roteiroDiario[dia];
      const cronogramaExistente = diario?.cronograma_horario || {};
      const horasPadrao = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];
      const inicial: Record<string, string> = {};
      horasPadrao.forEach((h) => {
        inicial[h] = cronogramaExistente[h] || "";
      });
      novoCronograma[dia] = inicial;
    });
    setCronogramaLocal(novoCronograma);
  }, [roteiroDiario, datasViagem]);

  // Atualiza campo digitável local
  const handleInputChange = (dia: string, hora: string, valor: string) => {
    setCronogramaLocal((prev) => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        [hora]: valor,
      },
    }));
  };

  // Dispara o salvamento para um dia específico
  const handleSalvarDia = async (dia: string) => {
    if (!onSalvarCronogramaInline || !cronogramaLocal[dia]) return;
    setSalvandoDia((prev) => ({ ...prev, [dia]: true }));
    try {
      await onSalvarCronogramaInline(dia, cronogramaLocal[dia]);
    } catch (err) {
      console.error(err);
    } finally {
      setSalvandoDia((prev) => ({ ...prev, [dia]: false }));
    }
  };

  // Abre os dias por padrão na inicialização geral
  React.useEffect(() => {
    if (datasViagem.length > 0) {
      setDiasAbertos((prev) => {
        const inicial: Record<string, boolean> = { ...prev };
        datasViagem.forEach((dia, idx) => {
          if (inicial[dia] === undefined) {
            inicial[dia] = idx === 0;
          }
        });
        return inicial;
      });
    }
  }, [datasViagem]);
  
  // Calcula o orçamento diário total (Hospedagem + Soma das atividades)
  const calcularTotalDia = (diario: RoteiroDiario | undefined): number => {
    if (!diario) return 0;
    const custoHospedagem = diario.hospedagem?.preco_diario || 0;
    const custoAtividades = diario.atividades?.reduce((acc, act) => acc + act.valor, 0) || 0;
    return custoHospedagem + custoAtividades;
  };

  // Calcula o orçamento total da viagem inteira
  const calcularTotalViagem = (): number => {
    let total = 0;
    datasViagem.forEach((dataDia) => {
      total += calcularTotalDia(roteiroDiario[dataDia]);
    });
    return total;
  };

  // Retorna um mapeamento de data -> custo acumulado
  const calcularAcumuladoPorDia = (): Record<string, number> => {
    const acumulado: Record<string, number> = {};
    let total = 0;
    datasViagem.forEach((dataDia) => {
      total += calcularTotalDia(roteiroDiario[dataDia]);
      acumulado[dataDia] = total;
    });
    return acumulado;
  };

  const orcamento = viagemAtiva?.orcamento_maximo || 0;
  const custoTotal = calcularTotalViagem();
  const ultrapassou = orcamento > 0 && custoTotal > orcamento;
  const percentualConsumido = orcamento > 0 ? Math.min(100, Math.round((custoTotal / orcamento) * 100)) : 0;
  const acumulados = calcularAcumuladoPorDia();

  // Filtra quais dias serão renderizados
  const diasParaExibir = isModoFoco && diaAtivoWorkspace
    ? datasViagem.filter((dia) => dia === diaAtivoWorkspace)
    : datasViagem;

  return (
    <div className={`w-full glass-panel shadow-xl flex flex-col h-full text-xs font-sans rounded-2xl select-none transition-all duration-300 ${ultrapassou ? "glow-border-rose-pulse" : ""}`}>
      
      {/* Cabeçalho do Roteiro */}
      <div className="bg-slate-950/30 p-3.5 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-t-2xl">
        <div className="flex items-center space-x-2">
          <span className="text-[#f59e0b] font-black tracking-wider text-[11px] uppercase">
            {isModoFoco ? "[ WORKSPACE DIÁRIO DE FOCO ]" : "[ ROTEIRO OPERACIONAL COMPLETO ]"}
          </span>
          <span className="text-slate-650 font-normal">|</span>
          <span className="text-slate-300 font-bold uppercase tracking-wide">{destino}</span>
        </div>
        <div className="bg-indigo-600/10 border border-indigo-500/30 px-3.5 py-1.5 rounded-lg font-bold text-indigo-400 font-mono-tech shadow-md">
          CUSTO ESTIMADO TOTAL: <span className="font-bold">R$ {custoTotal.toLocaleString("pt-BR")}</span>
        </div>
      </div>

      {/* Barra de Medição de Orçamento - Estilo SaaS */}
      {orcamento > 0 && (
        <div className="bg-slate-950/20 border-b border-slate-800/60 px-4 py-3 flex flex-col gap-2 select-none font-sans">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span>📊 CONSUMO DA VERBA:</span>
              <span className="text-slate-200 font-mono-tech font-bold">R$ {custoTotal.toLocaleString("pt-BR")}</span>
              <span className="text-slate-650 font-normal">/</span>
              <span className="text-slate-400 font-mono-tech">R$ {orcamento.toLocaleString("pt-BR")}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className={ultrapassou ? "text-rose-500 font-black animate-pulse" : "text-[#10b981] font-bold"}>
                {percentualConsumido}% CONSUMIDO
              </span>
              
              {ultrapassou && (
                <div className="bg-rose-500/10 border border-rose-500/40 text-rose-500 text-[8px] font-black px-2 py-0.5 animate-pulse select-none tracking-widest uppercase flex items-center gap-1 leading-none rounded-md font-sans shadow-md shadow-rose-500/5">
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full inline-block animate-ping led-red" />
                  [ OVER_BUDGET ]
                </div>
              )}
            </div>
          </div>

          {/* Barra de progresso com hazard styling */}
          <div className="w-full h-2.5 bg-slate-950 border border-slate-850 rounded-full overflow-hidden flex shadow-inner relative">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                ultrapassou
                  ? "bg-gradient-to-r from-rose-500 to-rose-600 shadow-[0_0_8px_rgba(244,63,94,0.4)]"
                  : percentualConsumido > 80
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                  : "bg-gradient-to-r from-[#6366f1] to-indigo-600 shadow-[0_0_8px_rgba(99,102,241,0.4)]"
              }`}
              style={{ width: `${percentualConsumido}%` }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(0,0,0,0.1)_25%,transparent_25%,transparent_50%,rgba(0,0,0,0.1)_50%,rgba(0,0,0,0.1)_75%,transparent_75%,transparent)] bg-[size:8px_8px] pointer-events-none opacity-20" />
          </div>
        </div>
      )}

      {/* Grid de Dias com Visual Timeline */}
      <div className="flex-1 p-4 overflow-y-auto max-h-[520px] bg-slate-950/5 flex flex-col gap-4 pl-7 border-l border-slate-800/40 rounded-b-2xl relative scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {datasViagem.length === 0 ? (
          <div className="py-16 text-center text-slate-600 uppercase font-bold tracking-wider w-full select-none">
            [ AGUARDANDO CRIAÇÃO OU SELEÇÃO DE VIAGEM PARA EXIBIÇÃO ]
          </div>
        ) : (
          diasParaExibir.map((dataDia) => {
            const idx = datasViagem.indexOf(dataDia);
            const diario = roteiroDiario[dataDia] || { hospedagem: null, atividades: [] };
            const dateObj = new Date(dataDia + "T12:00:00");
            const labelDia = `DIA ${String(idx + 1).padStart(2, "0")}`;
            const labelData = dateObj.toLocaleDateString("pt-BR", {
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
            });
            const subtotalDia = calcularTotalDia(diario);
            const acumuladoDia = acumulados[dataDia] || 0;

            const temHospedagem = !!diario.hospedagem;
            const temAtividades = diario.atividades && diario.atividades.length > 0;

            let statusCorNode = "bg-slate-700 border-slate-600";
            let statusLabel = "NÃO ESCALADO";
            if (temHospedagem && temAtividades) {
              statusCorNode = "bg-emerald-500 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]";
              statusLabel = "PRONTO E ESCALADO";
            } else if (temHospedagem) {
              statusCorNode = "bg-amber-500 border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]";
              statusLabel = "VINCULADO HOSPEDAGEM";
            } else if (temAtividades) {
              statusCorNode = "bg-cyan-500 border-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]";
              statusLabel = "VINCULADO ATIVIDADES";
            }

            const isWorkspaceDia = dataDia === diaAtivoWorkspace;
            const isOpen = isModoFoco ? true : !!diasAbertos[dataDia];
            const agendaDia = cronogramaLocal[dataDia] || {};

            return (
              <div
                key={dataDia}
                className={`bg-slate-900/60 backdrop-blur-sm border flex flex-col relative group/day transition-all duration-300 shadow-md rounded-xl ${
                  isWorkspaceDia 
                    ? "border-indigo-500/80 shadow-lg shadow-indigo-500/5 bg-slate-900/85" 
                    : "border-slate-800/80 hover:border-slate-750"
                }`}
              >
                {/* Indicador de Timeline Lateral Arredondado */}
                <div className="absolute -left-[35px] top-[14px] flex items-center justify-center z-10">
                  <div
                    className={`w-3.5 h-3.5 rounded-full border-2 border-slate-950 transition-all duration-305 ${statusCorNode}`}
                    title={`Estado do Dia: ${statusLabel}`}
                  />
                </div>

                {/* Linha conectora vertical pontilhada */}
                {(!isModoFoco && idx < datasViagem.length - 1) && (
                  <div className="absolute -left-[29px] top-6 bottom-0 w-[2px] bg-slate-800/40 pointer-events-none group-hover/day:bg-slate-750 transition-colors" />
                )}

                {/* Cabeçalho do Card de Dia */}
                <div
                  onClick={() => !isModoFoco && setDiasAbertos((prev) => ({ ...prev, [dataDia]: !prev[dataDia] }))}
                  className={`bg-slate-950/40 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 font-bold transition-colors select-none ${
                    isModoFoco ? "cursor-default" : "cursor-pointer hover:bg-slate-950/60"
                  } ${isOpen ? "border-b border-slate-850/80 rounded-t-xl" : "rounded-xl"}`}
                >
                  <div className="flex items-center space-x-2">
                    {!isModoFoco && (
                      <span className="text-slate-500 mr-0.5 text-[9px] w-3">
                        {isOpen ? "▼" : "▶"}
                      </span>
                    )}
                    <span className="text-[#f59e0b] font-black">{labelDia}</span>
                    <span className="text-slate-500 font-normal">|</span>
                    <span className="text-slate-200 uppercase font-sans tracking-wide">{labelData} ({dataDia})</span>
                    {isWorkspaceDia && (
                      <span className="bg-indigo-500/20 text-indigo-400 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider scale-95 shadow">
                        ATIVO_WORKSPACE
                      </span>
                    )}
                  </div>
                  
                  {/* Custo Subtotal & Cumulativo */}
                  <div className="flex items-center space-x-3 text-[10.5px] font-mono-tech text-slate-400 font-semibold select-none flex-wrap">
                    <span className="text-[#10b981] font-bold">
                      SUB: R$ {subtotalDia.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-slate-750">|</span>
                    <span className="text-slate-300 font-bold">
                      CUM: R$ {acumuladoDia.toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>

                {isOpen && (
                  <div className="p-4 flex-1 flex flex-col space-y-4 font-sans animate-fade-in">
                    
                    {/* Grid Principal do Dia - 2 Colunas */}
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
                      
                      {/* Coluna 1: Hospedagem e Passeios */}
                      <div className="xl:col-span-5 space-y-4">
                        {/* Seção 1: Hospedagem */}
                        <div className="space-y-1.5">
                          <div className="text-[9.5px] uppercase font-bold text-slate-450 tracking-wider">
                            🏨 HOSPEDAGEM ALOCADA
                          </div>
                          {diario.hospedagem ? (
                            <div className="bg-slate-950/40 border border-slate-850 p-2.5 flex items-center justify-between gap-3 group rounded-lg shadow-sm">
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-200 truncate uppercase text-[10.5px] tracking-wide">
                                  {diario.hospedagem.nome}
                                </div>
                                <div className="flex items-center space-x-2 mt-0.5 text-[9.5px] font-mono-tech select-none">
                                  <span className="text-[#10b981] font-bold">
                                    R$ {diario.hospedagem.preco_diario}/dia
                                  </span>
                                  <span className="text-slate-700">|</span>
                                  <a
                                    href={diario.hospedagem.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-cyan-400 hover:text-cyan-300 font-bold hover:underline font-sans"
                                  >
                                    TRAVEL ↗
                                  </a>
                                </div>
                              </div>
                              <button
                                onClick={() => onRemoverHospedagem(dataDia)}
                                className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/25 text-rose-500 hover:text-rose-400 rounded-lg uppercase font-bold text-[9px] transition-colors cursor-pointer border-0 shadow-md"
                              >
                                [ REMOVER ]
                              </button>
                            </div>
                          ) : (
                            <div className="border border-dashed border-slate-850 hover:bg-slate-900/10 p-3 text-center text-slate-500 font-bold uppercase text-[9px] rounded-lg tracking-wider bg-slate-950/5 transition-all select-none shadow-inner">
                              SEM HOSPEDAGEM ALOCADA
                            </div>
                          )}
                        </div>

                        {/* Seção 2: Atividades/Passeios */}
                        <div className="space-y-1.5">
                          <div className="text-[9.5px] uppercase font-bold text-slate-450 tracking-wider">
                            🧭 MANIFESTO DE PASSEIOS
                          </div>
                          {diario.atividades && diario.atividades.length > 0 ? (
                            <div className="border border-slate-850 divide-y divide-slate-850/60 bg-slate-950/40 rounded-lg overflow-hidden shadow-sm">
                              {diario.atividades.map((atv, aIdx) => (
                                <div
                                  key={aIdx}
                                  className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-900/20 transition-colors"
                                >
                                  <div className="flex-1 min-w-0 flex items-start space-x-1.5">
                                    <span className="text-slate-500 text-[10px] font-bold mt-0.5 font-mono-tech">
                                      #{String(aIdx + 1).padStart(2, "0")}
                                    </span>
                                    <div className="min-w-0">
                                      <div className="font-bold text-slate-300 truncate uppercase text-[10px] tracking-wide">
                                        {atv.nome}
                                      </div>
                                      <div className="flex items-center space-x-2 text-[9px] mt-0.5 font-mono-tech">
                                        <span className="text-[#10b981] font-bold">
                                          R$ {atv.valor}
                                        </span>
                                        <span className="text-slate-700">|</span>
                                        <a
                                          href={atv.link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-cyan-400 hover:text-cyan-300 font-bold hover:underline font-sans"
                                        >
                                          SITE ↗
                                        </a>
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => onRemoverAtividade(dataDia, aIdx)}
                                    className="w-5 h-5 flex items-center justify-center border-0 bg-rose-500/10 hover:bg-rose-500/25 text-rose-500 rounded-lg transition-all text-[11px] cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="border border-dashed border-slate-850 hover:bg-slate-900/10 p-3 text-center text-slate-500 font-bold uppercase text-[9px] rounded-lg tracking-wider bg-slate-950/5 transition-all select-none shadow-inner">
                              SEM PASSEIOS DIÁRIOS
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Coluna 2: Cronograma Horário Editável Inline (Sem Modais) */}
                      <div className="xl:col-span-7 border border-slate-850/60 bg-slate-950/30 p-3.5 rounded-xl flex flex-col space-y-3.5 relative">
                        <div className="text-[9.5px] uppercase font-bold text-indigo-400 tracking-wider flex items-center justify-between border-b border-slate-850 pb-1.5 select-none font-sans">
                          <span className="flex items-center gap-1">🕒 AGENDA DO DIA (HORÁRIOS)</span>
                          <span className="text-slate-500 text-[8.5px] lowercase font-normal italic">campos editáveis</span>
                        </div>

                        {/* Grid dos inputs de horas */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[175px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                          {Object.keys(agendaDia).sort().map((hora) => (
                            <div key={hora} className="flex items-center gap-2">
                              <span className="w-12 text-center py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold font-mono-tech text-[9.5px] rounded-lg shadow-sm select-none">
                                {hora}
                              </span>
                              <input
                                type="text"
                                placeholder="Inserir atividade..."
                                value={agendaDia[hora] || ""}
                                onChange={(e) => handleInputChange(dataDia, hora, e.target.value)}
                                className="flex-1 bg-slate-950 border border-slate-850/80 text-slate-100 px-2.5 py-1 focus:border-indigo-500 focus:outline-none placeholder-slate-800 text-[10px] font-medium rounded-lg shadow-inner uppercase tracking-wide transition-all"
                                autoComplete="off"
                              />
                            </div>
                          ))}
                        </div>

                        {/* Botão de Salvar Cronograma */}
                        <div className="flex justify-end pt-1 select-none">
                          <button
                            type="button"
                            onClick={() => handleSalvarDia(dataDia)}
                            disabled={salvandoDia[dataDia]}
                            className="w-full sm:w-auto px-4.5 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold transition-all uppercase cursor-pointer rounded-lg text-[9px] shadow-md border-0 disabled:opacity-40"
                          >
                            {salvandoDia[dataDia] ? "SALVANDO..." : "[ ✔️ SALVAR AGENDA DO DIA ]"}
                          </button>
                        </div>
                      </div>

                    </div>

                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Rodapé Informativo */}
      <div className="bg-slate-950/40 border-t border-slate-800/80 p-2 flex items-center justify-between text-[10px] text-slate-500 rounded-b-2xl font-mono-tech select-none">
        <span>ESTADO: {isModoFoco ? "FOCO DIÁRIO ATIVO" : "MANIFESTO GERAL COMPLETO"}</span>
        <span>METRICS: COMPLIANT</span>
      </div>
    </div>
  );
}
