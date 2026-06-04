"use client";

import React, { useEffect, useState } from "react";
import {
  atualizarCotacoesOnDemand,
  Despesa,
  emitLog,
  subscribeToLogs,
} from "@/services/travelService";

import TripForm from "@/components/TripForm";
import SideAList from "@/components/SideAList";
import SideBItinerary from "@/components/SideBItinerary";
import IndustrialLog from "@/components/IndustrialLog";
import TimelineCompact from "@/components/TimelineCompact";
import TravelersManager from "@/components/TravelersManager";
import BillSplitter from "@/components/BillSplitter";
import PackingChecklist from "@/components/PackingChecklist";
import CurrencyWidget from "@/components/CurrencyWidget";

// Hook de dados unificado
import { useTravelData } from "@/app/hooks/useTravelData";

// Firebase Imports
import { db, isFirebaseConfigured, auth } from "@/lib/firebase";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from "firebase/auth";
import { doc, updateDoc, deleteDoc, setDoc, getDocs, collection } from "firebase/firestore";

export default function Home() {
  // Estados de Autenticação
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const {
    viagens,
    viagemAtiva,
    datasViagem,
    roteiroDiario,
    diaAtivoWorkspace,
    setDiaAtivoWorkspace,
    setViagemAtiva,
    carregarDadosViagens,
    selecionarViagem,
    criarNovaViagem,
    editarViagemAtiva,
    deletarViagemAtiva,
    injetarHospedagem,
    injetarAtividade,
    removerHospedagem,
    removerAtividade,
    injetarDespesa,
    removerDespesa,
    salvarCronogramaInline,
    atualizarViajantes
  } = useTravelData(user);

  const [isFormCriacaoAberto, setIsFormCriacaoAberto] = useState(false);
  const [isFormEdicaoAberto, setIsFormEdicaoAberto] = useState(false);
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);

  // Estados para o Workspace Focado (Redesenho UX Premium)
  const [isModoFoco, setIsModoFoco] = useState(true);

  // Controle de Abas no Sidebar
  const [activeTab, setActiveTab] = useState<"visao-geral" | "financas" | "cronograma" | "banco" | "checklist" | "logs">("visao-geral");

  // Estados para inclusão de despesa rápida na aba Finanças
  const [finAddNome, setFinAddNome] = useState("");
  const [finAddValor, setFinAddValor] = useState("");
  const [finAddCategoria, setFinAddCategoria] = useState("Alimentação");
  const [finAddCustomCategoria, setFinAddCustomCategoria] = useState("");
  const [finAddIsCustom, setFinAddIsCustom] = useState(false);
  const [finAddVinculo, setFinAddVinculo] = useState("global");
  const [finAddErro, setFinAddErro] = useState("");
  const [finAddSalvando, setFinAddSalvando] = useState(false);

  // Estados para mini logs preview na aba Visão Geral
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);

  useEffect(() => {
    setConsoleLogs([
      `[SYSTEM] BOOT INITIALIZED...`,
      `[SYSTEM] CONSOLE PREVIEW READY.`
    ]);

    const unsubscribe = subscribeToLogs((newLog) => {
      setConsoleLogs((prev) => [...prev, newLog].slice(-3)); // Manteem as últimas 3 mensagens
    });
    return () => unsubscribe();
  }, []);

  // Estados para edição e filtros de Extrato Consolidado
  const [editingItemKey, setEditingItemKey] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editValor, setEditValor] = useState("");
  const [editCategoria, setEditCategoria] = useState("Alimentação");
  const [editCustomCategoria, setEditCustomCategoria] = useState("");
  const [editIsCustom, setEditIsCustom] = useState(false);
  const [editVinculo, setEditVinculo] = useState("global");
  const [editSalvando, setEditSalvando] = useState(false);
  const [editErro, setEditErro] = useState("");

  const [filtroVinculo, setFiltroVinculo] = useState<"todos" | "global" | "dias">("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");

  // Estado para clique no gráfico de progressão
  const [selectedGraphDay, setSelectedGraphDay] = useState<string | null>(null);

  // Estado para modal de detalhes dos KPIs (acessibilidade e resumo)
  const [activeKpiModal, setActiveKpiModal] = useState<"teto" | "consumo" | "saldo" | null>(null);

  // Escuta alterações de Autenticação em tempo real
  useEffect(() => {
    if (!auth) {
      setIsAuthLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
      if (currentUser) {
        emitLog(`AUTH: Usuário [${currentUser.displayName || currentUser.email}] autenticado com sucesso.`);
      } else {
        emitLog("AUTH: Modo visitante ativo (desconectado).");
      }
    });
    return () => unsubscribe();
  }, []);

  // Handlers de Login/Logout
  const handleLoginGoogle = async () => {
    if (!auth) return;
    const provider = new GoogleAuthProvider();
    try {
      emitLog("AUTH: Iniciando janela de login do Google...");
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
      emitLog("AUTH ERROR: Falha na autenticação do Google.");
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      emitLog("AUTH: Desconectando usuário do sistema...");
      await signOut(auth);
      setViagemAtiva(null);
    } catch (err) {
      console.error(err);
      emitLog("AUTH ERROR: Falha ao efetuar logout.");
    }
  };

  // Mapeamentos e adaptadores para o hook customizado
  const handleSelecionarViagem = async (id: string) => {
    await selecionarViagem(id);
    setActiveTab("visao-geral");
  };

  interface NovaViagemInput {
    origem: string;
    destino: string;
    data_inicio: string;
    data_fim: string;
    orcamento: number;
  }

  const handleCriarViagem = async (novaViagemData: NovaViagemInput) => {
    await criarNovaViagem(novaViagemData);
    setIsFormCriacaoAberto(false);
  };

  const handleEditarViagem = async (id: string, novaViagemData: NovaViagemInput) => {
    await editarViagemAtiva(id, novaViagemData);
    setIsFormEdicaoAberto(false);
  };

  const handleDeletarViagem = async (e: React.MouseEvent, id: string, destino: string) => {
    e.stopPropagation();
    if (confirm(`⚠️ Tem certeza que deseja excluir a viagem para ${destino}?\nEsta ação é permanente e apagará todos os dados associados no banco de dados.`)) {
      try {
        await deletarViagemAtiva(id);
      } catch (err) {
        console.error("Erro ao deletar viagem:", err);
        emitLog("SYSTEM ERROR: Falha ao excluir viagem.");
      }
    }
  };

  const handleInjetarHospedagem = injetarHospedagem;
  const handleInjetarAtividade = injetarAtividade;
  const handleRemoverHospedagem = removerHospedagem;
  const handleRemoverAtividade = removerAtividade;
  const handleInjetarDespesa = injetarDespesa;
  const handleRemoverDespesa = removerDespesa;
  const handleSalvarCronogramaInline = salvarCronogramaInline;
  const handleAtualizarViajantes = atualizarViajantes;

  // Handler para submeter despesa rápida em Finanças
  const handleSubmeterFinDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    setFinAddErro("");
    if (!finAddNome.trim() || !finAddValor.trim()) {
      setFinAddErro("Preencha todos os campos.");
      return;
    }
    const val = Number(finAddValor);
    if (isNaN(val) || val <= 0) {
      setFinAddErro("Valor inválido.");
      return;
    }

    const finalCategory = finAddIsCustom && finAddCustomCategoria.trim()
      ? finAddCustomCategoria.trim()
      : finAddCategoria;

    if (finAddIsCustom && !finAddCustomCategoria.trim()) {
      setFinAddErro("Insira o nome da categoria.");
      return;
    }

    setFinAddSalvando(true);
    try {
      await handleInjetarDespesa(finAddVinculo, {
        nome: finAddNome.trim(),
        valor: val,
        categoria: finalCategory
      });
      setFinAddNome("");
      setFinAddValor("");
      setFinAddCustomCategoria("");
      setFinAddIsCustom(false);
      setFinAddCategoria("Alimentação");
      setFinAddVinculo("global");
    } catch {
      setFinAddErro("Falha ao salvar a despesa.");
    } finally {
      setFinAddSalvando(false);
    }
  };

  // Handler para salvar edição de item no Extrato Consolidado
  const handleSalvarEdicaoItem = async (item: {
    key: string;
    diaIdx: number;
    diaData: string;
    tipo: "hospedagem" | "passeio" | "despesa";
    nome: string;
    valor: number;
    detalhe?: string;
    categoria: string;
    onDelete: () => Promise<void>;
  }) => {
    setEditErro("");
    if (!editNome.trim() || !editValor.trim()) {
      setEditErro("Preencha todos os campos.");
      return;
    }
    const val = Number(editValor);
    if (isNaN(val) || val <= 0) {
      setEditErro("Valor inválido.");
      return;
    }

    const finalCategory = editIsCustom && editCustomCategoria.trim()
      ? editCustomCategoria.trim()
      : editCategoria;

    if (editIsCustom && !editCustomCategoria.trim()) {
      setEditErro("Insira o nome da categoria.");
      return;
    }

    setEditSalvando(true);
    try {
      if (item.tipo === "despesa") {
        const docId = item.key.replace("e-global-", "").replace(`e-${item.diaData}-`, "");
        if (isFirebaseConfigured && db && viagemAtiva) {
          const docRef = doc(db, "viagens", viagemAtiva.id, "despesas", docId);
          await updateDoc(docRef, {
            nome: editNome.trim(),
            valor: val,
            categoria: finalCategory,
            diaId: editVinculo
          });
        }
        if (typeof window !== "undefined" && viagemAtiva) {
          const key = `chilinho_itinerary_${viagemAtiva.id}`;
          const raw = localStorage.getItem(key);
          if (raw) {
            const roteiro = JSON.parse(raw);
            if (roteiro[item.diaData] && roteiro[item.diaData].despesas) {
              roteiro[item.diaData].despesas = roteiro[item.diaData].despesas.filter((d: Despesa) => d.id !== docId);
            }
            if (!roteiro[editVinculo]) {
              roteiro[editVinculo] = { hospedagem: null, atividades: [], despesas: [], cronograma_horario: {} };
            }
            if (!roteiro[editVinculo].despesas) roteiro[editVinculo].despesas = [];
            roteiro[editVinculo].despesas.push({
              id: docId,
              diaId: editVinculo,
              nome: editNome.trim(),
              valor: val,
              categoria: finalCategory
            });
            localStorage.setItem(key, JSON.stringify(roteiro));
          }
        }
        emitLog(`SYSTEM: Despesa '${editNome}' atualizada com sucesso.`);
      } else if (item.tipo === "hospedagem") {
        if (isFirebaseConfigured && db && viagemAtiva) {
          if (item.diaData !== editVinculo && editVinculo !== "global") {
            await deleteDoc(doc(db, "viagens", viagemAtiva.id, "hoteis", item.diaData));
          }
          if (editVinculo !== "global") {
            await setDoc(doc(db, "viagens", viagemAtiva.id, "hoteis", editVinculo), {
              nome: editNome.trim(),
              preco_diario: val,
              link: ""
            });
          }
        }
        if (typeof window !== "undefined" && viagemAtiva) {
          const key = `chilinho_itinerary_${viagemAtiva.id}`;
          const raw = localStorage.getItem(key);
          if (raw) {
            const roteiro = JSON.parse(raw);
            if (roteiro[item.diaData]) roteiro[item.diaData].hospedagem = null;
            if (editVinculo !== "global") {
              if (!roteiro[editVinculo]) roteiro[editVinculo] = { hospedagem: null, atividades: [] };
              roteiro[editVinculo].hospedagem = { nome: editNome.trim(), preco_diario: val, link: "" };
            }
            localStorage.setItem(key, JSON.stringify(roteiro));
          }
        }
        emitLog(`SYSTEM: Hospedagem '${editNome}' atualizada com sucesso.`);
      } else if (item.tipo === "passeio") {
        if (isFirebaseConfigured && db && viagemAtiva) {
          const snapshot = await getDocs(collection(db, "viagens", viagemAtiva.id, "passeios"));
          const matchDoc = snapshot.docs.find(d => d.data().diaId === item.diaData && d.data().nome === item.nome);
          if (matchDoc) {
            await updateDoc(doc(db, "viagens", viagemAtiva.id, "passeios", matchDoc.id), {
              nome: editNome.trim(),
              valor: val,
              diaId: editVinculo === "global" ? item.diaData : editVinculo
            });
          }
        }
        if (typeof window !== "undefined" && viagemAtiva) {
          const key = `chilinho_itinerary_${viagemAtiva.id}`;
          const raw = localStorage.getItem(key);
          if (raw) {
            const roteiro = JSON.parse(raw);
            const idx = Number(item.key.split("-").pop());
            if (roteiro[item.diaData] && roteiro[item.diaData].atividades && !isNaN(idx)) {
              const [removed] = roteiro[item.diaData].atividades.splice(idx, 1);
              const targetDia = editVinculo === "global" ? item.diaData : editVinculo;
              if (!roteiro[targetDia]) roteiro[targetDia] = { hospedagem: null, atividades: [] };
              roteiro[targetDia].atividades.push({
                nome: editNome.trim(),
                valor: val,
                link: removed?.link || ""
              });
              localStorage.setItem(key, JSON.stringify(roteiro));
            }
          }
        }
        emitLog(`SYSTEM: Atividade '${editNome}' atualizada com sucesso.`);
      }

      setEditingItemKey(null);
      if (!isFirebaseConfigured) {
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      setEditErro("Falha ao salvar as alterações.");
    } finally {
      setEditSalvando(false);
    }
  };

  // Dispara o JOB transacional de atualização de preços sob demanda
  const handleAtualizarCotacoes = async () => {
    if (!viagemAtiva) return;
    setIsUpdatingPrices(true);
    try {
      await atualizarCotacoesOnDemand(viagemAtiva.id);
      await carregarDadosViagens(viagemAtiva.id);
    } catch (err) {
      console.error("Falha ao rodar JOB de preços:", err);
      emitLog("SYSTEM ERROR: Falha crítica na cotação automática.");
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  // ==========================================
  // Cálculos de orçamento consolidados (para a aba de dashboard/ KPIs da sidebar)
  // ==========================================
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

  // Somar despesas gerais/globais
  const despesasGlobais = roteiroDiario["global"]?.despesas || [];
  const totalDespesasGlobais = despesasGlobais.reduce((acc, exp) => acc + exp.valor, 0);
  totalDespesas += totalDespesasGlobais;

  // Lista unificada de todas as despesas da viagem (globais + diárias) para o Splitwise
  const todasDespesas: Despesa[] = [...despesasGlobais];
  datasViagem.forEach((dia) => {
    const diario = roteiroDiario[dia];
    if (diario && diario.despesas) {
      todasDespesas.push(...diario.despesas);
    }
  });

  const custoTotal = totalHospedagem + totalPasseios + totalDespesas;
  const orcamento = viagemAtiva?.orcamento_maximo || 0;
  const saldo = orcamento - custoTotal;
  const ultrapassou = orcamento > 0 && custoTotal > orcamento;
  const percentualConsumido = orcamento > 0 ? Math.min(100, Math.round((custoTotal / orcamento) * 100)) : 0;

  const percentualHospedagem = custoTotal > 0 ? Math.round((totalHospedagem / custoTotal) * 100) : 0;
  const percentualPasseios = custoTotal > 0 ? Math.round((totalPasseios / custoTotal) * 100) : 0;
  const percentualDespesas = custoTotal > 0 ? Math.round((totalDespesas / custoTotal) * 100) : 0;

  const orcamentoAjustado = orcamento - totalDespesasGlobais;
  const mediaDiariaDisponivel = datasViagem.length > 0 ? (orcamentoAjustado / datasViagem.length) : 0;

  // Montagem do gráfico diário acumulativo (iniciando com 0 para conter somente o vinculado no dia)
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
    categoria: string;
    onDelete: () => Promise<void>;
  }[] = [];

  // Primeiro adiciona as despesas gerais/globais
  despesasGlobais.forEach((exp) => {
    statementItems.push({
      key: `e-global-${exp.id}`,
      diaIdx: -1, // Representação especial para despesa geral
      diaData: "global",
      tipo: "despesa",
      nome: exp.nome,
      valor: exp.valor,
      detalhe: `Geral (${exp.categoria})`,
      categoria: exp.categoria || "Outros",
      onDelete: () => handleRemoverDespesa("global", exp.id || "")
    });
  });

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
          categoria: "Hospedagem",
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
            categoria: "Lazer/Passeios",
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
            categoria: exp.categoria || "Outros",
            onDelete: () => handleRemoverDespesa(dia, exp.id || "")
          });
        });
      }
    }
  });

  // Aplicar filtros reativos ao Extrato Consolidado
  const filteredStatementItems = statementItems.filter((item) => {
    // Filtro por Vínculo (Conexão)
    if (filtroVinculo === "global" && item.diaData !== "global") return false;
    if (filtroVinculo === "dias" && item.diaData === "global") return false;

    // Filtro por Categoria
    if (filtroCategoria !== "todas" && item.categoria !== filtroCategoria) return false;

    return true;
  });

  // Agrupar itens filtrados por categoria para o Extrato
  const groupedItems: Record<string, typeof filteredStatementItems> = {};
  filteredStatementItems.forEach((item) => {
    const cat = item.categoria || "Outros";
    if (!groupedItems[cat]) {
      groupedItems[cat] = [];
    }
    groupedItems[cat].push(item);
  });

  const financialGlowClass = ultrapassou
    ? "border-rose-500/50 shadow-lg shadow-rose-500/10"
    : percentualConsumido > 80
      ? "border-amber-500/50 shadow-lg shadow-amber-500/10"
      : "border-indigo-500/35 shadow-lg shadow-indigo-500/5";

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col min-h-screen p-4 md:p-6 space-y-4 relative selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Pulsating Gradient Mesh BG */}
      <div className="gradient-mesh-bg" />

      {/* Grid Principal Dividida: Sidebar e Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch flex-1">
        
        {/* COLUNA 1: SIDEBAR LATERAL DE CONTROLE */}
        <aside className="hidden lg:flex lg:col-span-3 flex-col justify-between glass-panel p-5 rounded-2xl relative overflow-hidden h-fit lg:h-[calc(100vh-3rem)] sticky lg:top-6 select-none bg-[#130d20] border-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-purple-600 via-indigo-500 to-blue-500" />
          
          <div className="space-y-5">
            {/* Botão de Retorno Central */}
            {viagemAtiva && (
              <button
                onClick={() => setViagemAtiva(null)}
                className="w-full h-10 px-4 flex items-center justify-center font-bold tracking-widest uppercase transition-all bg-[#1a1230] border border-white/10 hover:border-white/20 text-[#8a82a8] hover:text-[#eeeaf6] cursor-pointer rounded-xl text-[9px] hover:scale-[1.01] active:scale-[0.99] shadow-inner font-mono"
              >
                Voltar para a Central
              </button>
            )}

            {/* Info Rota Compact Box */}
            <div className="bg-[#1a1230]/60 border border-white/5 p-4 rounded-xl text-center space-y-2 shadow-inner">
              {viagemAtiva ? (
                <>
                  <span className="text-[8px] font-bold font-mono text-[#c49eff] bg-[#c49eff]/10 border border-[#c49eff]/20 px-2 py-0.5 rounded uppercase tracking-wider">
                    Workspace Ativo
                  </span>
                  <h2 className="text-xs font-black text-[#eeeaf6] uppercase tracking-wide truncate pt-1 font-heading">
                    {viagemAtiva.destino.replace(/ \(.*\)/, "")}
                  </h2>
                  <p className="text-[9.5px] font-mono text-[#8a82a8] font-semibold">
                    {viagemAtiva.data_inicio} até {viagemAtiva.data_fim}
                  </p>
                  <div className="text-[8.5px] font-mono text-[#4a4468] bg-black/40 px-2 py-0.5 rounded border border-[#1a1230] truncate shadow-inner">
                    REG: {viagemAtiva.id}
                  </div>
                </>
              ) : (
                <>
                  <span className="text-[8px] font-bold font-mono text-[#8a82a8] bg-[#8a82a8]/10 border border-[#8a82a8]/20 px-2 py-0.5 rounded uppercase tracking-wider">
                    Workspace Inativo
                  </span>
                  <h2 className="text-xs font-black text-[#8a82a8] uppercase tracking-wide truncate pt-1 font-heading">
                    Nenhuma Viagem Ativa
                  </h2>
                  <p className="text-[9.5px] font-mono text-[#4a4468] font-semibold">
                    Selecione uma rota para carregar
                  </p>
                  <div className="text-[8.5px] font-mono text-[#4a4468] bg-black/40 px-2 py-0.5 rounded border border-[#1a1230] truncate shadow-inner">
                    REG: N/A
                  </div>
                </>
              )}
            </div>

            {/* Bloco de Auth no Sidebar */}
            {isAuthLoading ? (
              <div className="bg-[#1a1230]/40 border border-white/5 p-3 rounded-xl text-center text-[8.5px] font-mono text-[#8a82a8] font-bold uppercase tracking-wider">
                Verificando Conta...
              </div>
            ) : user ? (
              <div className="bg-[#1a1230]/40 border border-white/5 p-3 rounded-xl flex items-center justify-between gap-2.5 shadow-inner">
                <div className="flex items-center gap-2.5 min-w-0">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Foto" className="w-6 h-6 rounded-full border border-purple-500/40" />
                  ) : (
                    <span className="w-6 h-6 flex items-center justify-center bg-purple-500/10 border border-purple-500/20 text-[#c49eff] rounded-full font-bold text-[9px]">👤</span>
                  )}
                  <div className="min-w-0 flex flex-col">
                    <span className="text-[#eeeaf6] font-bold text-[9.5px] uppercase truncate tracking-wide leading-tight">
                      {user.displayName || "Usuário"}
                    </span>
                    <span className="text-[#8a82a8] font-mono text-[8px] truncate leading-none mt-0.5">
                      {user.email}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-transparent hover:text-rose-400 text-[#8a82a8] font-bold text-[9px] uppercase border-0 cursor-pointer transition-colors"
                  title="Sair da Conta"
                >
                  Sair
                </button>
              </div>
            ) : (
              <div className="bg-[#1a1230]/40 border border-white/5 p-3 rounded-xl flex flex-col gap-2 text-center shadow-inner">
                <span className="text-[8.5px] font-mono text-[#8a82a8] uppercase tracking-wider font-bold">Acesso Restrito</span>
                <button
                  onClick={handleLoginGoogle}
                  className="w-full py-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-bold text-[9.5px] uppercase transition-all rounded-lg cursor-pointer border-0 shadow-md active:scale-95"
                >
                  🔑 Entrar com Google
                </button>
              </div>
            )}

            {/* Navegador de Abas */}
            <nav className="flex flex-col space-y-2.5">
              <button
                onClick={() => setActiveTab("visao-geral")}
                className={`h-11 px-4 flex items-center justify-between font-bold text-[10px] uppercase transition-all border rounded-xl cursor-pointer ${
                  activeTab === "visao-geral"
                    ? "bg-[#007aff] border-[#007aff] text-white shadow-[0_4px_18px_rgba(0,122,255,0.45)] scale-[1.01]"
                    : "bg-[#1a1230]/40 border-white/5 hover:border-white/10 text-[#8a82a8] hover:text-[#eeeaf6] hover:bg-[#1a1230]/60"
                }`}
              >
                <span>📊 Visão Geral</span>
                <span className={`w-1.5 h-1.5 rounded-full ${activeTab === "visao-geral" ? "bg-white led-blue animate-pulse" : "bg-[#4a4468]"}`} />
              </button>

              {[
                { id: "financas" as const, label: "Finanças", icon: "💸" },
                { id: "cronograma" as const, label: "Cronograma Diário", icon: "📅" },
                { id: "banco" as const, label: "Banco de Alocações", icon: "🛍️" },
                { id: "checklist" as const, label: "Checklist de Bagagem", icon: "🎒" },
                { id: "logs" as const, label: "Logs do Terminal", icon: "📋" }
              ].map((t) => {
                const isDisabled = !viagemAtiva;
                const isSelected = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => !isDisabled && setActiveTab(t.id)}
                    disabled={isDisabled}
                    className={`h-11 px-4 flex items-center justify-between font-bold text-[10px] uppercase transition-all border rounded-xl ${
                      isDisabled
                        ? "bg-[#1a1230]/10 border-white/5 text-[#4a4468] cursor-not-allowed opacity-40"
                        : isSelected
                        ? "bg-[#007aff] border-[#007aff] text-white shadow-[0_4px_18px_rgba(0,122,255,0.45)] scale-[1.01]"
                        : "bg-[#1a1230]/40 border-white/5 hover:border-white/10 text-[#8a82a8] hover:text-[#eeeaf6] hover:bg-[#1a1230]/60 cursor-pointer"
                    }`}
                  >
                    <span>{t.icon} {t.label}</span>
                    {!isDisabled && (
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white led-blue animate-pulse" : "bg-[#4a4468]"}`} />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Rodapé da Sidebar - Configurações */}
          <div className="pt-4 border-t border-white/5 space-y-3.5 select-none mt-6">
            {/* Botão Re-Cotar */}
            {viagemAtiva && (
              <button
                onClick={handleAtualizarCotacoes}
                disabled={isUpdatingPrices}
                className="w-full py-2.5 bg-gradient-to-r from-purple-900/40 to-indigo-900/40 hover:from-purple-800/60 hover:to-indigo-800/60 border border-purple-500/35 hover:border-purple-400 text-purple-300 hover:text-white text-[9.5px] font-bold uppercase transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:hover:bg-transparent rounded-lg font-mono shadow-md hover:shadow-purple-500/10 hover:scale-[1.01]"
              >
                {isUpdatingPrices ? (
                  <>
                    <span className="w-1.5 h-1.5 bg-purple-400 led-purple rounded-full animate-ping" />
                    Analisando Tarifas IA...
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>Atualizar Preços via IA</span>
                  </>
                )}
              </button>
            )}

            {/* Ações Auxiliares */}
            {viagemAtiva && (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsFormEdicaoAberto(true)}
                  className="flex-1 py-2 bg-[#1a1230] hover:bg-[#1a1230]/80 border border-white/10 hover:border-white/20 text-[#8a82a8] hover:text-[#eeeaf6] transition-colors uppercase font-bold text-[9px] rounded-lg cursor-pointer shadow-sm active:scale-95"
                >
                  Editar
                </button>
                <button
                  onClick={(e) => handleDeletarViagem(e, viagemAtiva.id, viagemAtiva.destino)}
                  className="py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-500 transition-colors rounded-lg cursor-pointer flex items-center justify-center"
                  title="Excluir Viagem definitivamente"
                >
                  🗑️
                </button>
              </div>
            )}

            {/* Time/Status indicator */}
            <div className="bg-[#1a1230]/50 border border-white/5 rounded-xl p-2.5 flex items-center justify-between font-mono text-[8px] select-none shadow-inner">
              <div className="flex items-center gap-1.5 font-bold">
                <span className="w-1.5 h-1.5 bg-[#6ee8f8] rounded-full led-green animate-pulse" />
                <span className="text-[#6ee8f8]">ONLINE</span>
              </div>
              <span className="text-[#4a4468]">|</span>
              <span className="text-[#8a82a8] font-bold uppercase tracking-wider">STABLE</span>
              <span className="text-[#4a4468]">|</span>
              <span className="text-[#4a4468]">SYS: 2026-06-03</span>
            </div>
          </div>
        </aside>

        {/* COLUNA 2: WORKSPACE DE CONTEÚDO ATIVO */}
        <main className="lg:col-span-9 flex flex-col space-y-4 min-h-0 workspace-fade-in pb-24 lg:pb-0">
          
          {/* Header de Acompanhamento no Workspace - Premium Status Node */}
          <header className="w-full glass-panel p-4 flex items-center justify-between gap-4 relative overflow-hidden rounded-2xl select-none shadow-xl border border-white/5 bg-[#130d20]">
            <div className="absolute top-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-purple-600 to-indigo-600" />
            <div className="flex items-center space-x-3.5">
              {viagemAtiva && (
                <button
                  onClick={() => setViagemAtiva(null)}
                  className="lg:hidden w-8 h-8 flex items-center justify-center bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-355 hover:text-slate-100 rounded-xl text-xs transition-colors cursor-pointer shadow-inner"
                  title="Voltar para a Central"
                >
                  ◀
                </button>
              )}
              <div>
                <h1 className="text-xs font-black tracking-wider text-[#eeeaf6] uppercase font-heading leading-tight pt-0.5">
                  {viagemAtiva ? viagemAtiva.destino.replace(/ \(.*\)/, "") : "Evolução de Viagens"}
                </h1>
                <p className="text-[8px] text-[#8a82a8] font-bold uppercase tracking-wider font-mono mt-0.5">
                  {viagemAtiva ? "ROTA DE PLANEJAMENTO ATIVA" : "SELECIONE OU CRIE UMA ROTA ABAIXO"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 font-mono text-[8px] select-none">
              <div className="flex items-center space-x-1.5 bg-black/40 px-3 py-1.5 border border-white/5 rounded-xl shadow-inner font-bold">
                <span className="w-1.5 h-1.5 bg-[#6ee8f8] rounded-full led-green animate-pulse" />
                <span className="text-[#6ee8f8]">ONLINE</span>
                <span className="text-[#4a4468]">|</span>
                <span className="text-[#8a82a8]">STABLE</span>
              </div>
            </div>
          </header>

              {/* =======================================
              ABA 1: Visão Geral
              ======================================= */}
          {activeTab === "visao-geral" && (
            viagemAtiva ? (
              <div className="space-y-5 flex-1 flex flex-col min-h-0">
                {/* KPIs de Orçamento Redesenhados de forma Ultra Premium e Acessíveis */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full select-none">
                  {/* KPI Orçamento Máximo */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveKpiModal("teto")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveKpiModal("teto");
                      }
                    }}
                    aria-label="Ver resumo e detalhamento do Teto Orçamentário"
                    className="glass-panel p-5 rounded-2xl relative overflow-hidden transition-all duration-300 hover:scale-[1.015] hover:border-indigo-500/40 border border-slate-800/80 shadow-md flex items-center justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    <div>
                      <div className="text-[9px] font-mono text-[#8a82a8] uppercase tracking-widest">Teto Orçamentário</div>
                      <div className="text-sm font-black text-slate-100 mt-1 font-sans">
                        R$ {orcamento.toLocaleString("pt-BR")}
                      </div>
                      <div className="text-[8.5px] text-[#8a82a8] font-semibold mt-1.5 uppercase font-mono leading-none">
                        definido pelo planejamento
                      </div>
                    </div>
                    <div className="text-2xl text-slate-600 bg-slate-950/45 p-2.5 rounded-xl border border-slate-850 shadow-inner select-none">
                      🔑
                    </div>
                  </div>

                  {/* KPI Consumido */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveKpiModal("consumo")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveKpiModal("consumo");
                      }
                    }}
                    aria-label="Ver resumo e detalhamento do Consumo Consolidado"
                    className={`glass-panel p-5 rounded-2xl relative overflow-hidden transition-all duration-300 hover:scale-[1.015] border ${financialGlowClass} flex items-center justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50`}
                  >
                    <div>
                      <div className="text-[9px] font-mono text-[#8a82a8] uppercase tracking-widest">Consumo Consolidado</div>
                      <div className={`text-sm font-black mt-1 font-sans ${ultrapassou ? "text-rose-455" : "text-[#6ee8f8]"}`}>
                        R$ {custoTotal.toLocaleString("pt-BR")}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 select-none leading-none">
                        <span className={`text-[8.5px] font-bold uppercase tracking-wider ${ultrapassou ? "text-rose-455 animate-pulse" : "text-[#6ee8f8]"}`}>
                          {percentualConsumido}% CONSUMIDO
                        </span>
                        {ultrapassou && (
                          <span className="text-[7px] bg-rose-500/20 text-rose-500 font-bold px-1.5 py-0.5 rounded uppercase led-red font-sans">
                            EXCEDIDO
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-2xl animate-pulse-lightning text-amber-500 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 shadow-inner select-none">
                      ⚡
                    </div>
                  </div>

                  {/* KPI Saldo Restante */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveKpiModal("saldo")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveKpiModal("saldo");
                      }
                    }}
                    aria-label="Ver resumo e detalhamento do Saldo Financeiro"
                    className="glass-panel p-5 rounded-2xl relative overflow-hidden transition-all duration-300 hover:scale-[1.015] hover:border-indigo-500/40 border border-slate-800/80 shadow-md flex items-center justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    <div>
                      <div className="text-[9px] font-mono text-[#8a82a8] uppercase tracking-widest">Saldo Financeiro</div>
                      <div className={`text-sm font-black mt-1 font-sans ${saldo < 0 ? "text-rose-400" : "text-emerald-450"}`}>
                        R$ {saldo.toLocaleString("pt-BR")}
                      </div>
                      <div className="text-[8.5px] text-[#8a82a8] font-semibold mt-1.5 uppercase font-mono leading-none">
                        {saldo < 0 ? "saldo devedor da rota" : "saldo livre disponível"}
                      </div>
                    </div>
                    <div className={`text-2xl animate-pulse-heartbeat p-2.5 rounded-xl border shadow-inner select-none ${
                      saldo < 0 
                        ? "text-rose-500 bg-rose-500/10 border-rose-500/20" 
                        : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                    }`}>
                      ❤️
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

                {/* Currency Rate Widget */}
                <CurrencyWidget />

                {/* Painel de Resumo das Abas (Dashboard Integrado) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 w-full select-none">
                  
                  {/* 2. Resumo de Finanças */}
                  <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 shadow-md flex flex-col justify-between space-y-4 md:col-span-8">
                    <div className="space-y-4">
                      {/* Card Title & Header */}
                      <div className="flex items-center justify-between">
                        <h3 className="text-[10.5px] font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
                          <span>💸</span>
                          <span>Resumo de Finanças</span>
                        </h3>
                        <span className="text-[7.5px] font-mono font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                          Consolidado
                        </span>
                      </div>

                      {/* Content Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Left Side: Category Breakdown */}
                        <div className="space-y-4">
                          <h4 className="text-[8.5px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-900 pb-1">
                            Distribuição das Categorias
                          </h4>

                          {/* Segmented linear bar representing distribution */}
                          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden flex border border-slate-900 shadow-inner">
                            {totalHospedagem > 0 && (
                              <div style={{ width: `${percentualHospedagem}%` }} className="h-full bg-gradient-to-r from-indigo-500 to-indigo-650" title={`Acomodação: ${percentualHospedagem}%`} />
                            )}
                            {totalPasseios > 0 && (
                              <div style={{ width: `${percentualPasseios}%` }} className="h-full bg-gradient-to-r from-emerald-500 to-emerald-650 border-l border-slate-950" title={`Atividades: ${percentualPasseios}%`} />
                            )}
                            {totalDespesas > 0 && (
                              <div style={{ width: `${percentualDespesas}%` }} className="h-full bg-gradient-to-r from-amber-500 to-rose-500 border-l border-slate-950" title={`Despesas: ${percentualDespesas}%`} />
                            )}
                            {custoTotal === 0 && (
                              <div className="w-full h-full bg-slate-900 flex items-center justify-center text-[7px] text-slate-600 font-bold uppercase tracking-wider">
                                Sem despesas registradas
                              </div>
                            )}
                          </div>

                          <div className="space-y-2.5 text-[9px]">
                            {/* Hospedagem */}
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-1.5 font-bold text-indigo-455">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                <span>Acomodação</span>
                              </div>
                              <span className="font-mono text-slate-300 font-bold">
                                R$ {totalHospedagem.toLocaleString("pt-BR")} <span className="text-[7.5px] text-slate-500 font-normal">({percentualHospedagem}%)</span>
                              </span>
                            </div>

                            {/* Passeios */}
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-1.5 font-bold text-emerald-455">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>Atividades</span>
                              </div>
                              <span className="font-mono text-slate-300 font-bold">
                                R$ {totalPasseios.toLocaleString("pt-BR")} <span className="text-[7.5px] text-slate-500 font-normal">({percentualPasseios}%)</span>
                              </span>
                            </div>

                            {/* Despesas */}
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-1.5 font-bold text-amber-450">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span>Despesas Extras</span>
                              </div>
                              <span className="font-mono text-slate-300 font-bold">
                                R$ {totalDespesas.toLocaleString("pt-BR")} <span className="text-[7.5px] text-slate-500 font-normal">({percentualDespesas}%)</span>
                              </span>
                            </div>
                          </div>

                          {/* Render Subcategories of Despesas Extras if totalDespesas > 0 */}
                          {totalDespesas > 0 && (
                            <div className="pt-2 border-t border-slate-900/60">
                              <span className="text-[7.5px] font-bold text-slate-555 uppercase tracking-wider block mb-1.5">
                                Subcategorias de Despesas Extras:
                              </span>
                              <div className="grid grid-cols-2 gap-1.5">
                                {Object.entries(
                                  todasDespesas.reduce<Record<string, number>>((acc, exp) => {
                                    const cat = exp.categoria || "Outros";
                                    acc[cat] = (acc[cat] || 0) + exp.valor;
                                    return acc;
                                  }, {})
                                ).map(([cat, val]) => (
                                  <div key={cat} className="bg-slate-950/40 border border-slate-900 p-1.5 rounded-md flex items-center justify-between text-[8px]">
                                    <span className="text-slate-455 uppercase truncate max-w-[65px] font-semibold">{cat}</span>
                                    <span className="font-mono text-slate-300 font-bold">R$ {Math.round(val).toLocaleString("pt-BR")}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Right Side: Top single expenses (Maiores Gastos) & Budget Bar */}
                        <div className="space-y-4">
                          <h4 className="text-[8.5px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-900 pb-1">
                            Maiores Gastos da Viagem
                          </h4>

                          <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                            {statementItems.length === 0 ? (
                              <div className="text-center py-6 text-[8.5px] text-slate-600 font-bold uppercase tracking-wider">
                                Nenhum lançamento encontrado
                              </div>
                            ) : (
                              [...statementItems]
                                .sort((a, b) => b.valor - a.valor)
                                .slice(0, 3)
                                .map((item) => {
                                  const icons: Record<string, string> = {
                                    hospedagem: "🏨",
                                    passeio: "🎟️",
                                    despesa: "💸"
                                  };
                                  return (
                                    <div key={item.key} className="flex items-center justify-between bg-slate-950/50 border border-slate-900/60 p-2 rounded-xl text-[9px] hover:border-slate-800 transition-colors">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-xs select-none">{icons[item.tipo] || "💰"}</span>
                                        <div className="min-w-0 flex flex-col">
                                          <span className="text-slate-200 font-bold uppercase truncate max-w-[120px] leading-tight">
                                            {item.nome}
                                          </span>
                                          <span className="text-slate-500 text-[7px] uppercase tracking-wider font-semibold">
                                            {item.tipo === "hospedagem" ? "Acomodação" : item.tipo === "passeio" ? "Atividade" : item.categoria}
                                          </span>
                                        </div>
                                      </div>
                                      <span className="font-mono text-indigo-400 font-bold ml-1.5 shrink-0">
                                        R$ {item.valor.toLocaleString("pt-BR")}
                                      </span>
                                    </div>
                                  );
                                })
                            )}
                          </div>

                          {/* Budget utilization status bar */}
                          <div className="bg-slate-950/30 border border-slate-900 p-2.5 rounded-xl space-y-1.5 select-none">
                            <div className="flex justify-between text-[7.5px] font-bold text-slate-500 uppercase">
                              <span>Teto Consumido</span>
                              <span className={ultrapassou ? "text-rose-455" : "text-emerald-450"}>
                                {percentualConsumido}% ({custoTotal > 0 ? `R$ ${custoTotal.toLocaleString("pt-BR")}` : "R$ 0"} / R$ {orcamento.toLocaleString("pt-BR")})
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-950 border border-slate-900 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${percentualConsumido}%` }}
                                className={`h-full transition-all duration-300 ${
                                  ultrapassou
                                    ? "bg-gradient-to-r from-rose-500 to-red-600"
                                    : percentualConsumido > 80
                                    ? "bg-gradient-to-r from-amber-500 to-orange-500"
                                    : "bg-gradient-to-r from-indigo-500 to-indigo-650"
                                }`}
                              />
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab("financas")}
                      className="w-full py-2 bg-slate-950 border border-slate-850 hover:border-slate-800 hover:text-slate-200 text-slate-400 font-bold text-[9px] rounded-xl uppercase transition-all cursor-pointer text-center border-0 shadow-md mt-2"
                    >
                      Acessar Finanças Completa ➔
                    </button>
                  </div>
                  
                  {/* 1. Resumo da Agenda e Itinerário */}
                  <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 shadow-md flex flex-col justify-between space-y-4 md:col-span-4">
                    <div className="space-y-3">
                      <h3 className="text-[10px] font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
                        <span>📅</span>
                        <span>Resumo da Agenda</span>
                      </h3>
                      <div className="space-y-2 text-[10px] text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-550 uppercase font-bold">Duração Total:</span>
                          <span className="font-mono font-bold">{datasViagem.length} dias</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-555 uppercase font-bold">Hospedagem reservada:</span>
                          <span className="font-mono font-bold text-[#6ee8f8]">
                            {datasViagem.filter(dia => roteiroDiario[dia]?.hospedagem).length} de {datasViagem.length} noites
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-555 uppercase font-bold">Passeios & Atividades:</span>
                          <span className="font-mono font-bold text-amber-500">
                            {datasViagem.reduce((acc, dia) => acc + (roteiroDiario[dia]?.atividades?.length || 0), 0)} itens agendados
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab("cronograma")}
                      className="w-full py-2 bg-slate-950 border border-slate-850 hover:border-slate-800 hover:text-slate-200 text-slate-400 font-bold text-[9px] rounded-xl uppercase transition-all cursor-pointer text-center border-0 shadow-md"
                    >
                      Acessar Agenda Completa ➔
                    </button>
                  </div>

                  {/* 3. Banco de Alocações (Itens Livres) */}
                  <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 shadow-md flex flex-col justify-between space-y-4 md:col-span-4">
                    <div className="space-y-3">
                      <h3 className="text-[10px] font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
                        <span>🛍️</span>
                        <span>Banco de Alocações</span>
                      </h3>
                      <div className="text-[10px] text-slate-455 leading-relaxed font-sans font-medium uppercase tracking-wide">
                        Pesquise hotéis recomendados ou crie passeios customizados e injete-os em qualquer dia da viagem ativa.
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab("banco")}
                      className="w-full py-2 bg-slate-950 border border-slate-850 hover:border-slate-800 hover:text-slate-200 text-slate-400 font-bold text-[9px] rounded-xl uppercase transition-all cursor-pointer text-center border-0 shadow-md"
                    >
                      Abrir Banco de Alocações ➔
                    </button>
                  </div>

                  {/* 4. Console Real-Time Monitor Preview */}
                  <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 shadow-md flex flex-col justify-between space-y-4 md:col-span-8">
                    <div className="space-y-3">
                      <h3 className="text-[10px] font-black uppercase text-indigo-400 tracking-wider flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span>📋</span>
                          <span>Monitor de Logs</span>
                        </div>
                        <span className="w-1.5 h-1.5 bg-[#6ee8f8] rounded-full led-green animate-pulse" />
                      </h3>
                      <div className="bg-slate-950/70 border border-slate-855 rounded-xl p-3 font-mono text-[8.5px] space-y-1.5 h-20 overflow-y-auto select-none shadow-inner leading-normal">
                        {consoleLogs.map((log, index) => {
                          let colorClass = "text-slate-455";
                          if (log.includes("[SYSTEM]")) colorClass = "text-cyan-400/90 font-bold";
                          else if (log.includes("FIRESTORE:")) colorClass = "text-[#6ee8f8] font-semibold";
                          else if (log.includes("OPTIMISTIC:")) colorClass = "text-indigo-455 font-bold";
                          else if (log.includes("ERROR")) colorClass = "text-rose-400 animate-pulse";
                          return (
                            <div key={index} className={colorClass}>
                              {log}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab("logs")}
                      className="w-full py-2 bg-slate-950 border border-slate-855 hover:border-slate-800 hover:text-slate-200 text-slate-400 font-bold text-[9px] rounded-xl uppercase transition-all cursor-pointer text-center border-0 shadow-md"
                    >
                      Abrir Console de Logs ➔
                    </button>
                  </div>

                </div>
              </div>
            ) : (
              <div className="space-y-6 select-none w-full">
                {/* Introdução / Subtitle */}
                <div className="text-center py-4 max-w-2xl mx-auto space-y-1">
                  <h2 className="text-sm font-black text-[#eeeaf6] tracking-wider uppercase font-sans">
                    Selecione uma Viagem
                  </h2>
                  <p className="text-[9px] text-[#8a82a8] uppercase tracking-widest font-bold font-mono">
                    Acesse o workspace de planejamento focado ou crie uma nova rota
                  </p>
                </div>

                {/* Grid de Viagens */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full pb-12">
                  {viagens.map((v, index) => {
                    const colors = [
                      { border: "hover:border-[#c49eff]/60", badge: "text-[#c49eff] bg-[#c49eff]/10 border-[#c49eff]/20", glow: "glow-card-indigo" },
                      { border: "hover:border-[#6ee8f8]/60", badge: "text-[#6ee8f8] bg-[#6ee8f8]/10 border-[#6ee8f8]/20", glow: "glow-card-emerald" },
                      { border: "hover:border-[#fbbf24]/60", badge: "text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/20", glow: "glow-card-amber" }
                    ];
                    const theme = colors[index % colors.length];

                    return (
                      <div
                        key={v.id}
                        onClick={() => handleSelecionarViagem(v.id)}
                        className={`bg-[#1a1230]/40 p-5 rounded-2xl border border-white/5 cursor-pointer flex flex-col justify-between min-h-[200px] relative overflow-hidden group transition-all duration-300 hover:scale-[1.01] ${theme.border}`}
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/10 to-transparent blur-md rounded-bl-full pointer-events-none" />

                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[8px] font-bold font-mono uppercase border px-2 py-0.5 rounded ${theme.badge}`}>
                              ROTA ATIVA
                            </span>
                            <button
                              onClick={(e) => handleDeletarViagem(e, v.id, v.destino)}
                              className="w-6 h-6 flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/25 border-0 text-rose-500 rounded-lg transition-colors cursor-pointer z-10 scale-90"
                              title="Excluir Rota definitivamente"
                            >
                              🗑️
                            </button>
                          </div>
                          <h3 className="text-sm font-black text-[#eeeaf6] uppercase tracking-wide truncate pt-2 font-heading">
                            {v.destino.replace(/ \(.*\)/, "")}
                          </h3>
                          <p className="text-[9px] text-[#8a82a8] font-bold uppercase tracking-wider font-mono mt-0.5">
                            Saída: <span className="text-[#eeeaf6]/85">{v.origem.replace(/ \(.*\)/, "")}</span>
                          </p>
                        </div>

                        <div className="pt-4 border-t border-white/5 space-y-2.5">
                          <div className="flex justify-between items-center text-[9px]">
                            <span className="text-[#8a82a8] font-bold uppercase">Período</span>
                            <span className="font-mono text-[#eeeaf6] font-semibold">{v.data_inicio} a {v.data_fim}</span>
                          </div>
                          <div className="flex justify-between items-center text-[9px]">
                            <span className="text-[#8a82a8] font-bold uppercase">Orçamento Teto</span>
                            <span className="font-mono text-[#fbbf24] font-bold">R$ {v.orcamento_maximo.toLocaleString("pt-BR")}</span>
                          </div>
                        </div>

                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-purple-500/40 via-blue-500/40 to-emerald-500/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                    );
                  })}

                  {/* Card Especial de Nova Rota */}
                  <div
                    onClick={() => setIsFormCriacaoAberto(true)}
                    className="bg-[#1a1230]/20 p-5 rounded-2xl border border-dashed border-white/10 hover:border-purple-500/60 hover:bg-[#1a1230]/40 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 min-h-[200px] group/new select-none hover:scale-[1.01]"
                  >
                    <span className="text-2xl text-[#8a82a8] group-hover/new:text-purple-400 group-hover/new:scale-110 transition-all duration-300">➕</span>
                    <span className="text-[9px] font-black tracking-widest text-[#8a82a8] group-hover/new:text-[#eeeaf6] mt-3 uppercase">
                      Nova Viagem
                    </span>
                    <span className="text-[8px] font-mono text-[#4a4468] mt-1 uppercase">
                      Criar nova viagem no Firestore
                    </span>
                  </div>
                </div>
              </div>
            )
          )}

          {/* =======================================
              ABA 1.2: Finanças e Relatórios
              ======================================= */}
             {activeTab === "financas" && (
            <div className="space-y-5 flex-1 flex flex-col min-h-0">
              {/* Grid Central Dashboard: Duas Colunas Invertidas */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 flex-1 min-h-0 items-start w-full">
                
                {/* COLUNA ESQUERDA (md:col-span-5) - Lançamento & Categorias */}
                <div className="md:col-span-5 space-y-5 flex flex-col w-full">
                  
                  {/* Formulário Premium de Registro de Despesa */}
                  <div className="glass-panel p-5 rounded-2xl relative overflow-hidden space-y-3.5 shadow-xl border border-slate-800/80 select-none">
                    <div className="absolute top-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-amber-500 to-orange-500" />
                    <h3 className="text-[10px] font-black uppercase text-slate-350 tracking-wider flex items-center justify-between">
                      <span>💸 Registrar Nova Despesa</span>
                      <span className="text-[8px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded uppercase font-mono-tech font-bold leading-none">
                        lançamento direto
                      </span>
                    </h3>
                    <form onSubmit={handleSubmeterFinDespesa} className="space-y-3 text-[10px]">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Vincular a:</label>
                          <select
                            value={finAddVinculo}
                            onChange={(e) => setFinAddVinculo(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 text-slate-300 px-2 py-1.5 text-[9px] rounded-lg focus:outline-none cursor-pointer uppercase font-bold"
                          >
                            <option value="global">Geral (Sem conexão)</option>
                            {datasViagem.map((dia, idx) => (
                              <option key={dia} value={dia}>
                                Dia {String(idx + 1).padStart(2, "0")} ({dia.slice(5).replace("-", "/")})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Categoria:</label>
                          <select
                            value={finAddCategoria}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFinAddCategoria(val);
                              if (val === "Outros") {
                                setFinAddIsCustom(true);
                              } else {
                                setFinAddIsCustom(false);
                              }
                            }}
                            className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 text-slate-300 px-2 py-1.5 text-[9px] rounded-lg focus:outline-none cursor-pointer uppercase font-bold"
                          >
                            <option value="Alimentação">Alimentação 🍽️</option>
                            <option value="Transporte">Transporte 🚗</option>
                            <option value="Lazer">Lazer 🪁</option>
                            <option value="Compras">Compras 🛍️</option>
                            <option value="Outros">Outros 💰</option>
                          </select>
                        </div>
                      </div>

                      {finAddIsCustom && (
                        <div className="space-y-1 animate-fade-in">
                          <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Nome da Nova Categoria:</label>
                          <input
                            type="text"
                            placeholder="Nome da categoria"
                            value={finAddCustomCategoria}
                            onChange={(e) => setFinAddCustomCategoria(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 text-slate-100 px-3 py-1.5 placeholder-slate-750 text-[10px] rounded-lg focus:outline-none focus:border-[#007aff] uppercase font-semibold"
                            autoComplete="off"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Item/Descrição:</label>
                          <input
                            type="text"
                            placeholder="ex: Passagem Aérea"
                            value={finAddNome}
                            onChange={(e) => setFinAddNome(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 text-slate-100 px-3 py-1.5 placeholder-slate-750 text-[10px] rounded-lg focus:outline-none focus:border-[#007aff] uppercase font-semibold"
                            autoComplete="off"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Valor (R$):</label>
                          <input
                            type="number"
                            placeholder="0,00"
                            value={finAddValor}
                            onChange={(e) => setFinAddValor(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 text-slate-100 px-3 py-1.5 placeholder-slate-750 text-[10px] rounded-lg focus:outline-none focus:border-[#007aff] font-mono-tech"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1 select-none">
                        {finAddErro ? (
                          <span className="text-[8.5px] text-rose-455 font-mono-tech font-bold">⚠️ {finAddErro}</span>
                        ) : (
                          <span />
                        )}
                        <button
                          type="submit"
                          disabled={finAddSalvando}
                          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-bold text-[9px] rounded-lg uppercase cursor-pointer border-0 shadow-md transition-all active:scale-95 disabled:opacity-50"
                        >
                          {finAddSalvando ? "SALVANDO..." : "SALVAR DESPESA"}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Distribuição por Categoria */}
                  <div className="glass-panel p-5 rounded-2xl space-y-4 shadow-xl border border-slate-800/80 select-none relative">
                    <div className="absolute top-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-indigo-500 to-blue-500" />
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                      <span>🏷️ Distribuição por Categoria</span>
                      <span className="text-[8px] text-slate-550 lowercase italic">divisão percentual</span>
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
                    <div className="grid grid-cols-3 gap-2.5 text-[9px] pt-1">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1 text-indigo-455 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          <span>Acomodação</span>
                        </div>
                        <span className="text-slate-400 font-mono-tech pl-2.5 font-bold">R$ {totalHospedagem.toLocaleString("pt-BR")}</span>
                        <span className="text-slate-550 font-mono-tech pl-2.5 text-[7.5px] font-semibold">{percentualHospedagem}%</span>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1 text-emerald-455 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Passeios</span>
                        </div>
                        <span className="text-slate-400 font-mono-tech pl-2.5 font-bold">R$ {totalPasseios.toLocaleString("pt-BR")}</span>
                        <span className="text-slate-550 font-mono-tech pl-2.5 text-[7.5px] font-semibold">{percentualPasseios}%</span>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1 text-amber-450 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>Despesas</span>
                        </div>
                        <span className="text-slate-400 font-mono-tech pl-2.5 font-bold">R$ {totalDespesas.toLocaleString("pt-BR")}</span>
                        <span className="text-slate-550 font-mono-tech pl-2.5 text-[7.5px] font-semibold">{percentualDespesas}%</span>
                      </div>
                    </div>
                  </div>

                  {/* TravelersManager Component */}
                  <TravelersManager
                    viajantes={viagemAtiva?.viajantes || []}
                    onAtualizarViajantes={handleAtualizarViajantes}
                  />

                </div>

                {/* COLUNA DIREITA (md:col-span-7) - Extrato & Gráfico Acumulativo */}
                <div className="md:col-span-7 space-y-5 flex flex-col h-full w-full">

                  {/* BillSplitter Component */}
                  <BillSplitter
                    viajantes={viagemAtiva?.viajantes || []}
                    despesas={todasDespesas}
                    usuarioAtualId={user?.uid || "operator-01"}
                  />
                  
                  {/* Extrato Consolidado */}
                  <div className="flex flex-col glass-panel p-5 rounded-2xl relative space-y-4 shadow-xl border border-slate-800/80">
                    <div className="absolute top-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-indigo-500 to-purple-600" />
                    <div className="flex items-center justify-between select-none">
                      <h3 className="text-[10px] font-black uppercase text-slate-355 tracking-wider flex items-center gap-2">
                        <span>🧾 Extrato Consolidado</span>
                        <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono-tech px-2 py-0.5 rounded text-[8px] leading-none uppercase">
                          {filteredStatementItems.length} itens {filteredStatementItems.length !== statementItems.length && `filtrados (de ${statementItems.length})`}
                        </span>
                      </h3>
                    </div>

                    {/* interactive accessible clickable filters pills */}
                    <div className="space-y-2">
                      {/* Connection filter pills */}
                      <div className="flex items-center gap-2 pb-1 border-b border-slate-850/60 overflow-x-auto select-none scrollbar-none">
                        <span className="text-[8px] font-black text-slate-550 uppercase mr-1 whitespace-nowrap">Conexão:</span>
                        <button
                          type="button"
                          onClick={() => setFiltroVinculo("todos")}
                          className={`px-3 py-1 font-mono-tech text-[8px] uppercase font-bold rounded-lg border transition-all cursor-pointer ${
                            filtroVinculo === "todos"
                              ? "bg-indigo-600/20 border-indigo-500/60 text-indigo-300 font-extrabold shadow-sm"
                              : "bg-slate-950/60 border-slate-850 text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          📑 Todos
                        </button>
                        <button
                          type="button"
                          onClick={() => setFiltroVinculo("global")}
                          className={`px-3 py-1 font-mono-tech text-[8px] uppercase font-bold rounded-lg border transition-all cursor-pointer ${
                            filtroVinculo === "global"
                              ? "bg-amber-600/20 border-amber-500/60 text-amber-300 font-extrabold shadow-sm"
                              : "bg-slate-950/60 border-slate-850 text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          🌍 Globais/Gerais
                        </button>
                        <button
                          type="button"
                          onClick={() => setFiltroVinculo("dias")}
                          className={`px-3 py-1 font-mono-tech text-[8px] uppercase font-bold rounded-lg border transition-all cursor-pointer ${
                            filtroVinculo === "dias"
                              ? "bg-emerald-600/20 border-emerald-500/60 text-emerald-300 font-extrabold shadow-sm"
                              : "bg-slate-950/60 border-slate-850 text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          📅 Por Dia
                        </button>
                      </div>

                      {/* Category filter pills */}
                      <div className="flex items-center gap-2 pb-1.5 border-b border-slate-850/40 overflow-x-auto select-none scrollbar-none">
                        <span className="text-[8px] font-black text-slate-550 uppercase mr-1 whitespace-nowrap">Categoria:</span>
                        {["todas", "Hospedagem", "Lazer/Passeios", ...Array.from(new Set(statementItems.map((item) => item.categoria).filter(c => c && c !== "Hospedagem" && c !== "Lazer/Passeios"))).sort()].map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setFiltroCategoria(cat)}
                            className={`px-2.5 py-1 text-[8px] uppercase font-bold rounded-full border transition-all whitespace-nowrap cursor-pointer ${
                              filtroCategoria === cat
                                ? "bg-indigo-500/20 border-indigo-400 text-indigo-300 shadow-sm"
                                : "bg-slate-950/40 border-slate-850/60 text-slate-500 hover:text-slate-355"
                            }`}
                          >
                            {cat === "todas" ? "📁 TODAS" : cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Scrollable list of statement items grouped by category */}
                    <div className="flex-1 overflow-y-auto max-h-[340px] pr-1.5 space-y-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                      {filteredStatementItems.length === 0 ? (
                        <div className="py-16 text-center text-slate-650 font-bold uppercase tracking-wider text-[9px] select-none">
                          Nenhum lançamento corresponde aos filtros
                        </div>
                      ) : (
                        Object.keys(groupedItems).map((categoria) => {
                          const items = groupedItems[categoria];
                          const totalCategoria = items.reduce((acc, it) => acc + it.valor, 0);

                          return (
                            <div key={categoria} className="space-y-2">
                              {/* Category Header */}
                              <div className="flex items-center justify-between border-b border-slate-850 pb-1.5 px-1 select-none">
                                <span className="text-[9px] font-black uppercase text-indigo-400 tracking-wider">
                                  📁 {categoria}
                                </span>
                                <span className="font-mono-tech text-slate-500 text-[8px] font-bold uppercase">
                                  Subtotal: <span className="text-slate-400">R$ {totalCategoria.toLocaleString("pt-BR")}</span>
                                </span>
                              </div>

                              {/* Items under this category */}
                              <div className="space-y-2">
                                {items.map((item) => {
                                  const isEditing = editingItemKey === item.key;

                                  if (isEditing) {
                                    return (
                                      <div
                                        key={item.key}
                                        className="bg-slate-950/90 border border-amber-500/50 p-3 rounded-xl space-y-3.5 animate-workspace-fade-in shadow-lg shadow-amber-500/5"
                                      >
                                        <div className="text-[8.5px] font-bold text-amber-500 uppercase tracking-widest border-b border-slate-900 pb-1 flex items-center justify-between">
                                          <span>📝 Editando Item ({item.tipo})</span>
                                          <span className="text-[7.5px] font-mono-tech text-slate-500">{item.key}</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                                          <div className="space-y-1">
                                            <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Descrição:</label>
                                            <input
                                              type="text"
                                              value={editNome}
                                              onChange={(e) => setEditNome(e.target.value)}
                                              className="w-full bg-slate-900 border border-slate-800 text-slate-100 px-2 py-1 placeholder-slate-755 text-[9.5px] rounded-md focus:outline-none focus:border-[#007aff] uppercase font-semibold"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Valor (R$):</label>
                                            <input
                                              type="number"
                                              value={editValor}
                                              onChange={(e) => setEditValor(e.target.value)}
                                              className="w-full bg-slate-900 border border-slate-800 text-slate-100 px-2 py-1 placeholder-slate-755 text-[9.5px] rounded-md focus:outline-none focus:border-[#007aff] font-mono-tech"
                                            />
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                                          <div className="space-y-1">
                                            <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Vínculo:</label>
                                            <select
                                              value={editVinculo}
                                              onChange={(e) => setEditVinculo(e.target.value)}
                                              className="w-full bg-slate-900 border border-slate-800 text-slate-350 px-1.5 py-1 text-[9px] rounded-md focus:outline-none cursor-pointer uppercase font-bold"
                                            >
                                              <option value="global">Geral (Sem conexão)</option>
                                              {datasViagem.map((dia, idx) => (
                                                <option key={dia} value={dia}>
                                                  Dia {String(idx + 1).padStart(2, "0")} ({dia.slice(5).replace("-", "/")})
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                          {item.tipo === "despesa" && (
                                            <div className="space-y-1">
                                              <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Categoria:</label>
                                              <select
                                                value={editCategoria}
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  setEditCategoria(val);
                                                  if (val === "Outros") {
                                                    setEditIsCustom(true);
                                                  } else {
                                                    setEditIsCustom(false);
                                                  }
                                                }}
                                                className="w-full bg-slate-900 border border-slate-800 text-slate-355 px-1.5 py-1 text-[9px] rounded-md focus:outline-none cursor-pointer uppercase font-bold"
                                              >
                                                <option value="Alimentação">Alimentação 🍽️</option>
                                                <option value="Transporte">Transporte 🚗</option>
                                                <option value="Lazer">Lazer 🪁</option>
                                                <option value="Compras">Compras 🛍️</option>
                                                <option value="Outros">Outros 💰</option>
                                              </select>
                                            </div>
                                          )}
                                        </div>

                                        {editIsCustom && item.tipo === "despesa" && (
                                          <div className="space-y-1 text-[10px] animate-fade-in">
                                            <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Nome da Categoria:</label>
                                            <input
                                              type="text"
                                              value={editCustomCategoria}
                                              onChange={(e) => setEditCustomCategoria(e.target.value)}
                                              className="w-full bg-slate-900 border border-slate-800 text-slate-100 px-2 py-1 placeholder-slate-755 text-[9.5px] rounded-md focus:outline-none focus:border-[#007aff] uppercase font-semibold"
                                            />
                                          </div>
                                        )}

                                        <div className="flex items-center justify-between pt-1 select-none">
                                          {editErro ? (
                                            <span className="text-[8px] text-rose-400 font-mono-tech font-bold">⚠️ {editErro}</span>
                                          ) : (
                                            <span />
                                          )}
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => setEditingItemKey(null)}
                                              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-850 border border-slate-850 text-slate-450 hover:text-slate-300 font-bold text-[8.5px] rounded uppercase cursor-pointer transition-colors"
                                            >
                                              Cancelar
                                            </button>
                                            <button
                                              type="button"
                                              disabled={editSalvando}
                                              onClick={() => handleSalvarEdicaoItem(item)}
                                              className="px-3 py-1 bg-[#10b981] hover:bg-emerald-500 border-0 text-slate-950 font-black text-[8.5px] rounded uppercase cursor-pointer shadow-md shadow-emerald-500/10 transition-colors disabled:opacity-40"
                                            >
                                              {editSalvando ? "Salvando..." : "Salvar"}
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }

                                  let colorBadge = "bg-slate-900 border-slate-800 text-slate-455";
                                  if (item.tipo === "hospedagem") {
                                    colorBadge = "bg-indigo-500/10 border-indigo-500/20 text-indigo-400";
                                  } else if (item.tipo === "passeio") {
                                    colorBadge = "bg-emerald-500/10 border-emerald-500/20 text-emerald-455";
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
                                          {item.diaIdx >= 0 ? (
                                            <span className="font-bold text-[#f59e0b] font-mono-tech text-[8.5px] uppercase">
                                              D{String(item.diaIdx + 1).padStart(2, "0")}
                                            </span>
                                          ) : (
                                            <span className="font-bold text-amber-500 font-mono-tech text-[8px] uppercase bg-amber-500/10 border border-amber-500/20 px-1 py-0.2 rounded">
                                              GERAL
                                            </span>
                                          )}
                                          <span className="text-slate-500 text-[9px]">|</span>
                                          <span className={`text-[8px] font-black px-1.5 py-0.2 uppercase border leading-none rounded ${colorBadge}`}>
                                            {item.tipo}
                                          </span>
                                          {item.detalhe && (
                                            <span className="text-[8px] text-slate-400 uppercase truncate max-w-[120px]" title={item.detalhe}>
                                              {item.detalhe}
                                            </span>
                                          )}
                                        </div>

                                        <div className="font-bold text-slate-200 truncate uppercase text-[10px] mt-1 tracking-wide">
                                          {item.nome}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 select-none font-sans font-semibold">
                                        <span className="text-[#10b981] font-mono-tech font-bold text-[10px] mr-1">
                                          R$ {item.valor.toLocaleString("pt-BR")}
                                        </span>
                                        <button
                                          onClick={() => {
                                            setEditingItemKey(item.key);
                                            setEditNome(item.nome);
                                            setEditValor(item.valor.toString());
                                            setEditVinculo(item.diaData);
                                            setEditCategoria(item.categoria);
                                            setEditIsCustom(!["Alimentação", "Transporte", "Lazer", "Compras", "Hospedagem", "Lazer/Passeios"].includes(item.categoria));
                                            setEditCustomCategoria(!["Alimentação", "Transporte", "Lazer", "Compras", "Hospedagem", "Lazer/Passeios"].includes(item.categoria) ? item.categoria : "");
                                            setEditErro("");
                                          }}
                                          className="w-5 h-5 flex items-center justify-center border-0 bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-400 rounded-lg transition-all text-[9.5px] cursor-pointer"
                                          title="Editar Lançamento"
                                        >
                                          ✏️
                                        </button>
                                        <button
                                          onClick={async () => {
                                            if (confirm(`Deseja excluir o lançamento "${item.nome}" definitivamente?`)) {
                                              await item.onDelete();
                                            }
                                          }}
                                          className="w-5 h-5 flex items-center justify-center border-0 bg-rose-500/10 hover:bg-rose-500/25 text-rose-500 rounded-lg transition-all text-[9.5px] cursor-pointer"
                                          title="Excluir Lançamento"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Dashboard Totalizer Footer */}
                    <div className="bg-slate-950/50 border border-slate-850 p-3.5 rounded-xl flex justify-between items-center text-[9.5px] font-mono-tech select-none">
                      <span className="text-slate-455 uppercase font-sans font-bold">Total Consolidado:</span>
                      <span className="text-[#10b981] font-black text-xs">R$ {custoTotal.toLocaleString("pt-BR")}</span>
                    </div>
                  </div>

                  {/* Progression Graph */}
                  <div className="glass-panel p-5 rounded-2xl space-y-4 flex-1 flex flex-col justify-between relative min-h-[260px] shadow-xl border border-slate-800/80">
                    <div className="absolute top-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-emerald-500 to-teal-500" />
                    <div className="flex items-center justify-between select-none">
                      <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        <span>📈 Progressão de Gastos (Somente no Dia)</span>
                      </h3>
                      <span className="text-[8px] text-slate-550 lowercase italic">clique nas barras para detalhar os itens</span>
                    </div>

                    {/* Graph Container */}
                    <div className="flex items-end gap-1.5 md:gap-2.5 h-36 pt-6 border-b border-l border-slate-800/80 px-2 relative select-none flex-1 mt-4">
                      
                      {/* Budget Limit Line based on Adjusted Budget */}
                      {orcamentoAjustado > 0 && (
                        <div className="absolute left-0 right-0 border-t border-dashed border-rose-500/40 text-[7.5px] font-black text-rose-450 uppercase tracking-widest pl-2 pt-0.5 pointer-events-none z-10 select-none" style={{ bottom: "80%" }}>
                          Teto Ajustado: R$ {orcamentoAjustado.toLocaleString("pt-BR")} ({mediaDiariaDisponivel > 0 ? `R$ ${Math.round(mediaDiariaDisponivel).toLocaleString("pt-BR")}/dia` : ""})
                        </div>
                      )}

                      {dadosGrafico.map((d, idx) => {
                        const targetLimit = orcamentoAjustado > 0 ? orcamentoAjustado : orcamento;
                        const heightPercent = targetLimit > 0 ? Math.min(100, Math.round((d.acumulado / targetLimit) * 80)) : 0;
                        const isOver = targetLimit > 0 && d.acumulado > targetLimit;
                        const isSelected = selectedGraphDay === d.diaData;

                        return (
                          <div
                            key={d.diaData}
                            onClick={() => setSelectedGraphDay(isSelected ? null : d.diaData)}
                            className="flex-1 flex flex-col items-center group/bar relative cursor-pointer"
                          >
                            {/* Hover tooltip */}
                            <div className="absolute bottom-full mb-2 bg-slate-950 border border-indigo-500/50 text-[8.5px] p-2 rounded shadow-2xl hidden group-hover/bar:flex flex-col text-center w-24 pointer-events-none z-50 transition-all font-sans font-semibold">
                              <span className="text-amber-500 uppercase tracking-wider">{d.diaLabel}</span>
                              <span className="text-slate-400 font-mono-tech mt-0.5 text-[8px]">{d.diaData.slice(5).replace("-", "/")}</span>
                              <span className="text-indigo-400 font-mono-tech mt-1">Dia: R$ {d.custoDia}</span>
                              <span className="text-[#10b981] font-mono-tech">Acum: R$ {d.acumulado}</span>
                            </div>

                            {/* Bar Graph */}
                            <div className={`w-full bg-slate-950/50 rounded-t h-24 flex flex-col justify-end relative shadow-inner overflow-hidden border transition-all ${
                              isSelected ? "border-amber-500 scale-[1.03] shadow-[0_0_8px_rgba(245,158,11,0.2)]" : "border-slate-900 hover:border-slate-700"
                            }`}>
                              <div
                                style={{ height: `${heightPercent}%` }}
                                className={`w-full rounded-t transition-all duration-300 ${isOver
                                    ? "bg-gradient-to-t from-rose-600 to-rose-450 shadow-[0_0_6px_rgba(244,63,94,0.3)]"
                                    : d.acumulado > targetLimit * 0.8
                                      ? "bg-gradient-to-t from-amber-600 to-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.3)]"
                                      : "bg-gradient-to-t from-indigo-600 to-indigo-455 shadow-[0_0_6px_rgba(99,102,241,0.3)]"
                                  }`}
                              />
                            </div>

                            {/* Label */}
                            <span className={`text-[8.5px] font-mono-tech font-bold mt-1.5 uppercase select-none transition-colors ${
                              isSelected ? "text-amber-500 font-extrabold" : "text-slate-500 group-hover/bar:text-slate-300"
                            }`}>
                              D{String(idx + 1).padStart(2, "0")}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Breakdown Panel for the Selected Graph Day */}
                    {selectedGraphDay && (() => {
                      const dayItems = statementItems.filter(item => item.diaData === selectedGraphDay);
                      const dayTotal = dayItems.reduce((acc, it) => acc + it.valor, 0);
                      const activeDiaIndex = datasViagem.indexOf(selectedGraphDay);

                      return (
                        <div className="bg-slate-950/80 border border-indigo-500/35 rounded-xl p-3.5 space-y-3 animate-workspace-fade-in shadow-lg shadow-indigo-500/5 select-none mt-2">
                          <div className="flex items-center justify-between border-b border-slate-900 pb-1.5">
                            <span className="text-[9px] font-black uppercase text-indigo-400 tracking-wider">
                              🔍 Detalhamento: Dia {activeDiaIndex + 1} ({selectedGraphDay.slice(5).replace("-", "/")})
                            </span>
                            <span className="font-mono-tech text-slate-350 text-[8.5px] font-bold">
                              Subtotal do Dia: <span className="text-[#10b981]">R$ {dayTotal.toLocaleString("pt-BR")}</span>
                            </span>
                          </div>

                          <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-900 scrollbar-track-transparent">
                            {dayItems.length === 0 ? (
                              <div className="py-4 text-center text-slate-650 font-bold uppercase text-[7.5px] tracking-wider animate-pulse">
                                Nenhuma despesa ou hotel vinculado a este dia.
                              </div>
                            ) : (
                              dayItems.map(item => (
                                <div
                                  key={`detail-${item.key}`}
                                  className="bg-slate-900/60 border border-slate-850 p-2 flex items-center justify-between gap-3.5 rounded-lg text-[9px] hover:border-slate-800 transition-colors"
                                >
                                  <div className="flex-1 min-w-0 flex items-center gap-2">
                                    <span className="px-1.5 py-0.2 uppercase border text-[7.5px] font-black leading-none rounded bg-slate-950 border-slate-850 text-slate-500">
                                      {item.tipo}
                                    </span>
                                    <span className="font-bold text-slate-200 truncate uppercase mt-0.5">
                                      {item.nome}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 select-none shrink-0 font-sans font-semibold">
                                    <span className="text-slate-300 font-mono-tech font-bold text-[9.5px]">
                                      R$ {item.valor.toLocaleString("pt-BR")}
                                    </span>
                                    <button
                                      onClick={() => {
                                        setEditingItemKey(item.key);
                                        setEditNome(item.nome);
                                        setEditValor(item.valor.toString());
                                        setEditVinculo(item.diaData);
                                        setEditCategoria(item.categoria);
                                        setEditIsCustom(!["Alimentação", "Transporte", "Lazer", "Compras", "Hospedagem", "Lazer/Passeios"].includes(item.categoria));
                                        setEditCustomCategoria(!["Alimentação", "Transporte", "Lazer", "Compras", "Hospedagem", "Lazer/Passeios"].includes(item.categoria) ? item.categoria : "");
                                        setEditErro("");
                                      }}
                                      className="text-indigo-400 hover:text-indigo-350 bg-transparent border-0 cursor-pointer text-[10px] px-1 py-0.5 rounded transition-all"
                                      title="Editar Lançamento"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (confirm(`Deseja excluir o lançamento "${item.nome}" definitivamente?`)) {
                                          await item.onDelete();
                                        }
                                      }}
                                      className="text-rose-500 hover:text-rose-455 bg-transparent border-0 cursor-pointer text-[10px] px-1 py-0.5 rounded transition-all"
                                      title="Excluir Lançamento"
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
                    })()}
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
                orcamentoMaximo={viagemAtiva?.orcamento_maximo || 0}
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
                  destino={viagemAtiva?.destino || ""}
                  viagemAtiva={viagemAtiva}
                  diaAtivoWorkspace={diaAtivoWorkspace}
                  isModoFoco={isModoFoco}
                  onSalvarCronogramaInline={handleSalvarCronogramaInline}
                  viajantes={viagemAtiva?.viajantes || []}
                  usuarioAtualId={user?.uid || "operator-01"}
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
                orcamentoMaximo={viagemAtiva?.orcamento_maximo || 0}
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
                  viagemDestino={viagemAtiva?.destino || ""}
                  viajantes={viagemAtiva?.viajantes || []}
                  usuarioAtualId={user?.uid || "operator-01"}
                />
              </div>
            </div>
          )}

          {/* =======================================
              ABA 3.5: Checklist de Bagagem (Luggage Helper)
              ======================================= */}
          {activeTab === "checklist" && (
            <div className="space-y-4 flex-1 flex flex-col min-h-0">
              <PackingChecklist viagemId={viagemAtiva?.id || ""} />
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

      {/* Mobile Bottom Navigation (inspired by Image 5) */}
      {viagemAtiva && (
        <div className="lg:hidden fixed bottom-5 left-4 right-4 z-[999] glass-panel rounded-2xl p-2.5 flex justify-between items-center shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-slate-800/80 gap-0.5">
          <button
            onClick={() => setActiveTab("visao-geral")}
            className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all duration-200 cursor-pointer ${
              activeTab === "visao-geral" ? "active-bottom-tab-capsule text-white scale-105" : "text-slate-500 hover:text-slate-355"
            }`}
          >
            <span className="text-base select-none">📊</span>
            <span className="text-[7.5px] font-black uppercase tracking-wider mt-1">Visão</span>
          </button>
          <button
            onClick={() => setActiveTab("financas")}
            className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all duration-200 cursor-pointer ${
              activeTab === "financas" ? "active-bottom-tab-capsule text-white scale-105" : "text-slate-500 hover:text-slate-355"
            }`}
          >
            <span className="text-base select-none">💸</span>
            <span className="text-[7.5px] font-black uppercase tracking-wider mt-1">Gastos</span>
          </button>
          <button
            onClick={() => setActiveTab("cronograma")}
            className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all duration-200 cursor-pointer ${
              activeTab === "cronograma" ? "active-bottom-tab-capsule text-white scale-105" : "text-slate-500 hover:text-slate-355"
            }`}
          >
            <span className="text-base select-none">📅</span>
            <span className="text-[7.5px] font-black uppercase tracking-wider mt-1">Agenda</span>
          </button>
          <button
            onClick={() => setActiveTab("banco")}
            className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all duration-200 cursor-pointer ${
              activeTab === "banco" ? "active-bottom-tab-capsule text-white scale-105" : "text-slate-500 hover:text-slate-355"
            }`}
          >
            <span className="text-base select-none">🛍️</span>
            <span className="text-[7.5px] font-black uppercase tracking-wider mt-1">Alocar</span>
          </button>
          <button
            onClick={() => setActiveTab("checklist")}
            className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all duration-200 cursor-pointer ${
              activeTab === "checklist" ? "active-bottom-tab-capsule text-white scale-105" : "text-slate-500 hover:text-slate-355"
            }`}
          >
            <span className="text-base select-none">🎒</span>
            <span className="text-[7.5px] font-black uppercase tracking-wider mt-1">Malas</span>
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all duration-200 cursor-pointer ${
              activeTab === "logs" ? "active-bottom-tab-capsule text-white scale-105" : "text-slate-500 hover:text-slate-355"
            }`}
          >
            <span className="text-base select-none">📋</span>
            <span className="text-[7.5px] font-black uppercase tracking-wider mt-1">Logs</span>
          </button>
        </div>
      )}

      {/* Modal de Detalhes dos KPIs (Acessibilidade e Resumo) */}
      {activeKpiModal && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[999] flex items-center justify-center p-4"
          onClick={() => setActiveKpiModal(null)}
        >
          <div 
            className="relative w-full max-w-lg glass-panel p-6 rounded-2xl overflow-hidden space-y-4 shadow-2xl border border-slate-800 bg-[#130d20] animate-workspace-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-purple-600 via-indigo-500 to-blue-500" />
            
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-850">
              <h3 className="text-xs font-black uppercase text-slate-100 tracking-wider flex items-center gap-2">
                {activeKpiModal === "teto" && (
                  <>
                    <span>🔑</span>
                    <span>Resumo: Teto Orçamentário</span>
                  </>
                )}
                {activeKpiModal === "consumo" && (
                  <>
                    <span>⚡</span>
                    <span>Resumo: Consumo Consolidado</span>
                  </>
                )}
                {activeKpiModal === "saldo" && (
                  <>
                    <span>❤️</span>
                    <span>Resumo: Saldo Financeiro</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setActiveKpiModal(null)}
                className="w-6 h-6 flex items-center justify-center bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-slate-100 rounded-lg text-[9px] cursor-pointer transition-colors"
                title="Fechar detalhes"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 text-xs">
              {activeKpiModal === "teto" && (
                <>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    O valor máximo planejado para a realização desta viagem. Serve como limite de gastos recomendado.
                  </p>
                  <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-xl space-y-3 font-mono-tech">
                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-550 font-sans font-bold uppercase">Teto Total Definido:</span>
                      <span className="text-slate-200 font-black">R$ {orcamento.toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-550 font-sans font-bold uppercase">Duração da Viagem:</span>
                      <span className="text-slate-200 font-black">{datasViagem.length} Dias</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-550 font-sans font-bold uppercase">Gasto Recomendado por Dia:</span>
                      <span className="text-indigo-400 font-black">
                        R$ {(datasViagem.length > 0 ? Math.round(orcamento / datasViagem.length) : 0).toLocaleString("pt-BR")} / dia
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-550 font-sans font-bold uppercase">Limite de Alerta (80%):</span>
                      <span className="text-amber-500 font-black">R$ {Math.round(orcamento * 0.8).toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                </>
              )}

              {activeKpiModal === "consumo" && (
                <>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    O montante de todos os valores injetados no roteiro, categorizado em acomodações, passeios e despesas gerais.
                  </p>
                  <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-xl space-y-3 font-mono-tech">
                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-550 font-sans font-bold uppercase">Consumo Total:</span>
                      <span className={`font-black ${ultrapassou ? "text-rose-400" : "text-[#6ee8f8]"}`}>
                        R$ {custoTotal.toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-550 font-sans font-bold uppercase">Acomodação (Hotéis):</span>
                      <span className="text-indigo-300 font-black">
                        R$ {totalHospedagem.toLocaleString("pt-BR")} ({percentualHospedagem}%)
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-550 font-sans font-bold uppercase">Lazer & Passeios:</span>
                      <span className="text-emerald-400 font-black">
                        R$ {totalPasseios.toLocaleString("pt-BR")} ({percentualPasseios}%)
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-550 font-sans font-bold uppercase">Despesas Gerais/Extras:</span>
                      <span className="text-amber-500 font-black">
                        R$ {totalDespesas.toLocaleString("pt-BR")} ({percentualDespesas}%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-550 font-sans font-bold uppercase">Total de Itens Inseridos:</span>
                      <span className="text-slate-200 font-black">{todasDespesas.length + datasViagem.filter(d => roteiroDiario[d]?.hospedagem).length + datasViagem.reduce((acc, d) => acc + (roteiroDiario[d]?.atividades?.length || 0), 0)} itens</span>
                    </div>
                  </div>
                </>
              )}

              {activeKpiModal === "saldo" && (
                <>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    A diferença entre o teto planejado e os gastos totais realizados até o momento.
                  </p>
                  <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-xl space-y-3 font-mono-tech">
                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-550 font-sans font-bold uppercase">Saldo Financeiro:</span>
                      <span className={`font-black ${saldo < 0 ? "text-rose-400" : "text-emerald-450"}`}>
                        R$ {saldo.toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-550 font-sans font-bold uppercase">Situação Geral:</span>
                      <span className={`font-black uppercase text-[10px] ${saldo < 0 ? "text-rose-400" : "text-emerald-450"}`}>
                        {saldo < 0 ? "⚠️ Orçamento Excedido" : "✅ Dentro do Orçamento"}
                      </span>
                    </div>
                    {saldo > 0 && datasViagem.length > 0 && (
                      <div className="flex justify-between border-b border-slate-900 pb-1.5">
                        <span className="text-slate-550 font-sans font-bold uppercase">Disponível por Dia Restante:</span>
                        <span className="text-[#6ee8f8] font-black">
                          R$ {Math.round(saldo / datasViagem.length).toLocaleString("pt-BR")} / dia
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-550 font-sans font-bold uppercase">Porcentagem Utilizada:</span>
                      <span className="text-slate-200 font-black">{percentualConsumido}% do teto</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-1 select-none">
              <button
                onClick={() => setActiveKpiModal(null)}
                className="px-4 py-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-bold text-[9px] rounded-lg uppercase cursor-pointer border-0 shadow-md transition-all active:scale-95"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}

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