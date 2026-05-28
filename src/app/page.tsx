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

  // Estados para o Modal "Visão dia-a-dia"
  const [diaSelecionadoModal, setDiaSelecionadoModal] = useState<string | null>(null);
  const [modalCronograma, setModalCronograma] = useState<Record<string, string>>({});
  const [isSalvandoCronograma, setIsSalvandoCronograma] = useState(false);

  // Preenche as informações do cronograma do dia selecionado
  const handleSelecionarDia = (dataDia: string) => {
    setDiaSelecionadoModal(dataDia);
    const diario = roteiroDiario[dataDia];
    const cronogramaExistente = diario?.cronograma_horario || {};
    
    // Horários padrão de planejamento diário
    const horasPadrao = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];
    const inicial: Record<string, string> = {};
    horasPadrao.forEach((h) => {
      inicial[h] = cronogramaExistente[h] || "";
    });
    setModalCronograma(inicial);
  };

  // Salva o cronograma horário no Firestore/LocalStorage
  const handleSalvarCronograma = async () => {
    if (!viagemAtiva || !diaSelecionadoModal) return;
    setIsSalvandoCronograma(true);
    try {
      await atualizarCronogramaHorario(viagemAtiva.id, diaSelecionadoModal, modalCronograma);
      // Recarrega cotações e roteiro para atualizar o estado global da página
      const roteiro = await obterRoteiroDiario(viagemAtiva.id);
      setRoteiroDiario(roteiro);
      setDiaSelecionadoModal(null);
    } catch (err) {
      console.error("Erro ao salvar cronograma:", err);
      emitLog("SYSTEM ERROR: Falha ao sincronizar o cronograma de horários.");
    } finally {
      setIsSalvandoCronograma(false);
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
        
        const roteiro = await obterRoteiroDiario(selecionada.id);
        setRoteiroDiario(roteiro);
      } else {
        setViagemAtiva(null);
        setDatasViagem([]);
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

      {/* Status da Rota Ativa */}
      {viagemAtiva && (
        <section className="glass-panel-light shadow-md px-4 py-2.5 flex flex-wrap gap-x-6 gap-y-1.5 font-mono-tech text-[10px] text-slate-400 uppercase select-none rounded-xl border border-slate-850">
          <div>
            ROTA ATIVA: <span className="text-indigo-400 font-bold">{viagemAtiva.origem} ➔ {viagemAtiva.destino}</span>
          </div>
          <div className="hidden sm:block text-slate-800">|</div>
          <div>
            PERÍODO: <span className="text-slate-200 font-semibold">{viagemAtiva.data_inicio} até {viagemAtiva.data_fim}</span>
          </div>
          <div className="hidden md:block text-slate-800">|</div>
          <div>
            VERBA TETO: <span className="text-[#f59e0b] font-bold">R$ {viagemAtiva.orcamento_maximo.toLocaleString("pt-BR")}</span>
          </div>
          <div className="hidden md:block text-slate-800">|</div>
          <div className="hidden md:block">
            CALENDÁRIO: <span className="text-slate-200 font-bold">{datasViagem.length} DIAS ESCALADOS</span>
          </div>
        </section>
      )}

      {/* Timeline de Custos Diários */}
      {viagemAtiva && (
        <TimelineCompact
          datasViagem={datasViagem}
          roteiroDiario={roteiroDiario}
          orcamentoMaximo={viagemAtiva.orcamento_maximo}
          onSelecionarDia={handleSelecionarDia}
        />
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

        {/* Lado B: Roteiro Diário */}
        <div className="lg:col-span-7 flex flex-col h-full">
          <SideBItinerary
            datasViagem={datasViagem}
            roteiroDiario={roteiroDiario}
            onRemoverHospedagem={handleRemoverHospedagem}
            onRemoverAtividade={handleRemoverAtividade}
            destino={viagemAtiva?.destino || "SANTIAGO (SCL)"}
            viagemAtiva={viagemAtiva}
          />
        </div>
      </main>

      {/* Rodapé - Console Transacional de Dados */}
      <footer className="w-full">
        <IndustrialLog />
      </footer>

      {/* MODAL: ROTEIRO DIA-A-DIA POR HORAS */}
      {diaSelecionadoModal && viagemAtiva && (() => {
        const dIdx = datasViagem.indexOf(diaSelecionadoModal);
        const dateObj = new Date(diaSelecionadoModal + "T12:00:00");
        const labelCabecalho = `DIA ${String(dIdx + 1).padStart(2, "0")} - ${dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}`;
        const diario = roteiroDiario[diaSelecionadoModal] || { hospedagem: null, atividades: [] };
        
        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans select-none animate-fade-in">
            <div className="w-full max-w-3xl glass-panel shadow-2xl overflow-hidden rounded-2xl relative border border-slate-800">
              {/* Listras decorativas no topo */}
              <div className="absolute top-0 left-0 w-full h-[3.5px] hazard-stripes" />
              
              {/* Header do Modal */}
              <div className="p-4 bg-slate-950/40 border-b border-slate-850 flex items-center justify-between">
                <div>
                  <h2 className="text-[#f59e0b] font-black uppercase tracking-wider text-xs flex items-center gap-1.5">
                    <span>🗓️ VISÃO DIA-A-DIA OPERACIONAL</span>
                    <span className="text-slate-500 font-mono-tech font-normal text-[10px]">|</span>
                    <span className="text-slate-200">{labelCabecalho}</span>
                  </h2>
                  <p className="text-[9.5px] text-slate-400 uppercase font-semibold tracking-wide mt-0.5 font-mono-tech">
                    DESTINO: {viagemAtiva.destino}
                  </p>
                </div>
                <button
                  onClick={() => setDiaSelecionadoModal(null)}
                  className="px-3.5 py-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-250 transition-colors uppercase font-bold text-[10px] rounded-lg cursor-pointer border-0 shadow"
                >
                  [ FECHAR ]
                </button>
              </div>

              {/* Corpo em Duas Colunas */}
              <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-850 max-h-[70vh] overflow-y-auto">
                
                {/* Coluna Esquerda - Resumo Alocações do Dia */}
                <div className="md:col-span-5 p-4 space-y-4 bg-slate-950/15">
                  <div className="space-y-1.5">
                    <div className="text-[9.5px] uppercase font-bold text-slate-450 tracking-wider">
                      🏨 HOSPEDAGEM ALOCADA
                    </div>
                    {diario.hospedagem ? (
                      <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-lg space-y-1 shadow-sm">
                        <div className="font-bold text-slate-200 uppercase text-[10.5px] tracking-wide">
                          {diario.hospedagem.nome}
                        </div>
                        <div className="text-[10px] font-mono-tech text-[#10b981] font-bold">
                          R$ {diario.hospedagem.preco_diario}/dia
                        </div>
                      </div>
                    ) : (
                      <div className="border border-dashed border-slate-850 hover:bg-slate-900/5 p-3.5 text-center text-slate-500 font-bold uppercase text-[9.5px] rounded-lg tracking-wider transition-colors cursor-default">
                        SEM HOSPEDAGEM ALOCADA
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[9.5px] uppercase font-bold text-slate-455 tracking-wider">
                      🧭 ATIVIDADES DO DIA
                    </div>
                    {diario.atividades && diario.atividades.length > 0 ? (
                      <div className="border border-slate-850 divide-y divide-slate-850/60 bg-slate-950/40 rounded-lg overflow-hidden shadow-sm">
                        {diario.atividades.map((atv, index) => (
                          <div key={index} className="p-2.5 flex items-start gap-2 hover:bg-slate-900/10 transition-colors">
                            <span className="text-slate-500 font-mono-tech text-[9.5px] font-bold mt-0.5">#{String(index + 1).padStart(2, "0")}</span>
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-slate-300 uppercase text-[10px] truncate leading-tight">
                                {atv.nome}
                              </div>
                              <div className="text-[9.5px] font-mono-tech text-cyan-400 font-semibold mt-0.5">
                                R$ {atv.valor}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="border border-dashed border-slate-850 hover:bg-slate-900/5 p-3.5 text-center text-slate-500 font-bold uppercase text-[9.5px] rounded-lg tracking-wider transition-colors cursor-default">
                        SEM PASSEIOS CADASTRADOS
                      </div>
                    )}
                  </div>
                </div>

                {/* Coluna Direita - Agenda Horária Editável */}
                <div className="md:col-span-7 p-4 space-y-3.5">
                  <div className="text-[9.5px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between border-b border-slate-850 pb-1.5">
                    <span>🕒 CRONOGRAMA DE HORÁRIOS DO DIA</span>
                    <span className="text-slate-500 text-[8.5px] lowercase font-normal italic">campo digitável</span>
                  </div>

                  <div className="space-y-2.5 max-h-[42vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                    {Object.keys(modalCronograma).sort().map((hora) => (
                      <div key={hora} className="flex items-center gap-3 group">
                        <span className="w-12 text-center py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold font-mono-tech text-[10px] rounded-lg shadow-sm select-none">
                          {hora}
                        </span>
                        <input
                          type="text"
                          placeholder="Inserir atividade para este horário..."
                          value={modalCronograma[hora]}
                          onChange={(e) => {
                            setModalCronograma({
                              ...modalCronograma,
                              [hora]: e.target.value,
                            });
                          }}
                          className="flex-1 bg-slate-950 border border-slate-850 text-slate-100 px-3 py-1.5 focus:border-indigo-500 focus:outline-none placeholder-slate-700 text-[10.5px] font-medium rounded-lg shadow-inner uppercase tracking-wide transition-all duration-150"
                          autoComplete="off"
                        />
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Rodapé do Modal */}
              <div className="p-3 bg-slate-950/40 border-t border-slate-850 flex justify-end gap-3 select-none">
                <button
                  type="button"
                  onClick={() => setDiaSelecionadoModal(null)}
                  disabled={isSalvandoCronograma}
                  className="px-4.5 py-2 border border-slate-700 hover:border-slate-500 text-slate-350 hover:text-slate-200 transition-all rounded-lg cursor-pointer uppercase text-[10px] font-bold"
                >
                  [ DISMISS ]
                </button>
                <button
                  type="button"
                  onClick={handleSalvarCronograma}
                  disabled={isSalvandoCronograma}
                  className="px-5 py-2 bg-gradient-to-r from-[#f59e0b] to-amber-600 hover:from-amber-500 hover:to-amber-600 text-white font-bold transition-all uppercase cursor-pointer rounded-lg text-[10px] shadow-lg shadow-amber-500/10 hover:scale-[1.01] active:scale-[0.99] border-0"
                >
                  {isSalvandoCronograma ? "SALVANDO..." : "[ ✔️ SALVAR CRONOGRAMA DO DIA ]"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
