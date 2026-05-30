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
  adicionarDespesaDia,
  removerDespesaDia,
  atualizarCotacoesOnDemand,
  atualizarCronogramaHorario,
  deletarViagem,
  Viagem,
  RoteiroDiario,
  Hospedagem,
  Atividade,
  emitLog,
} from "@/services/travelService";

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

  // Controle de Abas no Sidebar
  const [activeTab, setActiveTab] = useState<"dashboard" | "cronograma" | "banco" | "logs">("dashboard");

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

      if (activeIdToSet) {
        const selecionada = lista.find((v) => v.id === activeIdToSet);
        if (selecionada) {
          setViagemAtiva(selecionada);
          const dias = gerarDiasPeriodo(selecionada.data_inicio, selecionada.data_fim);
          setDatasViagem(dias);
          if (dias.length > 0) {
            setDiaAtivoWorkspace(dias[0]);
          }
          const roteiro = await obterRoteiroDiario(selecionada.id);
          setRoteiroDiario(roteiro);
        }
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
      setActiveTab("dashboard"); // Reseta para a dashboard ao focar
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

  // Handler para deletar uma viagem definitivamente
  const handleDeletarViagem = async (e: React.MouseEvent, id: string, destino: string) => {
    e.stopPropagation();
    if (confirm(`⚠️ Tem certeza que deseja excluir a viagem para ${destino}?\nEsta ação é permanente e apagará todos os dados associados no banco de dados.`)) {
      try {
        await deletarViagem(id);
        emitLog(`SYSTEM: Viagem ID ${id} excluída definitivamente do banco de dados.`);
        if (viagemAtiva?.id === id) {
          setViagemAtiva(null);
          setDatasViagem([]);
          setDiaAtivoWorkspace(null);
          setRoteiroDiario({});
        }
        await carregarDadosViagens();
      } catch (err) {
        console.error("Erro ao deletar viagem:", err);
        emitLog("SYSTEM ERROR: Falha ao excluir viagem.");
      }
    }
  };

  // Lado A ➔ Injetar Hospedagem (Otimista)
  const handleInjetarHospedagem = async (dataDia: string, hospedagem: Hospedagem) => {
    if (!viagemAtiva) return;

    const backupRoteiro = { ...roteiroDiario };
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

    const backupRoteiro = { ...roteiroDiario };
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

  // Lado A/B ➔ Injetar Despesa (Otimista)
  const handleInjetarDespesa = async (dataDia: string, despesa: { nome: string; valor: number; categoria: string }) => {
    if (!viagemAtiva) return;

    const backupRoteiro = { ...roteiroDiario };
    const otimistaRoteiro = { ...roteiroDiario };
    if (!otimistaRoteiro[dataDia]) {
      otimistaRoteiro[dataDia] = { hospedagem: null, atividades: [], despesas: [] };
    }
    if (!otimistaRoteiro[dataDia].despesas) {
      otimistaRoteiro[dataDia].despesas = [];
    }

    const tempId = "exp_" + Math.random().toString(36).substring(2, 9);
    otimistaRoteiro[dataDia] = {
      ...otimistaRoteiro[dataDia],
      despesas: [...(otimistaRoteiro[dataDia].despesas || []), { id: tempId, diaId: dataDia, ...despesa }],
    };
    setRoteiroDiario(otimistaRoteiro);
    emitLog(`OPTIMISTIC: Despesa [${despesa.nome}] injetada na interface no dia ${dataDia}.`);

    try {
      await adicionarDespesaDia(viagemAtiva.id, dataDia, despesa);
      const confirmado = await obterRoteiroDiario(viagemAtiva.id);
      setRoteiroDiario(confirmado);
    } catch {
      setRoteiroDiario(backupRoteiro);
      emitLog("OPTIMISTIC ERROR: Falha ao sincronizar despesa no banco. Ação revertida.");
    }
  };

  // Lado B ➔ Remover Despesa (Otimista)
  const handleRemoverDespesa = async (dataDia: string, despesaId: string) => {
    if (!viagemAtiva) return;

    const backupRoteiro = { ...roteiroDiario };
    const otimistaRoteiro = { ...roteiroDiario };
    if (otimistaRoteiro[dataDia] && otimistaRoteiro[dataDia].despesas) {
      otimistaRoteiro[dataDia] = {
        ...otimistaRoteiro[dataDia],
        despesas: otimistaRoteiro[dataDia].despesas.filter(d => d.id !== despesaId),
      };
    }
    setRoteiroDiario(otimistaRoteiro);
    emitLog(`OPTIMISTIC: Despesa ID ${despesaId} removida da interface no dia ${dataDia}.`);

    try {
      await removerDespesaDia(viagemAtiva.id, dataDia, despesaId);
      const confirmado = await obterRoteiroDiario(viagemAtiva.id);
      setRoteiroDiario(confirmado);
    } catch {
      setRoteiroDiario(backupRoteiro);
      emitLog("OPTIMISTIC ERROR: Falha ao remover despesa do banco. Ação revertida.");
    }
  };

  // Dispara o JOB transacional de atualização de preços sob demanda
  const handleAtualizarCotacoes = async () => {
    if (!viagemAtiva) return;
    setIsUpdatingPrices(true);
    try {
      await atualizarCotacoesOnDemand(viagemAtiva.id);
      const roteiro = await obterRoteiroDiario(viagemAtiva.id);
      setRoteiroDiario(roteiro);
    } catch (err) {
      console.error("Falha ao rodar JOB de preços:", err);
      emitLog("SYSTEM ERROR: Falha crítica na cotação automática.");
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  // ==========================================
  // LAYOUT 1: Central de Viagens (Home Grid)
  // ==========================================
  if (!viagemAtiva) {
    return (
      <div className="flex flex-col min-h-screen p-4 md:p-6 space-y-6 max-w-7xl mx-auto relative selection:bg-indigo-500/30">
        {/* Glowing radial blobs no BG */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10 select-none rounded-3xl">
          <div className="glass-blob animate-drift-1 bg-indigo-600/10 w-[500px] h-[500px] -top-40 -left-40" />
          <div className="glass-blob animate-drift-2 bg-emerald-500/5 w-[600px] h-[600px] top-[40%] -right-40" />
        </div>

        {/* Header Premium Central */}
        <header className="w-full glass-panel shadow-xl shadow-slate-950/20 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden rounded-2xl select-none">
          <div className="absolute top-0 left-0 w-full h-[3px] hazard-stripes" />
          <div className="flex items-center space-x-3.5">
            <div className="bg-indigo-600 text-white p-3 rounded-xl font-black text-sm tracking-widest shadow-lg shadow-indigo-500/30">
              CHL
            </div>
            <div>
              <h1 className="text-sm font-black tracking-widest text-slate-100 uppercase font-sans">
                CHILINHO GESTÃO DE VIAGENS
              </h1>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5 font-mono-tech">
                Painel de Gestão e Planejamento
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3.5 font-mono-tech text-[10px] bg-slate-950/50 px-4 py-2 border border-slate-800/80 rounded-xl h-10 shadow-inner">
            <div className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full led-green animate-pulse" />
              <span className="text-[#10b981] font-bold">CONECTADO</span>
            </div>
            <span className="text-slate-800">|</span>
            <span className="text-slate-450">DATA: 2026-05-30</span>
          </div>
        </header>

        {/* Introdução / Subtitle */}
        <div className="text-center py-6 select-none max-w-2xl mx-auto space-y-2.5">
          <h2 className="text-base font-black text-slate-100 tracking-wider uppercase font-sans">
            Selecione uma Viagem
          </h2>
          <p className="text-[10px] text-slate-450 uppercase tracking-widest font-bold font-mono-tech">
            Acesse o workspace de planejamento focado ou crie uma nova rota
          </p>
        </div>

        {/* Grid de Viagens */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full pb-12">
          {viagens.map((v, index) => {
            // Escolhe gradiente de destaque do card baseado no índice/nome
            const colors = [
              { border: "hover:border-indigo-500/60", badge: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20", glow: "glow-card-indigo" },
              { border: "hover:border-emerald-500/60", badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", glow: "glow-card-emerald" },
              { border: "hover:border-amber-500/60", badge: "text-amber-400 bg-amber-500/10 border-amber-500/20", glow: "glow-card-amber" }
            ];
            const theme = colors[index % colors.length];

            return (
              <div
                key={v.id}
                onClick={() => handleSelecionarViagem(v.id)}
                className={`glass-panel-light p-6 rounded-3xl border border-slate-800/80 cursor-pointer flex flex-col justify-between min-h-[220px] relative overflow-hidden group transition-all duration-300 hover:scale-[1.01] ${theme.border} ${theme.glow}`}
              >
                {/* Indicador Neon sutil de Atividade */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent blur-md rounded-bl-full pointer-events-none" />

                {/* Cabeçalho do Card */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[8.5px] font-bold font-mono-tech uppercase border px-2 py-0.5 rounded ${theme.badge}`}>
                      ROTA ATIVA
                    </span>
                    <button
                      onClick={(e) => handleDeletarViagem(e, v.id, v.destino)}
                      className="w-7 h-7 flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/25 border-0 text-rose-500 rounded-lg transition-colors cursor-pointer z-10 scale-90"
                      title="Excluir Rota definitivamente"
                    >
                      🗑️
                    </button>
                  </div>
                  <h3 className="text-base font-black text-slate-100 uppercase tracking-wide truncate pt-2">
                    {v.destino.replace(/ \(.*\)/, "")}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono-tech mt-0.5">
                    Saída: <span className="text-slate-400">{v.origem.replace(/ \(.*\)/, "")}</span>
                  </p>
                </div>

                {/* Datas e Orçamento */}
                <div className="pt-6 border-t border-slate-850 space-y-3.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500 font-bold uppercase">Período</span>
                    <span className="font-mono-tech text-slate-300 font-semibold">{v.data_inicio} a {v.data_fim}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500 font-bold uppercase">Orçamento Teto</span>
                    <span className="font-mono-tech text-[#f59e0b] font-bold">R$ {v.orcamento_maximo.toLocaleString("pt-BR")}</span>
                  </div>
                </div>

                {/* Overlay Hover Efeito */}
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-indigo-500/40 via-blue-500/40 to-emerald-500/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            );
          })}

          {/* Card Especial de Nova Rota */}
          <div
            onClick={() => setIsFormCriacaoAberto(true)}
            className="glass-panel-light p-6 rounded-3xl border border-dashed border-slate-800 hover:border-indigo-500/60 bg-slate-950/20 hover:bg-slate-950/40 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 min-h-[220px] group/new glow-card-indigo select-none hover:scale-[1.01]"
          >
            <span className="text-3xl text-slate-650 group-hover/new:text-indigo-400 group-hover/new:scale-110 transition-all duration-300">➕</span>
            <span className="text-[10px] font-black tracking-widest text-slate-450 group-hover/new:text-slate-200 mt-4 uppercase">
              Nova Viagem
            </span>
            <span className="text-[9px] font-mono-tech text-slate-650 mt-1 uppercase">
              Criar nova viagem no Firestore
            </span>
          </div>
        </div>

        {/* Modal de Criação (Overlay) */}
        {isFormCriacaoAberto && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[999] flex items-center justify-center p-4">
            <div className="relative w-full max-w-xl animate-workspace-fade-in">
              <TripForm
                onCriarViagem={handleCriarViagem}
                onClose={() => setIsFormCriacaoAberto(false)}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // LAYOUT 2: Workspace Focado com Sidebar
  // ==========================================
  
  // 1. Cálculos de orçamento consolidados (para a aba de dashboard/ KPIs da sidebar)
  let totalHospedagem = 0;
  let totalPasseios = 0;
  let totalDespesas = 0;

  datasViagem.forEach((dia) => {
    const diario = roteiroDiario[dia];
    if (diario) {
      totalHospedagem += diario.hospedagem?.preco_diario || 0;
      totalPasseios += diario.atividades?.reduce((acc, act) => acc + act.valor, 0) || 0;
      totalDespesas += diario.despesas?.reduce((acc, exp) => acc + exp.valor, 0) || 0;
    }
  });

  const custoTotal = totalHospedagem + totalPasseios + totalDespesas;
  const orcamento = viagemAtiva.orcamento_maximo || 0;
  const saldo = orcamento - custoTotal;
  const ultrapassou = orcamento > 0 && custoTotal > orcamento;
  const percentualConsumido = orcamento > 0 ? Math.min(100, Math.round((custoTotal / orcamento) * 100)) : 0;

  const percentualHospedagem = custoTotal > 0 ? Math.round((totalHospedagem / custoTotal) * 100) : 0;
  const percentualPasseios = custoTotal > 0 ? Math.round((totalPasseios / custoTotal) * 100) : 0;
  const percentualDespesas = custoTotal > 0 ? Math.round((totalDespesas / custoTotal) * 100) : 0;



  // Montagem do gráfico diário acumulativo
  const dadosGrafico: { diaLabel: string; diaData: string; custoDia: number; acumulado: number }[] = [];
  let somaAcumulada = 0;
  datasViagem.forEach((dia, idx) => {
    const diario = roteiroDiario[dia];
    let custoDia = 0;
    if (diario) {
      custoDia += diario.hospedagem?.preco_diario || 0;
      custoDia += diario.atividades?.reduce((acc, act) => acc + act.valor, 0) || 0;
      custoDia += diario.despesas?.reduce((acc, exp) => acc + exp.valor, 0) || 0;
    }
    somaAcumulada += custoDia;
    dadosGrafico.push({
      diaLabel: `DIA ${String(idx + 1).padStart(2, "0")}`,
      diaData: dia,
      custoDia,
      acumulado: somaAcumulada
    });
  });

  // Extrato Consolidado
  const statementItems: {
    key: string;
    diaIdx: number;
    diaData: string;
    tipo: "hospedagem" | "passeio" | "despesa";
    nome: string;
    valor: number;
    detalhe?: string;
    onDelete: () => Promise<void>;
  }[] = [];

  datasViagem.forEach((dia, idx) => {
    const diario = roteiroDiario[dia];
    if (diario) {
      if (diario.hospedagem) {
        const hotel = diario.hospedagem;
        statementItems.push({
          key: `h-${dia}`,
          diaIdx: idx,
          diaData: dia,
          tipo: "hospedagem",
          nome: hotel.nome,
          valor: hotel.preco_diario,
          detalhe: "Diária de Hotel",
          onDelete: () => handleRemoverHospedagem(dia)
        });
      }
      if (diario.atividades) {
        diario.atividades.forEach((atv, atvIdx) => {
          statementItems.push({
            key: `a-${dia}-${atvIdx}`,
            diaIdx: idx,
            diaData: dia,
            tipo: "passeio",
            nome: atv.nome,
            valor: atv.valor,
            detalhe: "Atividade/Passeio",
            onDelete: () => handleRemoverAtividade(dia, atvIdx)
          });
        });
      }
      if (diario.despesas) {
        diario.despesas.forEach((exp) => {
          statementItems.push({
            key: `e-${dia}-${exp.id}`,
            diaIdx: idx,
            diaData: dia,
            tipo: "despesa",
            nome: exp.nome,
            valor: exp.valor,
            detalhe: `Despesa (${exp.categoria})`,
            onDelete: () => handleRemoverDespesa(dia, exp.id || "")
          });
        });
      }
    }
  });

  const financialGlowClass = ultrapassou
    ? "border-rose-500/50 shadow-lg shadow-rose-500/10"
    : percentualConsumido > 80
      ? "border-amber-500/50 shadow-lg shadow-amber-500/10"
      : "border-indigo-500/35 shadow-lg shadow-indigo-500/5";

  return (
    <div className="flex flex-col min-h-screen p-4 md:p-6 space-y-4 max-w-7xl mx-auto relative selection:bg-indigo-500/30">
      {/* Mesh Glowing Blobs no background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10 select-none rounded-3xl">
        <div className="glass-blob animate-drift-1 bg-indigo-600/10 w-[500px] h-[500px] -top-40 -left-40" />
        <div className="glass-blob animate-drift-2 bg-emerald-500/5 w-[600px] h-[600px] top-[40%] -right-40" />
      </div>

      {/* Grid Principal Dividida: Sidebar e Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch flex-1">
        
        {/* COLUNA 1: SIDEBAR LATERAL DE CONTROLE */}
        <aside className="lg:col-span-3 flex flex-col justify-between glass-panel p-5 rounded-2xl relative overflow-hidden h-fit lg:h-[calc(100vh-3rem)] sticky lg:top-6 select-none">
          <div className="absolute top-0 left-0 w-full h-[3px] hazard-stripes" />
          
          <div className="space-y-5">
            {/* Botão de Retorno Central */}
            <button
              onClick={() => setViagemAtiva(null)}
              className="w-full h-10 px-4 flex items-center justify-center font-bold tracking-widest uppercase transition-all bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-450 hover:text-slate-200 cursor-pointer rounded-xl text-[9px] hover:scale-[1.01] active:scale-[0.99]"
            >
              Voltar para a Central
            </button>

            {/* Info Rota Compact Box */}
            <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl text-center space-y-2">
              <span className="text-[8px] font-bold font-mono-tech text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded uppercase">
                Workspace Ativo
              </span>
              <h2 className="text-xs font-black text-slate-100 uppercase tracking-wide truncate pt-1">
                {viagemAtiva.destino.replace(/ \(.*\)/, "")}
              </h2>
              <p className="text-[9.5px] font-mono-tech text-slate-400 font-semibold">
                {viagemAtiva.data_inicio} até {viagemAtiva.data_fim}
              </p>
              <div className="text-[8.5px] font-mono-tech text-slate-600 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-900 truncate">
                REG: {viagemAtiva.id}
              </div>
            </div>

            {/* Navegador de Abas */}
            <nav className="flex flex-col space-y-2.5">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`h-11 px-4.5 flex items-center justify-between font-bold text-[10px] uppercase transition-all border rounded-xl cursor-pointer ${
                  activeTab === "dashboard"
                    ? "bg-indigo-600/15 border-indigo-500/40 text-indigo-400 shadow-md shadow-indigo-500/5 font-black"
                    : "bg-slate-950/40 border-slate-850 hover:border-slate-800 text-slate-450 hover:text-slate-200 hover:bg-slate-950/60"
                }`}
              >
                <span>📊 Visão Geral & Finanças</span>
                <span className={`w-1.5 h-1.5 rounded-full ${activeTab === "dashboard" ? "bg-indigo-500 led-blue animate-pulse" : "bg-slate-800"}`} />
              </button>

              <button
                onClick={() => setActiveTab("cronograma")}
                className={`h-11 px-4.5 flex items-center justify-between font-bold text-[10px] uppercase transition-all border rounded-xl cursor-pointer ${
                  activeTab === "cronograma"
                    ? "bg-indigo-600/15 border-indigo-500/40 text-indigo-400 shadow-md shadow-indigo-500/5 font-black"
                    : "bg-slate-950/40 border-slate-850 hover:border-slate-800 text-slate-450 hover:text-slate-200 hover:bg-slate-950/60"
                }`}
              >
                <span>📅 Cronograma Diário</span>
                <span className={`w-1.5 h-1.5 rounded-full ${activeTab === "cronograma" ? "bg-indigo-500 led-blue animate-pulse" : "bg-slate-800"}`} />
              </button>

              <button
                onClick={() => setActiveTab("banco")}
                className={`h-11 px-4.5 flex items-center justify-between font-bold text-[10px] uppercase transition-all border rounded-xl cursor-pointer ${
                  activeTab === "banco"
                    ? "bg-indigo-600/15 border-indigo-500/40 text-indigo-400 shadow-md shadow-indigo-500/5 font-black"
                    : "bg-slate-950/40 border-slate-850 hover:border-slate-800 text-slate-450 hover:text-slate-200 hover:bg-slate-950/60"
                }`}
              >
                <span>🛍️ Banco de Alocações</span>
                <span className={`w-1.5 h-1.5 rounded-full ${activeTab === "banco" ? "bg-indigo-500 led-blue animate-pulse" : "bg-slate-800"}`} />
              </button>

              <button
                onClick={() => setActiveTab("logs")}
                className={`h-11 px-4.5 flex items-center justify-between font-bold text-[10px] uppercase transition-all border rounded-xl cursor-pointer ${
                  activeTab === "logs"
                    ? "bg-indigo-600/15 border-indigo-500/40 text-indigo-400 shadow-md shadow-indigo-500/5 font-black"
                    : "bg-slate-950/40 border-slate-850 hover:border-slate-800 text-slate-450 hover:text-slate-200 hover:bg-slate-950/60"
                }`}
              >
                <span>📋 Logs do Terminal</span>
                <span className={`w-1.5 h-1.5 rounded-full ${activeTab === "logs" ? "bg-indigo-500 led-blue animate-pulse" : "bg-slate-800"}`} />
              </button>
            </nav>
          </div>

          {/* Rodapé da Sidebar - Configurações */}
          <div className="pt-4 border-t border-slate-850 space-y-3.5 select-none mt-6">
            {/* Botão Re-Cotar */}
            <button
              onClick={handleAtualizarCotacoes}
              disabled={isUpdatingPrices}
              className="w-full py-2.5 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/35 hover:border-indigo-400 text-indigo-400 hover:text-indigo-300 text-[9.5px] font-bold uppercase transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:hover:bg-transparent rounded-lg font-mono-tech shadow-md"
            >
              {isUpdatingPrices ? (
                <>
                  <span className="w-1.5 h-1.5 bg-indigo-500 led-blue rounded-full animate-ping" />
                  Atualizando...
                </>
              ) : (
                <>
                  <span>🔄</span>
                  <span>Re-cotar Valores</span>
                </>
              )}
            </button>

            {/* Ações Auxiliares */}
            <div className="flex gap-2">
              <button
                onClick={() => setIsFormEdicaoAberto(true)}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-750 text-slate-400 hover:text-slate-200 transition-colors uppercase font-bold text-[9px] rounded-lg cursor-pointer shadow-sm active:scale-95"
              >
                Editar
              </button>
              <button
                onClick={(e) => handleDeletarViagem(e, viagemAtiva.id, viagemAtiva.destino)}
                className="py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-500 transition-colors rounded-lg cursor-pointer"
                title="Excluir Viagem definitivamente"
              >
                🗑️
              </button>
            </div>

            {/* Time/Status indicator */}
            <div className="flex items-center justify-between font-mono-tech text-[8px] text-slate-600 px-1 pt-1">
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 bg-[#10b981] rounded-full led-green animate-pulse" />
                ONLINE
              </span>
              <span>SYS: 2026-05-30</span>
            </div>
          </div>
        </aside>

        {/* COLUNA 2: WORKSPACE DE CONTEÚDO ATIVO */}
        <main className="lg:col-span-9 flex flex-col space-y-4 min-h-0 workspace-fade-in">
          
          {/* =======================================
              ABA 1: Visão Geral & Finanças (Dashboard)
              ======================================= */}
          {activeTab === "dashboard" && (
            <div className="space-y-5 flex-1 flex flex-col min-h-0">
              {/* KPIs de Orçamento */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full select-none">
                {/* KPI Orçamento Máximo */}
                <div className="glass-panel p-4.5 rounded-2xl relative overflow-hidden transition-all duration-300">
                  <div className="absolute top-0 left-0 w-[4px] h-full bg-slate-700" />
                  <div className="text-[9px] font-mono-tech text-slate-500 uppercase tracking-widest">Teto Orçamentário</div>
                  <div className="text-sm font-black text-slate-100 mt-1 font-mono-tech">
                    R$ {orcamento.toLocaleString("pt-BR")}
                  </div>
                  <div className="text-[8.5px] text-slate-500 font-semibold mt-1.5 uppercase font-mono-tech leading-none">
                    definido pelo planejamento
                  </div>
                </div>

                {/* KPI Consumido */}
                <div className={`glass-panel p-4.5 rounded-2xl relative overflow-hidden transition-all duration-300 border ${financialGlowClass}`}>
                  <div className={`absolute top-0 left-0 w-[4px] h-full ${ultrapassou ? "bg-rose-500" : percentualConsumido > 80 ? "bg-amber-500" : "bg-emerald-500"}`} />
                  <div className="text-[9px] font-mono-tech text-slate-500 uppercase tracking-widest">Consumo Consolidado</div>
                  <div className={`text-sm font-black mt-1 font-mono-tech ${ultrapassou ? "text-rose-400" : "text-[#10b981]"}`}>
                    R$ {custoTotal.toLocaleString("pt-BR")}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 select-none leading-none">
                    <span className={`text-[8.5px] font-bold uppercase tracking-wider ${ultrapassou ? "text-rose-400 animate-pulse" : "text-[#10b981]"}`}>
                      {percentualConsumido}% CONSUMIDO
                    </span>
                    {ultrapassou && (
                      <span className="text-[7.5px] bg-rose-500/20 text-rose-500 font-bold px-1 py-0.2 rounded uppercase led-red font-sans">
                        OVER_BUDGET
                      </span>
                    )}
                  </div>
                </div>

                {/* KPI Saldo Restante */}
                <div className="glass-panel p-4.5 rounded-2xl relative overflow-hidden transition-all duration-300">
                  <div className={`absolute top-0 left-0 w-[4px] h-full ${saldo < 0 ? "bg-rose-500" : "bg-emerald-500"}`} />
                  <div className="text-[9px] font-mono-tech text-slate-500 uppercase tracking-widest">Saldo Financeiro</div>
                  <div className={`text-sm font-black mt-1 font-mono-tech ${saldo < 0 ? "text-rose-400" : "text-emerald-450"}`}>
                    R$ {saldo.toLocaleString("pt-BR")}
                  </div>
                  <div className="text-[8.5px] text-slate-500 font-semibold mt-1.5 uppercase font-mono-tech leading-none">
                    {saldo < 0 ? "saldo devedor da rota" : "saldo livre disponível"}
                  </div>
                </div>
              </div>

              {/* Linha do Tempo de Custos Diários */}
              <TimelineCompact
                datasViagem={datasViagem}
                roteiroDiario={roteiroDiario}
                orcamentoMaximo={viagemAtiva.orcamento_maximo}
                onSelecionarDia={(dia) => {
                  setDiaAtivoWorkspace(dia);
                  setActiveTab("cronograma"); // Redireciona para focar no cronograma
                }}
                diaAtivoWorkspace={diaAtivoWorkspace}
              />

              {/* Grid Central Dashboard: Gráficos e Extrato */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0 items-stretch">
                
                {/* Lado Esquerdo: Gráficos de Divisão e Progressão (col-span-7) */}
                <div className="lg:col-span-7 space-y-5 flex flex-col justify-between">
                  {/* Category Division breakdown */}
                  <div className="glass-panel p-5 rounded-2xl space-y-4">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center justify-between select-none">
                      <span>🏷️ Distribuição por Categoria</span>
                      <span className="text-[8px] text-slate-500 lowercase italic">divisão percentual</span>
                    </h3>

                    {/* Single Combined Segmented Bar */}
                    <div className="w-full h-3.5 bg-slate-950 rounded-full overflow-hidden flex border border-slate-850 shadow-inner">
                      {totalHospedagem > 0 && (
                        <div
                          style={{ width: `${percentualHospedagem}%` }}
                          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all"
                          title={`Hospedagem: ${percentualHospedagem}%`}
                        />
                      )}
                      {totalPasseios > 0 && (
                        <div
                          style={{ width: `${percentualPasseios}%` }}
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 border-l border-slate-950 transition-all"
                          title={`Passeios: ${percentualPasseios}%`}
                        />
                      )}
                      {totalDespesas > 0 && (
                        <div
                          style={{ width: `${percentualDespesas}%` }}
                          className="h-full bg-gradient-to-r from-amber-500 to-rose-500 border-l border-slate-950 transition-all"
                          title={`Despesas: ${percentualDespesas}%`}
                        />
                      )}
                      {custoTotal === 0 && (
                        <div className="w-full h-full bg-slate-900 flex items-center justify-center text-[8px] text-slate-650 font-bold uppercase tracking-wider">
                          Nenhum gasto registrado
                        </div>
                      )}
                    </div>

                    {/* Grid labels */}
                    <div className="grid grid-cols-3 gap-3 text-[9.5px]">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-indigo-450 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          <span>Hospedagem: {percentualHospedagem}%</span>
                        </div>
                        <span className="text-slate-500 font-mono-tech pl-3.5">R$ {totalHospedagem.toLocaleString("pt-BR")}</span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-emerald-455 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Passeios: {percentualPasseios}%</span>
                        </div>
                        <span className="text-slate-500 font-mono-tech pl-3.5">R$ {totalPasseios.toLocaleString("pt-BR")}</span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-amber-450 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>Despesas: {percentualDespesas}%</span>
                        </div>
                        <span className="text-slate-500 font-mono-tech pl-3.5">R$ {totalDespesas.toLocaleString("pt-BR")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Progression Graph */}
                  <div className="glass-panel p-5 rounded-2xl space-y-4 flex-1 flex flex-col justify-between relative min-h-[220px]">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider select-none flex items-center justify-between">
                      <span>📈 Progressão de Gastos</span>
                      <span className="text-[8px] text-slate-500 lowercase italic">passe o mouse nas barras</span>
                    </h3>

                    {/* Graph Container */}
                    <div className="flex items-end gap-1.5 md:gap-2.5 h-40 pt-6 border-b border-l border-slate-800/80 px-2 relative select-none flex-1 mt-4">
                      {/* Budget Limit Line */}
                      {orcamento > 0 && (
                        <div className="absolute left-0 right-0 border-t border-dashed border-rose-500/30 text-[7.5px] font-black text-rose-500/60 uppercase tracking-widest pl-2 pt-0.5 pointer-events-none z-10" style={{ bottom: "80%" }}>
                          Limite do Orçamento
                        </div>
                      )}

                      {dadosGrafico.map((d) => {
                        const heightPercent = orcamento > 0 ? Math.min(100, Math.round((d.acumulado / orcamento) * 80)) : 0;
                        const isOver = orcamento > 0 && d.acumulado > orcamento;

                        return (
                          <div key={d.diaData} className="flex-1 flex flex-col items-center group/bar relative">
                            {/* Hover tooltip */}
                            <div className="absolute bottom-full mb-2 bg-slate-950 border border-indigo-500/50 text-[8.5px] p-2 rounded shadow-2xl hidden group-hover/bar:flex flex-col text-center w-24 pointer-events-none z-50 transition-all font-sans font-semibold">
                              <span className="text-amber-500 uppercase tracking-wider">{d.diaLabel}</span>
                              <span className="text-slate-400 font-mono-tech mt-0.5 text-[8px]">{d.diaData.slice(5)}</span>
                              <span className="text-indigo-400 font-mono-tech mt-1">Dia: R$ {d.custoDia}</span>
                              <span className="text-[#10b981] font-mono-tech">Cum: R$ {d.acumulado}</span>
                            </div>

                            {/* Bar Graph */}
                            <div className="w-full bg-slate-950/50 rounded-t h-28 flex flex-col justify-end relative shadow-inner overflow-hidden border border-slate-900">
                              <div
                                style={{ height: `${heightPercent}%` }}
                                className={`w-full rounded-t transition-all duration-300 ${isOver
                                    ? "bg-gradient-to-t from-rose-600 to-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.3)]"
                                    : d.acumulado > orcamento * 0.8
                                      ? "bg-gradient-to-t from-amber-600 to-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.3)]"
                                      : "bg-gradient-to-t from-indigo-600 to-indigo-400 shadow-[0_0_6px_rgba(99,102,241,0.3)]"
                                  }`}
                              />
                            </div>

                            {/* Label */}
                            <span className="text-[8.5px] font-mono-tech font-bold text-slate-500 mt-1.5 uppercase select-none">{d.diaLabel.replace("DIA ", "D")}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Lado Direito: Extrato Consolidado (col-span-5) */}
                <div className="lg:col-span-5 flex flex-col h-full glass-panel p-5 rounded-2xl relative space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center justify-between select-none">
                    <span>🧾 Extrato Consolidado</span>
                    <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono-tech px-2 py-0.5 rounded text-[8px] leading-none uppercase">
                      {statementItems.length} itens
                    </span>
                  </h3>

                  {/* Scrollable list of statement items */}
                  <div className="flex-1 overflow-y-auto max-h-[350px] pr-1.5 space-y-2.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                    {statementItems.length === 0 ? (
                      <div className="py-24 text-center text-slate-600 font-bold uppercase tracking-wider text-[9px] select-none">
                        Nenhum lançamento registrado
                      </div>
                    ) : (
                      statementItems.map((item) => {
                        let colorBadge = "bg-slate-900 border-slate-800 text-slate-450";
                        if (item.tipo === "hospedagem") {
                          colorBadge = "bg-indigo-500/10 border-indigo-500/20 text-indigo-400";
                        } else if (item.tipo === "passeio") {
                          colorBadge = "bg-emerald-500/10 border-emerald-500/20 text-emerald-450";
                        } else if (item.tipo === "despesa") {
                          colorBadge = "bg-amber-500/10 border-amber-500/20 text-amber-450";
                        }

                        return (
                          <div
                            key={item.key}
                            className="bg-slate-900/70 border border-slate-850 p-2.5 flex items-center justify-between gap-3 group rounded-xl hover:border-slate-750 transition-colors shadow-sm"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-[#f59e0b] font-mono-tech text-[8.5px] uppercase">
                                  D{String(item.diaIdx + 1).padStart(2, "0")}
                                </span>
                                <span className="text-slate-500 text-[9px]">|</span>
                                <span className={`text-[8px] font-black px-1.5 py-0.2 uppercase border leading-none rounded ${colorBadge}`}>
                                  {item.tipo}
                                </span>
                                <span className="text-[8px] text-slate-400 uppercase truncate max-w-[120px]" title={item.detalhe}>
                                  {item.detalhe}
                                </span>
                              </div>

                              <div className="font-bold text-slate-200 truncate uppercase text-[10px] mt-1 tracking-wide">
                                {item.nome}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 select-none">
                              <span className="text-[#10b981] font-mono-tech font-bold text-[10px]">
                                R$ {item.valor.toLocaleString("pt-BR")}
                              </span>
                              <button
                                onClick={async () => {
                                  if (confirm(`Deseja excluir o lançamento "${item.nome}" definitivamente?`)) {
                                    await item.onDelete();
                                  }
                                }}
                                className="w-5 h-5 flex items-center justify-center border-0 bg-rose-500/10 hover:bg-rose-500/25 text-rose-500 rounded-lg transition-all text-[11px] cursor-pointer"
                                title="Excluir Lançamento"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Dashboard Totalizer Footer */}
                  <div className="bg-slate-950/50 border border-slate-850 p-3.5 rounded-xl flex justify-between items-center text-[9.5px] font-mono-tech select-none">
                    <span className="text-slate-450 uppercase font-sans font-bold">Total Consolidado:</span>
                    <span className="text-[#10b981] font-black text-xs">R$ {custoTotal.toLocaleString("pt-BR")}</span>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* =======================================
              ABA 2: Cronograma Diário (Workspace Foco)
              ======================================= */}
          {activeTab === "cronograma" && diaAtivoWorkspace && (
            <div className="space-y-4 flex-1 flex flex-col min-h-0">
              
              {/* Seletor de Dia Operacional (TimelineCompact) */}
              <TimelineCompact
                datasViagem={datasViagem}
                roteiroDiario={roteiroDiario}
                orcamentoMaximo={viagemAtiva.orcamento_maximo}
                onSelecionarDia={(dia) => setDiaAtivoWorkspace(dia)}
                diaAtivoWorkspace={diaAtivoWorkspace}
              />

              {/* Workspace Header & Modo Toggle */}
              <div className="w-full flex items-center justify-between border-b border-slate-850 pb-2.5 mt-1 select-none">
                <div className="flex items-center space-x-3">
                  <span className="text-[#f59e0b] font-black text-[10px] uppercase tracking-wider font-sans flex items-center gap-2">
                    <span>⚡ Workspace Diário de Foco:</span>
                    <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono-tech px-2.5 py-0.5 rounded-lg text-[9.5px]">
                      Dia {datasViagem.indexOf(diaAtivoWorkspace) + 1} ➔ {new Date(diaAtivoWorkspace + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ({diaAtivoWorkspace})
                    </span>
                  </span>
                </div>
                <button
                  onClick={() => setIsModoFoco(!isModoFoco)}
                  className={`px-4 py-1.5 font-mono-tech text-[9px] font-bold rounded-lg border transition-all duration-200 uppercase cursor-pointer ${
                    isModoFoco
                      ? "bg-indigo-600/10 border-indigo-500/40 text-indigo-400 hover:bg-indigo-600/25"
                      : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-350"
                  }`}
                >
                  {isModoFoco ? "Foco Diário" : "Visão Completa"}
                </button>
              </div>

              {/* Main Workspace Itinerary Lado B */}
              <div className="flex-1 flex flex-col h-full">
                <SideBItinerary
                  datasViagem={datasViagem}
                  roteiroDiario={roteiroDiario}
                  onRemoverHospedagem={handleRemoverHospedagem}
                  onRemoverAtividade={handleRemoverAtividade}
                  onAdicionarDespesa={handleInjetarDespesa}
                  onRemoverDespesa={handleRemoverDespesa}
                  destino={viagemAtiva.destino}
                  viagemAtiva={viagemAtiva}
                  diaAtivoWorkspace={diaAtivoWorkspace}
                  isModoFoco={isModoFoco}
                  onSalvarCronogramaInline={handleSalvarCronogramaInline}
                />
              </div>
            </div>
          )}

          {/* =======================================
              ABA 3: Banco de Alocações (Search List)
              ======================================= */}
          {activeTab === "banco" && diaAtivoWorkspace && (
            <div className="space-y-4 flex-1 flex flex-col min-h-0">
              
              {/* Seletor de Dia Operacional (TimelineCompact) */}
              <TimelineCompact
                datasViagem={datasViagem}
                roteiroDiario={roteiroDiario}
                orcamentoMaximo={viagemAtiva.orcamento_maximo}
                onSelecionarDia={(dia) => setDiaAtivoWorkspace(dia)}
                diaAtivoWorkspace={diaAtivoWorkspace}
              />

              {/* Instrução Contextual */}
              <div className="bg-slate-950/30 border border-slate-850 p-4 rounded-xl flex items-center justify-between select-none">
                <div className="space-y-1">
                  <h4 className="text-[10px] font-black text-slate-200 uppercase tracking-widest leading-none">🛍️ Banco Central de Alocações</h4>
                  <p className="text-[9px] text-slate-450 font-bold uppercase tracking-wider font-mono-tech mt-0.5">
                    pesquise ou crie itens customizados para injetar no dia operacional selecionado
                  </p>
                </div>
                <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono-tech px-2.5 py-0.5 rounded-lg text-[9.5px]">
                  Dia em Alocação: {datasViagem.indexOf(diaAtivoWorkspace) + 1} ({diaAtivoWorkspace})
                </span>
              </div>

              {/* Componente SideAList no Lado A */}
              <div className="flex-1 flex flex-col h-full">
                <SideAList
                  datasViagem={datasViagem}
                  onInjetarHospedagem={handleInjetarHospedagem}
                  onInjetarAtividade={handleInjetarAtividade}
                  onInjetarDespesa={handleInjetarDespesa}
                  viagemDestino={viagemAtiva.destino}
                />
              </div>
            </div>
          )}

          {/* =======================================
              ABA 4: Logs do Terminal (Console Log)
              ======================================= */}
          {activeTab === "logs" && (
            <div className="flex-1 flex flex-col min-h-0 h-full">
              <div className="bg-slate-950/30 border border-slate-850 p-4 rounded-t-xl select-none">
                <h4 className="text-[10px] font-black text-slate-200 uppercase tracking-widest leading-none">📋 Histórico e Logs</h4>
                <p className="text-[9px] text-slate-450 font-bold uppercase tracking-wider font-mono-tech mt-1">
                  rastreamento em tempo real das chamadas transacionais de rede na nuvem
                </p>
              </div>
              <div className="flex-1 flex flex-col min-h-[300px]">
                <IndustrialLog />
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Modal de Edição (Overlay) */}
      {isFormEdicaoAberto && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[999] flex items-center justify-center p-4">
          <div className="relative w-full max-w-xl animate-workspace-fade-in">
            <TripForm
              onCriarViagem={handleCriarViagem}
              onClose={() => setIsFormEdicaoAberto(false)}
              viagemParaEditar={viagemAtiva}
              onEditarViagem={handleEditarViagem}
            />
          </div>
        </div>
      )}
    </div>
  );
}