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
  Despesa,
  emitLog,
  subscribeToLogs,
} from "@/services/travelService";

import TripForm from "@/components/TripForm";
import SideAList from "@/components/SideAList";
import SideBItinerary from "@/components/SideBItinerary";
import IndustrialLog from "@/components/IndustrialLog";
import TimelineCompact from "@/components/TimelineCompact";

// Firebase Imports
import { db, isFirebaseConfigured, auth } from "@/lib/firebase";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from "firebase/auth";
import { onSnapshot, query, collection, orderBy, doc, updateDoc, deleteDoc, setDoc, getDocs } from "firebase/firestore";

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

  // Estados de Autenticação
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Estados para o Workspace Focado (Redesenho UX Premium)
  const [diaAtivoWorkspace, setDiaAtivoWorkspace] = useState<string | null>(null);
  const [isModoFoco, setIsModoFoco] = useState(true);

  // Controle de Abas no Sidebar
  const [activeTab, setActiveTab] = useState<"visao-geral" | "financas" | "cronograma" | "banco" | "logs">("visao-geral");

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
      setDatasViagem([]);
      setDiaAtivoWorkspace(null);
      setRoteiroDiario({});
    } catch (err) {
      console.error(err);
      emitLog("AUTH ERROR: Falha ao efetuar logout.");
    }
  };

  // Salva o cronograma horário inline diretamente do Sidebar sem modal
  const handleSalvarCronogramaInline = async (dataDia: string, cronograma: Record<string, string>) => {
    if (!viagemAtiva) return;
    try {
      await atualizarCronogramaHorario(viagemAtiva.id, dataDia, cronograma);
      emitLog(`SYSTEM: Cronograma do dia ${dataDia} atualizado no banco.`);
    } catch (err) {
      console.error("Erro ao salvar cronograma inline:", err);
      emitLog("SYSTEM ERROR: Falha ao sincronizar o cronograma de horários.");
    }
  };

  // Carrega todas as viagens salvas (usado como fallback local ou inicialização)
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

  // 1. Escuta Viagens em tempo real (Filtra por proprietário no cliente para máxima resiliência)
  useEffect(() => {
    if (isFirebaseConfigured && db) {
      emitLog("FIRESTORE: Conectando escuta em tempo real da coleção 'viagens'...");
      const q = query(collection(db, "viagens"), orderBy("criado_em", "desc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const currentUser = auth.currentUser;
        const userId = currentUser ? currentUser.uid : "operator-01";
        
        const list = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            usuario_id: data.usuario_id || "operator-01",
            origem: data.origem || data.origen || "Não informada",
            destino: data.destino || "Não informado",
            data_inicio: data.data_inicio,
            data_fim: data.data_fim,
            criado_em: data.criado_em,
            orcamento_maximo: Number(data.orcamento_maximo ?? data.orcamento) || 0,
          } as Viagem;
        }).filter(v => v.usuario_id === userId);
        
        setViagens(list);
        emitLog(`FIRESTORE: ${list.length} viagens hidratadas reativamente.`);
      }, (err) => {
        console.error("Erro ao escutar viagens:", err);
        emitLog("FIRESTORE ERROR: Falha na escuta de viagens em tempo real.");
      });
      return () => unsubscribe();
    } else {
      carregarDadosViagens();
    }
  }, [user, carregarDadosViagens]);

  // 2. Escuta Roteiros diários em tempo real (Hospedagem, Atividades, Cronogramas e Despesas)
  useEffect(() => {
    if (!viagemAtiva) {
      setRoteiroDiario({});
      return;
    }

    if (isFirebaseConfigured && db) {
      emitLog(`FIRESTORE: Conectando ouvintes em tempo real para subcoleções do Roteiro ID [${viagemAtiva.id}]...`);
      const unsubscribes: (() => void)[] = [];

      const hoteisRef = collection(db, "viagens", viagemAtiva.id, "hoteis");
      const passeiosRef = collection(db, "viagens", viagemAtiva.id, "passeios");
      const roteirosRef = collection(db, "viagens", viagemAtiva.id, "roteiros");
      const despesasRef = collection(db, "viagens", viagemAtiva.id, "despesas");

      // Buffers locais
      let localHoteis: Record<string, Hospedagem> = {};
      let localPasseios: Record<string, Atividade[]> = {};
      let localRoteiros: Record<string, Record<string, string>> = {};
      let localDespesas: Record<string, Despesa[]> = {};

      const combinarRoteiroReativo = () => {
        const novoRoteiro: Record<string, RoteiroDiario> = {};
        
        // Inicializa todas as datas do período de viagem e a chave global
        datasViagem.forEach((dia) => {
          novoRoteiro[dia] = { hospedagem: null, atividades: [], despesas: [], cronograma_horario: {} };
        });
        novoRoteiro["global"] = { hospedagem: null, atividades: [], despesas: [], cronograma_horario: {} };

        // Preenche hotéis
        Object.keys(localHoteis).forEach((diaId) => {
          if (novoRoteiro[diaId]) {
             novoRoteiro[diaId].hospedagem = localHoteis[diaId];
          }
        });

        // Preenche passeios
        Object.keys(localPasseios).forEach((diaId) => {
          if (novoRoteiro[diaId]) {
             novoRoteiro[diaId].atividades = localPasseios[diaId];
          }
        });

        // Preenche cronogramas/roteiros
        Object.keys(localRoteiros).forEach((diaId) => {
          if (novoRoteiro[diaId]) {
             novoRoteiro[diaId].cronograma_horario = localRoteiros[diaId];
          }
        });

        // Preenche despesas
        Object.keys(localDespesas).forEach((diaId) => {
          if (novoRoteiro[diaId]) {
             novoRoteiro[diaId].despesas = localDespesas[diaId];
          }
        });

        setRoteiroDiario(novoRoteiro);
      };

      // A. Ouvinte de Hotéis
      unsubscribes.push(onSnapshot(hoteisRef, (snap) => {
        localHoteis = {};
        snap.docs.forEach((doc) => {
          const data = doc.data();
          localHoteis[doc.id] = {
            nome: data.nome || "",
            preco_diario: Number(data.preco_diario) || 0,
            link: data.link || ""
          };
        });
        combinarRoteiroReativo();
      }));

      // B. Ouvinte de Passeios/Atividades
      unsubscribes.push(onSnapshot(passeiosRef, (snap) => {
        const tempPasseios: Record<string, Array<Atividade & { criado_em?: { seconds?: number; nanoseconds?: number } | null }>> = {};
        snap.docs.forEach((doc) => {
          const data = doc.data();
          const diaId = data.diaId;
          if (diaId) {
            if (!tempPasseios[diaId]) tempPasseios[diaId] = [];
            tempPasseios[diaId].push({
              id: doc.id,
              nome: data.nome || "",
              valor: Number(data.valor) || 0,
              link: data.link || "",
              criado_em: data.criado_em
            });
          }
        });
        
        localPasseios = {};
        Object.keys(tempPasseios).forEach((diaId) => {
          localPasseios[diaId] = tempPasseios[diaId].sort((a, b) => {
            const tA = a.criado_em?.seconds || 0;
            const tB = b.criado_em?.seconds || 0;
            return tA - tB;
          }).map(p => ({
            id: p.id,
            nome: p.nome,
            valor: p.valor,
            link: p.link
          }));
        });
        combinarRoteiroReativo();
      }));

      // C. Ouvinte de Roteiros/Cronograma de Horas
      unsubscribes.push(onSnapshot(roteirosRef, (snap) => {
        localRoteiros = {};
        snap.docs.forEach((doc) => {
          const data = doc.data();
          localRoteiros[doc.id] = (data.cronograma_horario as Record<string, string>) || {};
        });
        combinarRoteiroReativo();
      }));

      // D. Ouvinte de Despesas Extras
      unsubscribes.push(onSnapshot(despesasRef, (snap) => {
        const tempDespesas: Record<string, Array<Despesa & { criado_em?: { seconds?: number; nanoseconds?: number } | null }>> = {};
        snap.docs.forEach((doc) => {
          const data = doc.data();
          const diaId = data.diaId;
          if (diaId) {
            if (!tempDespesas[diaId]) tempDespesas[diaId] = [];
            tempDespesas[diaId].push({
              id: doc.id,
              diaId: data.diaId,
              nome: data.nome || "",
              valor: Number(data.valor) || 0,
              categoria: data.categoria || "Outros",
              criado_em: data.criado_em
            });
          }
        });

        localDespesas = {};
        Object.keys(tempDespesas).forEach((diaId) => {
          localDespesas[diaId] = tempDespesas[diaId].sort((a, b) => {
            const tA = a.criado_em?.seconds || 0;
            const tB = b.criado_em?.seconds || 0;
            return tA - tB;
          }).map(d => ({
            id: d.id,
            diaId: d.diaId,
            nome: d.nome,
            valor: d.valor,
            categoria: d.categoria
          }));
        });
        combinarRoteiroReativo();
      }));

      return () => {
        unsubscribes.forEach((u) => u());
      };
    } else {
      // Fallback estático de LocalStorage
      const raw = localStorage.getItem(`chilinho_itinerary_${viagemAtiva.id}`);
      if (raw) {
        setRoteiroDiario(JSON.parse(raw));
      }
    }
  }, [viagemAtiva, datasViagem]);


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
      setActiveTab("visao-geral"); // Reseta para a visão geral ao focar
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

          <div className="flex items-center gap-3.5 flex-wrap">
            {/* Bloco de Auth no Header */}
            {isAuthLoading ? (
              <div className="flex items-center gap-1.5 bg-slate-950/50 px-4 py-2 border border-slate-800/80 rounded-xl h-10 shadow-inner text-[10px] text-slate-500 font-mono-tech font-bold">
                Carregando...
              </div>
            ) : user ? (
              <div className="flex items-center gap-3 bg-slate-950/50 px-4 py-2 border border-slate-800/80 rounded-xl h-10 shadow-inner">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Foto" className="w-5 h-5 rounded-full border border-indigo-500/40" />
                ) : (
                  <span className="w-5 h-5 flex items-center justify-center bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full font-bold text-[9px]">👤</span>
                )}
                <span className="text-slate-200 font-mono-tech text-[10px] font-bold uppercase truncate max-w-[120px]" title={user.email || ""}>
                  {user.displayName || user.email}
                </span>
                <span className="text-slate-800">|</span>
                <button
                  onClick={handleLogout}
                  className="bg-transparent hover:text-rose-400 text-slate-450 text-[10px] font-bold uppercase border-0 cursor-pointer transition-colors"
                >
                  Sair
                </button>
              </div>
            ) : (
              <button
                onClick={handleLoginGoogle}
                className="h-10 px-4 flex items-center gap-2 font-black tracking-wide uppercase transition-all bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-lg shadow-indigo-500/10 cursor-pointer rounded-xl text-[10px] border-0"
              >
                🔑 Entrar com Google
              </button>
            )}

            <div className="flex items-center space-x-3.5 font-mono-tech text-[10px] bg-slate-950/50 px-4 py-2 border border-slate-800/80 rounded-xl h-10 shadow-inner">
              <div className="flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full led-green animate-pulse" />
                <span className="text-[#10b981] font-bold">CONECTADO</span>
              </div>
              <span className="text-slate-800">|</span>
              <span className="text-slate-450">DATA: 2026-05-30</span>
            </div>
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

  // Somar despesas gerais/globais
  const despesasGlobais = roteiroDiario["global"]?.despesas || [];
  const totalDespesasGlobais = despesasGlobais.reduce((acc, exp) => acc + exp.valor, 0);
  totalDespesas += totalDespesasGlobais;

  const custoTotal = totalHospedagem + totalPasseios + totalDespesas;
  const orcamento = viagemAtiva.orcamento_maximo || 0;
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
    <div className="flex flex-col min-h-screen p-4 md:p-6 space-y-4 max-w-7xl mx-auto relative selection:bg-indigo-500/30">
      {/* Mesh Glowing Blobs no background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10 select-none rounded-3xl">
        <div className="glass-blob animate-drift-1 bg-indigo-600/10 w-[500px] h-[500px] -top-40 -left-40" />
        <div className="glass-blob animate-drift-2 bg-emerald-500/5 w-[600px] h-[600px] top-[40%] -right-40" />
      </div>

      {/* Grid Principal Dividida: Sidebar e Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch flex-1">
        
        {/* COLUNA 1: SIDEBAR LATERAL DE CONTROLE */}
        <aside className="hidden lg:flex lg:col-span-3 flex-col justify-between glass-panel p-5 rounded-2xl relative overflow-hidden h-fit lg:h-[calc(100vh-3rem)] sticky lg:top-6 select-none">
          <div className="absolute top-0 left-0 w-full h-[3px] hazard-stripes" />
          
          <div className="space-y-5">
            {/* Botão de Retorno Central */}
            <button
              onClick={() => setViagemAtiva(null)}
              className="w-full h-10 px-4 flex items-center justify-center font-bold tracking-widest uppercase transition-all bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 cursor-pointer rounded-xl text-[9px] hover:scale-[1.01] active:scale-[0.99] shadow-inner"
            >
              Voltar para a Central
            </button>

            {/* Info Rota Compact Box */}
            <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl text-center space-y-2 shadow-inner">
              <span className="text-[8px] font-bold font-mono-tech text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded uppercase">
                Workspace Ativo
              </span>
              <h2 className="text-xs font-black text-slate-100 uppercase tracking-wide truncate pt-1 font-heading">
                {viagemAtiva.destino.replace(/ \(.*\)/, "")}
              </h2>
              <p className="text-[9.5px] font-mono-tech text-slate-400 font-semibold">
                {viagemAtiva.data_inicio} até {viagemAtiva.data_fim}
              </p>
              <div className="text-[8.5px] font-mono-tech text-slate-650 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-900 truncate shadow-inner">
                REG: {viagemAtiva.id}
              </div>
            </div>

            {/* Bloco de Auth no Sidebar */}
            {isAuthLoading ? (
              <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl text-center text-[8.5px] font-mono-tech text-slate-500 font-bold uppercase tracking-wider">
                Verificando Conta...
              </div>
            ) : user ? (
              <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl flex items-center justify-between gap-2.5 shadow-inner">
                <div className="flex items-center gap-2.5 min-w-0">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Foto" className="w-6 h-6 rounded-full border border-indigo-500/40" />
                  ) : (
                    <span className="w-6 h-6 flex items-center justify-center bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full font-bold text-[9px]">👤</span>
                  )}
                  <div className="min-w-0 flex flex-col">
                    <span className="text-slate-200 font-bold text-[9.5px] uppercase truncate tracking-wide leading-tight">
                      {user.displayName || "Usuário"}
                    </span>
                    <span className="text-slate-500 font-mono-tech text-[8px] truncate leading-none mt-0.5">
                      {user.email}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-transparent hover:text-rose-450 text-slate-450 font-bold text-[9px] uppercase border-0 cursor-pointer transition-colors"
                  title="Sair da Conta"
                >
                  Sair
                </button>
              </div>
            ) : (
              <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl flex flex-col gap-2 text-center shadow-inner">
                <span className="text-[8.5px] font-mono-tech text-slate-500 uppercase tracking-wider font-bold">Acesso Restrito</span>
                <button
                  onClick={handleLoginGoogle}
                  className="w-full py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-[9.5px] uppercase transition-all rounded-lg cursor-pointer border-0 shadow-md active:scale-95"
                >
                  🔑 Entrar com Google
                </button>
              </div>
            )}

            {/* Navegador de Abas */}
            <nav className="flex flex-col space-y-2.5">
              <button
                onClick={() => setActiveTab("visao-geral")}
                className={`h-11 px-4.5 flex items-center justify-between font-bold text-[10px] uppercase transition-all border rounded-xl cursor-pointer ${
                  activeTab === "visao-geral"
                    ? "active-sidebar-capsule font-black"
                    : "bg-slate-950/40 border-slate-850 hover:border-slate-800 text-slate-450 hover:text-slate-200 hover:bg-slate-950/60"
                }`}
              >
                <span>📊 Visão Geral</span>
                <span className={`w-1.5 h-1.5 rounded-full ${activeTab === "visao-geral" ? "bg-white led-blue animate-pulse" : "bg-slate-800"}`} />
              </button>

              <button
                onClick={() => setActiveTab("financas")}
                className={`h-11 px-4.5 flex items-center justify-between font-bold text-[10px] uppercase transition-all border rounded-xl cursor-pointer ${
                  activeTab === "financas"
                    ? "active-sidebar-capsule font-black"
                    : "bg-slate-950/40 border-slate-850 hover:border-slate-800 text-slate-450 hover:text-slate-200 hover:bg-slate-950/60"
                }`}
              >
                <span>💸 Finanças</span>
                <span className={`w-1.5 h-1.5 rounded-full ${activeTab === "financas" ? "bg-white led-blue animate-pulse" : "bg-slate-800"}`} />
              </button>

              <button
                onClick={() => setActiveTab("cronograma")}
                className={`h-11 px-4.5 flex items-center justify-between font-bold text-[10px] uppercase transition-all border rounded-xl cursor-pointer ${
                  activeTab === "cronograma"
                    ? "active-sidebar-capsule font-black"
                    : "bg-slate-950/40 border-slate-850 hover:border-slate-800 text-slate-450 hover:text-slate-200 hover:bg-slate-950/60"
                }`}
              >
                <span>📅 Cronograma Diário</span>
                <span className={`w-1.5 h-1.5 rounded-full ${activeTab === "cronograma" ? "bg-white led-blue animate-pulse" : "bg-slate-800"}`} />
              </button>

              <button
                onClick={() => setActiveTab("banco")}
                className={`h-11 px-4.5 flex items-center justify-between font-bold text-[10px] uppercase transition-all border rounded-xl cursor-pointer ${
                  activeTab === "banco"
                    ? "active-sidebar-capsule font-black"
                    : "bg-slate-950/40 border-slate-850 hover:border-slate-800 text-slate-450 hover:text-slate-200 hover:bg-slate-950/60"
                }`}
              >
                <span>🛍️ Banco de Alocações</span>
                <span className={`w-1.5 h-1.5 rounded-full ${activeTab === "banco" ? "bg-white led-blue animate-pulse" : "bg-slate-800"}`} />
              </button>

              <button
                onClick={() => setActiveTab("logs")}
                className={`h-11 px-4.5 flex items-center justify-between font-bold text-[10px] uppercase transition-all border rounded-xl cursor-pointer ${
                  activeTab === "logs"
                    ? "active-sidebar-capsule font-black"
                    : "bg-slate-950/40 border-slate-850 hover:border-slate-800 text-slate-450 hover:text-slate-200 hover:bg-slate-950/60"
                }`}
              >
                <span>📋 Logs do Terminal</span>
                <span className={`w-1.5 h-1.5 rounded-full ${activeTab === "logs" ? "bg-white led-blue animate-pulse" : "bg-slate-800"}`} />
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
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-750 text-slate-450 hover:text-slate-200 transition-colors uppercase font-bold text-[9px] rounded-lg cursor-pointer shadow-sm active:scale-95"
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

            {/* Time/Status indicator - Redesenhado como na Imagem 2 */}
            <div className="bg-slate-950/50 border border-slate-850 rounded-xl p-2.5 flex items-center justify-between font-mono-tech text-[8px] select-none shadow-inner">
              <div className="flex items-center gap-1.5 font-bold">
                <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full led-green animate-pulse" />
                <span className="text-[#10b981]">ONLINE</span>
              </div>
              <span className="text-slate-800">|</span>
              <span className="text-slate-400 font-bold uppercase tracking-wider">STABLE</span>
              <span className="text-slate-800">|</span>
              <span className="text-slate-500">SYS: 2026-05-30</span>
            </div>
          </div>
        </aside>

        {/* COLUNA 2: WORKSPACE DE CONTEÚDO ATIVO */}
        <main className="lg:col-span-9 flex flex-col space-y-4 min-h-0 workspace-fade-in pb-24 lg:pb-0">
          
          {/* Header de Acompanhamento no Workspace - Premium Status Node */}
          <header className="w-full glass-panel p-4.5 flex items-center justify-between gap-4 relative overflow-hidden rounded-2xl select-none shadow-xl border border-slate-800/80">
            <div className="absolute top-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-blue-500 to-indigo-600" />
            <div className="flex items-center space-x-3.5">
              <button
                onClick={() => setViagemAtiva(null)}
                className="lg:hidden w-8 h-8 flex items-center justify-center bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-350 hover:text-slate-100 rounded-xl text-xs transition-colors cursor-pointer shadow-inner"
                title="Voltar para a Central"
              >
                ◀
              </button>
              <div>
                <h1 className="text-xs font-black tracking-wider text-slate-100 uppercase font-heading leading-tight pt-0.5">
                  {viagemAtiva.destino.replace(/ \(.*\)/, "")}
                </h1>
                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider font-mono-tech mt-0.5">
                  ROTA DE PLANEJAMENTO ATIVA
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 font-mono-tech text-[8px] select-none">
              <div className="flex items-center space-x-1.5 bg-slate-950/60 px-3 py-1.5 border border-slate-850 rounded-xl shadow-inner font-bold">
                <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full led-green animate-pulse" />
                <span className="text-[#10b981]">ONLINE</span>
                <span className="text-slate-800">|</span>
                <span className="text-slate-400">STABLE</span>
              </div>
            </div>
          </header>

              {/* =======================================
              ABA 1: Visão Geral
              ======================================= */}
          {activeTab === "visao-geral" && (
            <div className="space-y-5 flex-1 flex flex-col min-h-0">
              {/* KPIs de Orçamento Redesenhados de forma Ultra Premium */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full select-none">
                {/* KPI Orçamento Máximo */}
                <div className="glass-panel p-4.5 rounded-2xl relative overflow-hidden transition-all duration-300 hover:scale-[1.015] border border-slate-800/80 shadow-md flex items-center justify-between">
                  <div>
                    <div className="text-[9px] font-mono-tech text-slate-500 uppercase tracking-widest">Teto Orçamentário</div>
                    <div className="text-sm font-black text-slate-100 mt-1 font-heading">
                      R$ {orcamento.toLocaleString("pt-BR")}
                    </div>
                    <div className="text-[8.5px] text-slate-500 font-semibold mt-1.5 uppercase font-mono-tech leading-none">
                      definido pelo planejamento
                    </div>
                  </div>
                  <div className="text-2xl text-slate-600 bg-slate-950/45 p-2.5 rounded-xl border border-slate-850 shadow-inner select-none">
                    🔑
                  </div>
                </div>

                {/* KPI Consumido */}
                <div className={`glass-panel p-4.5 rounded-2xl relative overflow-hidden transition-all duration-300 hover:scale-[1.015] border ${financialGlowClass} flex items-center justify-between`}>
                  <div>
                    <div className="text-[9px] font-mono-tech text-slate-500 uppercase tracking-widest">Consumo Consolidado</div>
                    <div className={`text-sm font-black mt-1 font-heading ${ultrapassou ? "text-rose-400" : "text-[#10b981]"}`}>
                      R$ {custoTotal.toLocaleString("pt-BR")}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 select-none leading-none">
                      <span className={`text-[8.5px] font-bold uppercase tracking-wider ${ultrapassou ? "text-rose-400 animate-pulse" : "text-[#10b981]"}`}>
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
                <div className="glass-panel p-4.5 rounded-2xl relative overflow-hidden transition-all duration-300 hover:scale-[1.015] border border-slate-800/80 shadow-md flex items-center justify-between">
                  <div>
                    <div className="text-[9px] font-mono-tech text-slate-500 uppercase tracking-widest">Saldo Financeiro</div>
                    <div className={`text-sm font-black mt-1 font-heading ${saldo < 0 ? "text-rose-400" : "text-emerald-450"}`}>
                      R$ {saldo.toLocaleString("pt-BR")}
                    </div>
                    <div className="text-[8.5px] text-slate-500 font-semibold mt-1.5 uppercase font-mono-tech leading-none">
                      {saldo < 0 ? "saldo devedor da rota" : "saldo livre disponível"}
                    </div>
                  </div>
                  <div className={`text-2xl animate-pulse-heartbeat p-2.5 rounded-xl border shadow-inner select-none ${
                    saldo < 0 
                      ? "text-rose-500 bg-rose-500/10 border-rose-500/20" 
                      : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                  }`}>
                    💚
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

              {/* Painel de Resumo das Abas (Dashboard Integrado) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full select-none">
                
                {/* 1. Resumo da Agenda e Itinerário */}
                <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 shadow-md flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
                      <span>📅</span>
                      <span>Resumo da Agenda</span>
                    </h3>
                    <div className="space-y-2 text-[10px] text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-500 uppercase font-bold">Duração Total:</span>
                        <span className="font-mono-tech font-bold">{datasViagem.length} dias</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 uppercase font-bold">Hospedagem reservada:</span>
                        <span className="font-mono-tech font-bold text-emerald-450">
                          {datasViagem.filter(dia => roteiroDiario[dia]?.hospedagem).length} de {datasViagem.length} noites
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 uppercase font-bold">Passeios & Atividades:</span>
                        <span className="font-mono-tech font-bold text-amber-500">
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

                {/* 2. Resumo de Finanças */}
                <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 shadow-md flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
                      <span>💸</span>
                      <span>Resumo de Finanças</span>
                    </h3>
                    
                    {/* Segmented mini-bar */}
                    <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden flex border border-slate-900 shadow-inner">
                      {totalHospedagem > 0 && (
                        <div style={{ width: `${percentualHospedagem}%` }} className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600" />
                      )}
                      {totalPasseios > 0 && (
                        <div style={{ width: `${percentualPasseios}%` }} className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 border-l border-slate-950" />
                      )}
                      {totalDespesas > 0 && (
                        <div style={{ width: `${percentualDespesas}%` }} className="h-full bg-gradient-to-r from-amber-500 to-rose-500 border-l border-slate-950" />
                      )}
                      {custoTotal === 0 && (
                        <div className="w-full h-full bg-slate-900 flex items-center justify-center text-[7px] text-slate-650 font-bold uppercase tracking-wider">
                          Nenhum gasto
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-[8px] font-bold">
                      <div className="text-center">
                        <span className="text-indigo-455 block">Acomodação</span>
                        <span className="text-slate-500 font-mono-tech block mt-0.5">R$ {totalHospedagem.toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-emerald-455 block">Atividades</span>
                        <span className="text-slate-500 font-mono-tech block mt-0.5">R$ {totalPasseios.toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-amber-450 block">Despesas</span>
                        <span className="text-slate-500 font-mono-tech block mt-0.5">R$ {totalDespesas.toLocaleString("pt-BR")}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab("financas")}
                    className="w-full py-2 bg-slate-950 border border-slate-850 hover:border-slate-800 hover:text-slate-200 text-slate-400 font-bold text-[9px] rounded-xl uppercase transition-all cursor-pointer text-center border-0 shadow-md"
                  >
                    Acessar Finanças ➔
                  </button>
                </div>

                {/* 3. Banco de Alocações (Itens Livres) */}
                <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 shadow-md flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
                      <span>🛍️</span>
                      <span>Banco de Alocações</span>
                    </h3>
                    <div className="text-[10px] text-slate-450 leading-relaxed font-sans font-medium uppercase tracking-wide">
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
                <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 shadow-md flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-black uppercase text-indigo-400 tracking-wider flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span>📋</span>
                        <span>Monitor de Logs</span>
                      </div>
                      <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full led-green animate-pulse" />
                    </h3>
                    <div className="bg-slate-950/70 border border-slate-850 rounded-xl p-3 font-mono-tech text-[8.5px] space-y-1.5 h-14 overflow-y-auto select-none shadow-inner leading-normal">
                      {consoleLogs.map((log, index) => {
                        let colorClass = "text-slate-455";
                        if (log.includes("[SYSTEM]")) colorClass = "text-cyan-400/90 font-bold";
                        else if (log.includes("FIRESTORE:")) colorClass = "text-[#10b981] font-semibold";
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
                    className="w-full py-2 bg-slate-950 border border-slate-850 hover:border-slate-800 hover:text-slate-200 text-slate-400 font-bold text-[9px] rounded-xl uppercase transition-all cursor-pointer text-center border-0 shadow-md"
                  >
                    Abrir Console de Logs ➔
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* =======================================
              ABA 1.2: Finanças e Relatórios
              ======================================= */}
             {activeTab === "financas" && (
            <div className="space-y-5 flex-1 flex flex-col min-h-0">
              {/* Grid Central Dashboard: Duas Colunas Invertidas */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0 items-start">
                
                {/* COLUNA ESQUERDA (lg:col-span-5) - Lançamento & Categorias */}
                <div className="lg:col-span-5 space-y-5 flex flex-col">
                  
                  {/* Formulário Premium de Registro de Despesa */}
                  <div className="glass-panel p-4.5 rounded-2xl relative overflow-hidden space-y-3.5 shadow-xl border border-slate-800/80 select-none">
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

                </div>

                {/* COLUNA DIREITA (lg:col-span-7) - Extrato & Gráfico Acumulativo */}
                <div className="lg:col-span-7 space-y-5 flex flex-col h-full">
                  
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

      {/* Mobile Bottom Navigation (inspired by Image 5) */}
      <div className="lg:hidden fixed bottom-5 left-5 right-5 z-[999] glass-panel rounded-2xl p-2.5 flex justify-around items-center shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-slate-800/80">
        <button
          onClick={() => setActiveTab("visao-geral")}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === "visao-geral" ? "active-bottom-tab-capsule text-white scale-105" : "text-slate-500 hover:text-slate-355"
          }`}
        >
          <span className="text-base select-none">📊</span>
          <span className="text-[7.5px] font-black uppercase tracking-widest mt-1">Visão</span>
        </button>
        <button
          onClick={() => setActiveTab("financas")}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === "financas" ? "active-bottom-tab-capsule text-white scale-105" : "text-slate-500 hover:text-slate-355"
          }`}
        >
          <span className="text-base select-none">💸</span>
          <span className="text-[7.5px] font-black uppercase tracking-widest mt-1">Finanças</span>
        </button>
        <button
          onClick={() => setActiveTab("cronograma")}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === "cronograma" ? "active-bottom-tab-capsule text-white scale-105" : "text-slate-500 hover:text-slate-355"
          }`}
        >
          <span className="text-base select-none">📅</span>
          <span className="text-[7.5px] font-black uppercase tracking-widest mt-1">Agenda</span>
        </button>
        <button
          onClick={() => setActiveTab("banco")}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === "banco" ? "active-bottom-tab-capsule text-white scale-105" : "text-slate-500 hover:text-slate-355"
          }`}
        >
          <span className="text-base select-none">🛍️</span>
          <span className="text-[7.5px] font-black uppercase tracking-widest mt-1">Alocar</span>
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === "logs" ? "active-bottom-tab-capsule text-white scale-105" : "text-slate-500 hover:text-slate-355"
          }`}
        >
          <span className="text-base select-none">📋</span>
          <span className="text-[7.5px] font-black uppercase tracking-widest mt-1">Logs</span>
        </button>
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