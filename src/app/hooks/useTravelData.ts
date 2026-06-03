"use client";

import { useState, useEffect, useCallback } from "react";
import { User } from "firebase/auth";
import { onSnapshot, query, collection, orderBy } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import {
  listarViagens,
  criarViagem,
  editarViagem,
  deletarViagem,
  obterRoteiroDiario,
  atualizarHospedagemDia,
  adicionarAtividadeDia,
  removerHospedagemDia,
  removerAtividadeDia,
  adicionarDespesaDia,
  removerDespesaDia,
  atualizarCronogramaHorario,
  atualizarViajantesViagem,
  Viagem,
  RoteiroDiario,
  Hospedagem,
  Atividade,
  Despesa,
  emitLog
} from "@/services/travelService";

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

export function useTravelData(user: User | null) {
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [viagemAtiva, setViagemAtiva] = useState<Viagem | null>(null);
  const [datasViagem, setDatasViagem] = useState<string[]>([]);
  const [roteiroDiario, setRoteiroDiario] = useState<Record<string, RoteiroDiario>>({});
  const [diaAtivoWorkspace, setDiaAtivoWorkspace] = useState<string | null>(null);

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
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const userId = user ? user.uid : "operator-01";
          
          const list = snapshot.docs
            .map((d) => {
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
                viajantes: data.viajantes || [],
              } as Viagem;
            })
            .filter((v) => v.usuario_id === userId || v.usuario_id === "operator-01");

          setViagens(list);
          
          // Sincroniza a viagem ativa reativamente se ela estiver selecionada
          setViagemAtiva((prevAtiva) => {
            if (!prevAtiva) return null;
            const atualizada = list.find((v) => v.id === prevAtiva.id);
            return atualizada || prevAtiva;
          });

          emitLog(`FIRESTORE: ${list.length} viagens hidratadas reativamente.`);
        },
        (err) => {
          console.error("Erro ao escutar viagens:", err);
          emitLog("FIRESTORE ERROR: Falha na escuta de viagens em tempo real.");
        }
      );
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
      unsubscribes.push(
        onSnapshot(hoteisRef, (snap) => {
          localHoteis = {};
          snap.docs.forEach((doc) => {
            const data = doc.data();
            localHoteis[doc.id] = {
              nome: data.nome || "",
              preco_diario: Number(data.preco_diario) || 0,
              link: data.link || "",
            };
          });
          combinarRoteiroReativo();
        })
      );

      // B. Ouvinte de Passeios/Atividades
      unsubscribes.push(
        onSnapshot(passeiosRef, (snap) => {
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
                criado_em: data.criado_em,
              });
            }
          });
          
          localPasseios = {};
          Object.keys(tempPasseios).forEach((diaId) => {
            localPasseios[diaId] = tempPasseios[diaId]
              .sort((a, b) => {
                const tA = a.criado_em?.seconds || 0;
                const tB = b.criado_em?.seconds || 0;
                return tA - tB;
              })
              .map((p) => ({
                id: p.id,
                nome: p.nome,
                valor: p.valor,
                link: p.link,
              }));
          });
          combinarRoteiroReativo();
        })
      );

      // C. Ouvinte de Roteiros/Cronograma de Horas
      unsubscribes.push(
        onSnapshot(roteirosRef, (snap) => {
          localRoteiros = {};
          snap.docs.forEach((doc) => {
            const data = doc.data();
            localRoteiros[doc.id] = (data.cronograma_horario as Record<string, string>) || {};
          });
          combinarRoteiroReativo();
        })
      );

      // D. Ouvinte de Despesas Extras
      unsubscribes.push(
        onSnapshot(despesasRef, (snap) => {
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
                pagoPor: data.pagoPor,
                divididoCom: data.divididoCom,
                moedaOriginal: data.moedaOriginal,
                valorOriginal: data.valorOriginal,
                criado_em: data.criado_em,
              });
            }
          });

          localDespesas = {};
          Object.keys(tempDespesas).forEach((diaId) => {
            localDespesas[diaId] = tempDespesas[diaId]
              .sort((a, b) => {
                const tA = a.criado_em?.seconds || 0;
                const tB = b.criado_em?.seconds || 0;
                return tA - tB;
              })
              .map((d) => ({
                id: d.id,
                diaId: d.diaId,
                nome: d.nome,
                valor: d.valor,
                categoria: d.categoria,
                pagoPor: d.pagoPor,
                divididoCom: d.divididoCom,
                moedaOriginal: d.moedaOriginal,
                valorOriginal: d.valorOriginal,
              }));
          });
          combinarRoteiroReativo();
        })
      );

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
  const selecionarViagem = useCallback(async (id: string) => {
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
  }, [viagens]);

  // Handler para criar nova viagem com suporte a orçamento
  const criarNovaViagem = useCallback(async (novaViagemData: {
    origem: string;
    destino: string;
    data_inicio: string;
    data_fim: string;
    orcamento: number;
  }) => {
    const userId = user ? user.uid : "operator-01";
    const payload = {
      usuario_id: userId,
      origem: novaViagemData.origem,
      destino: novaViagemData.destino,
      data_inicio: novaViagemData.data_inicio,
      data_fim: novaViagemData.data_fim,
      orcamento_maximo: novaViagemData.orcamento,
      viajantes: [],
    };
    const novoId = await criarViagem(payload);
    await carregarDadosViagens(novoId);
  }, [user, carregarDadosViagens]);

  // Handler para editar viagem existente
  const editarViagemAtiva = useCallback(async (
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
    await carregarDadosViagens(id);
  }, [carregarDadosViagens]);

  // Handler para deletar uma viagem definitivamente
  const deletarViagemAtiva = useCallback(async (id: string) => {
    await deletarViagem(id);
    emitLog(`SYSTEM: Viagem ID ${id} excluída definitivamente do banco de dados.`);
    setViagemAtiva((prev) => {
      if (prev?.id === id) {
        setDatasViagem([]);
        setDiaAtivoWorkspace(null);
        setRoteiroDiario({});
        return null;
      }
      return prev;
    });
    await carregarDadosViagens();
  }, [carregarDadosViagens]);

  // Injetar Hospedagem (Otimista)
  const injetarHospedagem = useCallback(async (dataDia: string, hospedagem: Hospedagem) => {
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
  }, [viagemAtiva, roteiroDiario]);

  // Injetar Atividade (Otimista)
  const injetarAtividade = useCallback(async (dataDia: string, atividade: Atividade) => {
    if (!viagemAtiva) return;

    const backupRoteiro = { ...roteiroDiario };
    const otimistaRoteiro = { ...roteiroDiario };
    if (!otimistaRoteiro[dataDia]) {
      otimistaRoteiro[dataDia] = { hospedagem: null, atividades: [] };
    }
    otimistaRoteiro[dataDia] = {
      ...otimistaRoteiro[dataDia],
      atividades: [...(otimistaRoteiro[dataDia].atividades || []), atividade],
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
  }, [viagemAtiva, roteiroDiario]);

  // Remover Hospedagem (Otimista)
  const removerHospedagem = useCallback(async (dataDia: string) => {
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
  }, [viagemAtiva, roteiroDiario]);

  // Remover Atividade (Otimista)
  const removerAtividade = useCallback(async (dataDia: string, index: number) => {
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
  }, [viagemAtiva, roteiroDiario]);

  // Injetar Despesa (Otimista)
  const injetarDespesa = useCallback(async (
    dataDia: string,
    despesa: {
      nome: string;
      valor: number;
      categoria: string;
      pagoPor?: string;
      divididoCom?: string[];
      moedaOriginal?: string;
      valorOriginal?: number;
    }
  ) => {
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
  }, [viagemAtiva, roteiroDiario]);

  // Remover Despesa (Otimista)
  const removerDespesa = useCallback(async (dataDia: string, despesaId: string) => {
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
  }, [viagemAtiva, roteiroDiario]);

  // Salvar Cronograma inline
  const salvarCronogramaInline = useCallback(async (dataDia: string, cronograma: Record<string, string>) => {
    if (!viagemAtiva) return;
    try {
      await atualizarCronogramaHorario(viagemAtiva.id, dataDia, cronograma);
      emitLog(`SYSTEM: Cronograma do dia ${dataDia} atualizado no banco.`);
    } catch (err) {
      console.error("Erro ao salvar cronograma inline:", err);
      emitLog("SYSTEM ERROR: Falha ao sincronizar o cronograma de horários.");
    }
  }, [viagemAtiva]);

  // Atualizar Viajantes reativamente
  const atualizarViajantes = useCallback(async (viajantes: string[]) => {
    if (!viagemAtiva) return;
    try {
      await atualizarViajantesViagem(viagemAtiva.id, viajantes);
      setViagemAtiva((prev) => prev ? { ...prev, viajantes } : null);
      emitLog(`SYSTEM: Lista de viajantes atualizada com sucesso.`);
    } catch (err) {
      console.error("Erro ao atualizar viajantes:", err);
      emitLog("SYSTEM ERROR: Falha ao atualizar a lista de viajantes.");
    }
  }, [viagemAtiva]);

  return {
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
  };
}
