"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  listarViagens,
  criarViagem,
  editarViagem,
  obterRoteiroDiario,
  atualizarHospedagemDia,
  adicionarAtividadeDia,
  removerHospedagemDia,
  removerAtividadeDia,
  atualizarCotacoesOnDemand,
  atualizarCronogramaHorario,
  Viagem,
  RoteiroDiario,
  Hospedagem,
  Atividade,
  emitLog,
} from "@/services/travelService";

import TripSelector from "@/components/TripSelector";
import TripForm from "@/components/TripForm";
import SideAList from "@/components/SideAList";
import SideBItinerary from "@/components/SideBItinerary";
import IndustrialLog from "@/components/IndustrialLog";
import TimelineCompact from "@/components/TimelineCompact";

// Helper para gerar as datas cronologicamente entre início e fim sem bugs de timezone
function gerarDiasPeriodo(dataInicio: string, dataFim: string): string[] {
  if (!dataInicio || !dataFim) return [];
  const start = new Date(dataInicio + "T12:00:00");
  const end = new Date(dataFim + "T12:00:00");
  const datas: string[] = [];

  const current = new Date(start);
  while (current <= end) {
    datas.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  return datas;
}

export default function Home() {
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [viagemAtiva, setViagemAtiva] = useState<Viagem | null>(null);
  const [datasViagem, setDatasViagem] = useState<string[]>([]);
  const [roteiroDiario, setRoteiroDiario] = useState<Record<string, RoteiroDiario>>({});
  const [isFormCriacaoAberto, setIsFormCriacaoAberto] = useState(false);
  const [isFormEdicaoAberto, setIsFormEdicaoAberto] = useState(false);
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);

  // Estados para o Workspace Focado (Redesenho UX Premium)
  const [diaAtivoWorkspace, setDiaAtivoWorkspace] = useState<string | null>(null);
  const [isModoFoco, setIsModoFoco] = useState(true);

  // Salva o cronograma horário inline diretamente do Sidebar sem modal
  const handleSalvarCronogramaInline = async (dataDia: string, cronograma: Record<string, string>) => {
    if (!viagemAtiva) return;
    try {
      await atualizarCronogramaHorario(viagemAtiva.id, dataDia, cronograma);
      const roteiro = await obterRoteiroDiario(viagemAtiva.id);
      setRoteiroDiario(roteiro);
      emitLog(`SYSTEM: Cronograma do dia ${dataDia} atualizado com sucesso.`);
    } catch (err) {
      console.error("Erro ao salvar cronograma inline:", err);
      emitLog("SYSTEM ERROR: Falha ao sincronizar o cronograma de horários.");
    }
  };

  // Carrega todas as viagens salvas
  const carregarDadosViagens = useCallback(async (activeIdToSet?: string) => {
    try {
      const lista = await listarViagens();
      setViagens(lista);

      if (lista.length > 0) {
        // Se houver um ID específico solicitado, foca nele, senão foca na primeira viagem
        const selecionada = lista.find((v) => v.id === activeIdToSet) || lista[0];
        setViagemAtiva(selecionada);
        
        const dias = gerarDiasPeriodo(selecionada.data_inicio, selecionada.data_fim);
        setDatasViagem(dias);
        if (dias.length > 0) {
          setDiaAtivoWorkspace(dias[0]);
        }
        
        const roteiro = await obterRoteiroDiario(selecionada.id);
        setRoteiroDiario(roteiro);
      } else {
        setViagemAtiva(null);
        setDatasViagem([]);
        setDiaAtivoWorkspace(null);
        setRoteiroDiario({});
      }
    } catch (err) {
      console.error("Erro ao carregar lista de viagens:", err);
      emitLog("SYSTEM ERROR: Falha de comunicação ao listar viagens.");
    }
  }, []);

  // Inicialização
  useEffect(() => {
    carregarDadosViagens();
  }, [carregarDadosViagens]);

  // Handler para trocar de viagem ativa
  const handleSelecionarViagem = async (id: string) => {
    const selecionada = viagens.find((v) => v.id === id);
    if (selecionada) {
      emitLog(`SYSTEM: Alternando painel operacional para a Rota: [${selecionada.destino}]`);
      setViagemAtiva(selecionada);
      const dias = gerarDiasPeriodo(selecionada.data_inicio, selecionada.data_fim);
      setDatasViagem(dias);
      if (dias.length > 0) {
        setDiaAtivoWorkspace(dias[0]);
      }
      const roteiro = await obterRoteiroDiario(selecionada.id);
      setRoteiroDiario(roteiro);
    }
  };

  // Handler para criar nova viagem com suporte a orçamento
  const handleCriarViagem = async (novaViagemData: {
    origem: string;
    destino: string;
    data_inicio: string;
    data_fim: string;
    orcamento: number;
  }) => {
    const payload = {
      usuario_id: "operator-01",
      origem: novaViagemData.origem,
      destino: novaViagemData.destino,
      data_inicio: novaViagemData.data_inicio,
      data_fim: novaViagemData.data_fim,
      orcamento_maximo: novaViagemData.orcamento,
    };
    const novoId = await criarViagem(payload);
    // Recarrega a base e seleciona automaticamente a nova viagem ativa
    await carregarDadosViagens(novoId);
    setIsFormCriacaoAberto(false);
  };

  // Handler para editar viagem existente
  const handleEditarViagem = async (
    id: string,
    novaViagemData: {
      origem: string;
      destino: string;
      data_inicio: string;
      data_fim: string;
      orcamento: number;
    }
  ) => {
    await editarViagem(
      id,
      novaViagemData.origem,
      novaViagemData.destino,
      novaViagemData.data_inicio,
      novaViagemData.data_fim,
      novaViagemData.orcamento
    );
    // Recarrega a base e foca na viagem editada
    await carregarDadosViagens(id);
    setIsFormEdicaoAberto(false);
  };

  // Lado A ➔ Injetar Hospedagem (Otimista)
  const handleInjetarHospedagem = async (dataDia: string, hospedagem: Hospedagem) => {
    if (!viagemAtiva) return;
    
    // Armazena estado antigo para reversão
    const backupRoteiro = { ...roteiroDiario };
    
    // Atualiza o estado da UI instantaneamente
    const otimistaRoteiro = { ...roteiroDiario };
    if (!otimistaRoteiro[dataDia]) {
      otimistaRoteiro[dataDia] = { hospedagem: null, atividades: [] };
    }
    otimistaRoteiro[dataDia] = {
      ...otimistaRoteiro[dataDia],
      hospedagem,
    };
    setRoteiroDiario(otimistaRoteiro);
    emitLog(`OPTIMISTIC: Hospedagem [${hospedagem.nome}] injetada na interface no dia ${dataDia}.`);

    try {
      await atualizarHospedagemDia(viagemAtiva.id, dataDia, hospedagem);
      const confirmado = await obterRoteiroDiario(viagemAtiva.id);
      setRoteiroDiario(confirmado);
    } catch {
      setRoteiroDiario(backupRoteiro);
      emitLog("OPTIMISTIC ERROR: Falha ao sincronizar hospedagem no banco. Ação revertida.");
    }
  };

  // Lado A ➔ Injetar Atividade (Otimista)
  const handleInjetarAtividade = async (dataDia: string, atividade: Atividade) => {
    if (!viagemAtiva) return;
    
    // Armazena estado antigo para reversão
    const backupRoteiro = { ...roteiroDiario };
    
    // Atualiza o estado da UI instantaneamente
    const otimistaRoteiro = { ...roteiroDiario };
    if (!otimistaRoteiro[dataDia]) {
      otimistaRoteiro[dataDia] = { hospedagem: null, atividades: [] };
    }
    otimistaRoteiro[dataDia] = {
      ...otimistaRoteiro[dataDia],
      atividades: [...otimistaRoteiro[dataDia].atividades, atividade],
    };
    setRoteiroDiario(otimistaRoteiro);
    emitLog(`OPTIMISTIC: Atividade [${atividade.nome}] injetada na interface no dia ${dataDia}.`);

    try {
      await adicionarAtividadeDia(viagemAtiva.id, dataDia, atividade);
      const confirmado = await obterRoteiroDiario(viagemAtiva.id);
      setRoteiroDiario(confirmado);
    } catch {
      setRoteiroDiario(backupRoteiro);
      emitLog("OPTIMISTIC ERROR: Falha ao sincronizar atividade no banco. Ação revertida.");
    }
  };

  // Lado B ➔ Remover Hospedagem (Otimista)
  const handleRemoverHospedagem = async (dataDia: string) => {
    if (!viagemAtiva) return;
    
    const backupRoteiro = { ...roteiroDiario };
    
    const otimistaRoteiro = { ...roteiroDiario };
    if (otimistaRoteiro[dataDia]) {
      otimistaRoteiro[dataDia] = {
        ...otimistaRoteiro[dataDia],
        hospedagem: null,
      };
    }
    setRoteiroDiario(otimistaRoteiro);
    emitLog(`OPTIMISTIC: Hospedagem removida da interface no dia ${dataDia}.`);

    try {
      await removerHospedagemDia(viagemAtiva.id, dataDia);
      const confirmado = await obterRoteiroDiario(viagemAtiva.id);
      setRoteiroDiario(confirmado);
    } catch {
      setRoteiroDiario(backupRoteiro);
      emitLog("OPTIMISTIC ERROR: Falha ao remover hospedagem do banco. Ação revertida.");
    }
  };

  // Lado B ➔ Remover Atividade (Otimista)
  const handleRemoverAtividade = async (dataDia: string, index: number) => {
    if (!viagemAtiva) return;
    
    const backupRoteiro = { ...roteiroDiario };
    
    const otimistaRoteiro = { ...roteiroDiario };
    if (otimistaRoteiro[dataDia] && otimistaRoteiro[dataDia].atividades) {
      const novasAtividades = [...otimistaRoteiro[dataDia].atividades];
      novasAtividades.splice(index, 1);
      otimistaRoteiro[dataDia] = {
        ...otimistaRoteiro[dataDia],
        atividades: novasAtividades,
      };
    }
    setRoteiroDiario(otimistaRoteiro);
    emitLog(`OPTIMISTIC: Atividade index #${index} removida da interface no dia ${dataDia}.`);

    try {
      await removerAtividadeDia(viagemAtiva.id, dataDia, index);
      const confirmado = await obterRoteiroDiario(viagemAtiva.id);
      setRoteiroDiario(confirmado);
    } catch {
      setRoteiroDiario(backupRoteiro);
      emitLog("OPTIMISTIC ERROR: Falha ao remover atividade do banco. Ação revertida.");
    }
  };

  // Dispara o JOB transacional de atualização de preços sob demanda
  const handleAtualizarCotacoes = async () => {
    if (!viagemAtiva) return;
    setIsUpdatingPrices(true);
    try {
      await atualizarCotacoesOnDemand(viagemAtiva.id);
      // Recarrega as cotações na UI
      const roteiro = await obterRoteiroDiario(viagemAtiva.id);
      setRoteiroDiario(roteiro);
    } catch (err) {
      console.error("Falha ao rodar JOB de preços:", err);
      emitLog("SYSTEM ERROR: Falha crítica na cotação automática.");
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen p-4 md:p-6 space-y-4 max-w-7xl mx-auto selection:bg-indigo-500/30 relative">
      {/* Mesh Glowing Blobs no background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10 select-none rounded-3xl">
        <div className="glass-blob animate-drift-1 bg-indigo-600/10 w-[500px] h-[500px] -top-40 -left-40" />
        <div className="glass-blob animate-drift-2 bg-emerald-500/5 w-[600px] h-[600px] top-[40%] -right-40" />
        <div className="glass-blob animate-drift-3 bg-amber-500/5 w-[450px] h-[450px] -bottom-20 left-[20%]" />
      </div>

      {/* Cabeçalho de Comando SaaS */}
      <header className="w-full glass-panel shadow-xl shadow-slate-950/20 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 relative overflow-hidden rounded-2xl select-none">
        {/* Faixa decorativa indigo moderna */}
        <div className="absolute top-0 left-0 w-full h-[3px] hazard-stripes" />
        
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 text-white p-2 rounded-lg font-black text-sm tracking-widest shadow-lg shadow-indigo-500/20 select-none">
            CHL
          </div>
          <div>
            <h1 className="text-sm font-black tracking-widest text-slate-100 uppercase font-sans">
              CHILINHO GESTÃO DE VIAGENS
            </h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">
              PAINEL CORPORATIVO DE INTEGRALIZAÇÃO DE ROTAS
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          {viagemAtiva && (
            <button
              onClick={handleAtualizarCotacoes}
              disabled={isUpdatingPrices}
              className="px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/40 hover:border-indigo-400 text-indigo-400 hover:text-indigo-300 text-[10px] font-bold uppercase transition-all duration-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:hover:bg-transparent rounded-lg font-mono-tech shadow-md"
            >
              {isUpdatingPrices ? (
                <>
                  <span className="w-1.5 h-1.5 bg-indigo-500 led-blue rounded-full animate-ping" />
                  RE-COTANDO VALORES...
                </>
              ) : (
                <>
                  <span>🔄</span>
                  <span>[ ATUALIZAR COTAÇÕES ]</span>
                </>
              )}
            </button>
          )}

          <div className="flex items-center space-x-3.5 font-mono-tech text-[10px] bg-slate-950/40 px-3.5 py-1.5 border border-slate-800/80 rounded-lg h-9 shadow-inner">
            <div className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full led-green animate-pulse" />
              <span className="text-[#10b981] font-bold">ONLINE</span>
            </div>
            <span className="text-slate-800">|</span>
            <span className="text-slate-400">SYS_TIME: 2026-05-25</span>
          </div>
        </div>
      </header>

      {/* Seletor & Cadastro de Viagens */}
      <section className="space-y-3">
        <TripSelector
          viagens={viagens}
          viagemAtiva={viagemAtiva}
          onSelecionarViagem={handleSelecionarViagem}
          onToggleFormCriacao={() => {
            setIsFormCriacaoAberto(!isFormCriacaoAberto);
            setIsFormEdicaoAberto(false);
          }}
          isFormCriacaoAberto={isFormCriacaoAberto}
          onToggleFormEdicao={() => {
            setIsFormEdicaoAberto(!isFormEdicaoAberto);
            setIsFormCriacaoAberto(false);
          }}
        />

        {isFormCriacaoAberto && (
          <TripForm
            onCriarViagem={handleCriarViagem}
            onClose={() => setIsFormCriacaoAberto(false)}
          />
        )}

        {isFormEdicaoAberto && viagemAtiva && (
          <TripForm
            onCriarViagem={handleCriarViagem}
            onClose={() => setIsFormEdicaoAberto(false)}
            viagemParaEditar={viagemAtiva}
            onEditarViagem={handleEditarViagem}
          />
        )}
      </section>

      {/* Grade de KPIs Premium (Micro/Macro Cards) */}
      {viagemAtiva && (() => {
        const calcularTotalDiaLocal = (diario: RoteiroDiario | undefined): number => {
          if (!diario) return 0;
          const custoHospedagem = diario.hospedagem?.preco_diario || 0;
          const custoAtividades = diario.atividades?.reduce((acc, act) => acc + act.valor, 0) || 0;
          return custoHospedagem + custoAtividades;
        };

        const custoTotal = datasViagem.reduce((acc, dia) => acc + calcularTotalDiaLocal(roteiroDiario[dia]), 0);
        const orcamento = viagemAtiva.orcamento_maximo || 0;
        const ultrapassou = orcamento > 0 && custoTotal > orcamento;
        const percentualConsumido = orcamento > 0 ? Math.min(100, Math.round((custoTotal / orcamento) * 100)) : 0;

        const diasCompletos = datasViagem.filter(dia => !!roteiroDiario[dia]?.hospedagem).length;
        const percentualDiasCompletos = datasViagem.length > 0 ? Math.round((diasCompletos / datasViagem.length) * 100) : 0;

        const financialGlowClass = ultrapassou 
          ? "border-rose-500/50 shadow-lg shadow-rose-500/10" 
          : percentualConsumido > 80 
            ? "border-amber-500/50 shadow-lg shadow-amber-500/10" 
            : "border-indigo-500/35 shadow-lg shadow-indigo-500/5";

        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full select-none">
            {/* Card 1: Rota */}
            <div className="glass-panel-light p-4 rounded-2xl border border-slate-800 flex items-center gap-4 glow-card-indigo relative overflow-hidden transition-all duration-300">
              <div className="absolute top-0 left-0 w-[4px] h-full bg-indigo-600" />
              <div className="text-3xl">✈️</div>
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-mono-tech text-slate-500 uppercase tracking-widest">Conexão de Tráfego</div>
                <div className="text-sm font-black text-slate-100 uppercase tracking-wide truncate mt-0.5">
                  {viagemAtiva.origem.replace(/ \(.*\)/, "")} ➔ {viagemAtiva.destino.replace(/ \(.*\)/, "")}
                </div>
                <div className="text-[9.5px] font-mono-tech text-indigo-400 mt-1 uppercase">
                  {viagemAtiva.data_inicio} a {viagemAtiva.data_fim}
                </div>
              </div>
            </div>

            {/* Card 2: Orçamento */}
            <div className={`glass-panel-light p-4 rounded-2xl border flex items-center gap-4 relative overflow-hidden transition-all duration-300 ${financialGlowClass}`}>
              <div className={`absolute top-0 left-0 w-[4px] h-full ${ultrapassou ? "bg-rose-500" : percentualConsumido > 80 ? "bg-amber-500" : "bg-emerald-500"}`} />
              <div className="text-3xl">📊</div>
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-mono-tech text-slate-500 uppercase tracking-widest">Orçamento Operacional</div>
                <div className="text-sm font-black text-slate-100 mt-0.5 flex items-baseline gap-1.5 font-mono-tech">
                  <span className={ultrapassou ? "text-rose-400" : "text-[#10b981]"}>
                    R$ {custoTotal.toLocaleString("pt-BR")}
                  </span>
                  <span className="text-slate-650 text-xs">/</span>
                  <span className="text-slate-400 text-xs">
                    R$ {orcamento.toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 select-none">
                  <span className={`text-[9.5px] font-bold uppercase tracking-wider ${ultrapassou ? "text-rose-400 animate-pulse" : "text-[#10b981]"}`}>
                    {percentualConsumido}% CONSUMIDO
                  </span>
                  {ultrapassou && (
                    <span className="text-[8px] bg-rose-500/20 text-rose-500 font-bold px-1.5 py-0.5 rounded uppercase led-red tracking-widest font-sans scale-90">
                      OVER_BUDGET
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Card 3: Eficiência */}
            <div className="glass-panel-light p-4 rounded-2xl border border-slate-800 flex items-center gap-4 glow-card-emerald relative overflow-hidden transition-all duration-300">
              <div className="absolute top-0 left-0 w-[4px] h-full bg-[#10b981]" />
              <div className="text-3xl">⚙️</div>
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-mono-tech text-slate-500 uppercase tracking-widest">Cobertura de Alocação</div>
                <div className="text-sm font-black text-slate-100 uppercase tracking-wide truncate mt-0.5 font-mono-tech">
                  {diasCompletos} / {datasViagem.length} dias prontos
                </div>
                <div className="text-[9.5px] font-mono-tech text-[#10b981] mt-1 uppercase">
                  {percentualDiasCompletos}% de dias planejados
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Timeline de Custos Diários (Micro-Cards Grid) */}
      {viagemAtiva && (
        <TimelineCompact
          datasViagem={datasViagem}
          roteiroDiario={roteiroDiario}
          orcamentoMaximo={viagemAtiva.orcamento_maximo}
          onSelecionarDia={(dia) => setDiaAtivoWorkspace(dia)}
          diaAtivoWorkspace={diaAtivoWorkspace}
        />
      )}

      {/* Workspace Header & Modo Toggle */}
      {viagemAtiva && diaAtivoWorkspace && (
        <div className="w-full flex items-center justify-between border-b border-slate-850 pb-2.5 mt-1 select-none">
          <div className="flex items-center space-x-3">
            <span className="text-[#f59e0b] font-black text-[10.5px] uppercase tracking-wider font-sans flex items-center gap-2">
              <span>⚡ WORKSPACE OPERACIONAL DE FOCO:</span>
              <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono-tech px-2.5 py-0.5 rounded-lg text-[10px]">
                DIA {datasViagem.indexOf(diaAtivoWorkspace) + 1} ➔ {new Date(diaAtivoWorkspace + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ({diaAtivoWorkspace})
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsModoFoco(!isModoFoco)}
              className={`px-4.5 py-1.5 font-mono-tech text-[9px] font-bold rounded-lg border transition-all duration-200 uppercase cursor-pointer ${
                isModoFoco
                  ? "bg-indigo-600/10 border-indigo-500/40 text-indigo-400 hover:bg-indigo-600/25"
                  : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-350"
              }`}
            >
              {isModoFoco ? "[ ⚡ MODO: FOCO DIÁRIO ]" : "[ 🌐 MODO: VISÃO COMPLETA ]"}
            </button>
          </div>
        </div>
      )}

      {/* Painel Dividido Principal (Lado A e Lado B) */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch flex-1">
        {/* Lado A: Hospedagens e Atividades */}
        <div className="lg:col-span-5 flex flex-col h-full">
          <SideAList
            datasViagem={datasViagem}
            onInjetarHospedagem={handleInjetarHospedagem}
            onInjetarAtividade={handleInjetarAtividade}
            viagemDestino={viagemAtiva?.destino || "SANTIAGO"}
          />
        </div>

        {/* Lado B: Roteiro Diário (Macro-View) */}
        <div className="lg:col-span-7 flex flex-col h-full">
          <SideBItinerary
            datasViagem={datasViagem}
            roteiroDiario={roteiroDiario}
            onRemoverHospedagem={handleRemoverHospedagem}
            onRemoverAtividade={handleRemoverAtividade}
            destino={viagemAtiva?.destino || "SANTIAGO (SCL)"}
            viagemAtiva={viagemAtiva}
            diaAtivoWorkspace={diaAtivoWorkspace}
            isModoFoco={isModoFoco}
            onSalvarCronogramaInline={handleSalvarCronogramaInline}
          />
        </div>
      </main>

      {/* Rodapé - Console Transacional de Dados */}
      <footer className="w-full">
        <IndustrialLog />
      </footer>
    </div>
  );
}
