import { db, isFirebaseConfigured } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  arrayUnion,
  query,
  orderBy,
  Timestamp,
  getDoc
} from "firebase/firestore";

// --- INTERFACES ---
export interface Hospedagem {
  nome: string;
  preco_diario: number;
  link: string;
}

export interface Atividade {
  nome: string;
  valor: number;
  link: string;
}

export interface RoteiroDiario {
  hospedagem: Hospedagem | null;
  atividades: Atividade[];
  cronograma_horario?: Record<string, string>;
}

export interface Viagem {
  id: string;
  usuario_id: string;
  origem: string;
  destino: string;
  data_inicio: string;
  data_fim: string;
  orcamento_maximo: number;
  criado_em: unknown;
}

// --- LOGGING ENGINE ---
type LogListener = (log: string) => void;
const logListeners = new Set<LogListener>();

export const subscribeToLogs = (listener: LogListener) => {
  logListeners.add(listener);
  return () => {
    logListeners.delete(listener);
  };
};

export const emitLog = (message: string) => {
  const timestamp = new Date().toISOString().split("T")[1].slice(0, 8);
  const formatted = `[${timestamp}] ${message}`;
  console.log(formatted);
  logListeners.forEach((l) => l(formatted));
};

// --- DATA SERVICE ---

// Chaves auxiliares para o localStorage
const MOCK_TRIPS_KEY = "chilinho_trips_db";
const MOCK_ITINERARY_PREFIX = "chilinho_itinerary_";

/**
 * Helper para forçar timeout em promessas pendentes do Firestore (evita travamentos se regras estiverem bloqueadas)
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Helper para gerar as datas cronologicamente entre início e fim sem bugs de timezone
 */
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

/**
 * Retorna as viagens gravadas no banco de dados.
 */
export async function listarViagens(): Promise<Viagem[]> {
  emitLog("REQUEST: Carregando todas as viagens registradas...");

  if (isFirebaseConfigured && db) {
    try {
      emitLog("FIRESTORE: Executando getDocs(collection('viagens')) [Order: criado_em desc]...");
      const q = query(collection(db, "viagens"), orderBy("criado_em", "desc"));
      const snapshot = await withTimeout(
        getDocs(q),
        6000,
        "Tempo limite de conexão esgotado ao listar viagens (Firestore offline ou bloqueado)."
      );
      const viagens = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          usuario_id: data.usuario_id || "operator-01",
          origem: data.origem || "Não informada",
          destino: data.destino || "Não informado",
          data_inicio: data.data_inicio,
          data_fim: data.data_fim,
          criado_em: data.criado_em,
          orcamento_maximo: Number(data.orcamento_maximo ?? data.orcamento) || 0,
        } as Viagem;
      });
      emitLog(`FIRESTORE: ${viagens.length} viagens carregadas com sucesso.`);
      return viagens;
    } catch (error) {
      const err = error as { code?: string; message?: string };
      emitLog(`FIRESTORE ERROR: Falha ao ler viagens. Detalhe: ${err?.message || error}`);
      console.error(error);
    }
  }

  // Fallback para LocalStorage
  emitLog("SIMULATOR: Lendo registros da base de dados local (localStorage)...");
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(MOCK_TRIPS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Viagem[];
      emitLog(`SIMULATOR: ${parsed.length} viagens recuperadas da memória local.`);
      return parsed;
    }
    // Dados default se vazio
    const defaultTrips: Viagem[] = [
      {
        id: "trip-default-santiago",
        usuario_id: "operator-01",
        origem: "São Paulo (GRU)",
        destino: "Santiago (SCL)",
        data_inicio: "2026-07-10",
        data_fim: "2026-07-15",
        orcamento_maximo: 5000,
        criado_em: new Date().toISOString(),
      },
    ];
    localStorage.setItem(MOCK_TRIPS_KEY, JSON.stringify(defaultTrips));
    emitLog("SIMULATOR: Nenhuma viagem encontrada. Banco inicializado com viagem padrão.");
    return defaultTrips;
  }
  return [];
}

/**
 * Cria uma nova viagem principal e gera os documentos diários vazios na subcoleção.
 */
export async function criarNovaViagem(
  origem: string,
  destino: string,
  dataInicio: string,
  dataFim: string,
  orcamento: number
): Promise<string> {
  emitLog(`REQUEST: Registrando nova rota para ${destino} (${dataInicio} a ${dataFim}) com orçamento de R$ ${orcamento}...`);
  const tempId = "trip_" + Math.random().toString(36).substring(2, 11);

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(collection(db, "viagens"));
      const record = {
        usuario_id: "operator-01",
        origem,
        destino,
        data_inicio: dataInicio,
        data_fim: dataFim,
        criado_em: Timestamp.now(),
        orcamento_maximo: orcamento,
      };
      
      emitLog(`FIRESTORE: setDoc(doc(db, 'viagens', '${docRef.id}')) com destino=${record.destino}...`);
      await withTimeout(
        setDoc(docRef, record),
        4000,
        "Erro de gravação no Firestore (Regras de Segurança Negadas ou Rede Offline)."
      );
      
      // Gera as datas do intervalo
      const dias = gerarDiasPeriodo(dataInicio, dataFim);
      emitLog(`FIRESTORE: Inicializando ${dias.length} documentos vazios na subcoleção 'roteiro_diario'...`);
      
      // Cria cada documento diário como vazio
      for (const dia of dias) {
        const diaDocRef = doc(db, "viagens", docRef.id, "roteiro_diario", dia);
        await withTimeout(
          setDoc(diaDocRef, {
            hospedagem: null,
            atividades: [],
          }),
          3000,
          "Erro ao inicializar dias do roteiro no Firestore (Timeout)."
        );
      }
      
      emitLog(`FIRESTORE: Viagem criada com sucesso no Firestore com ID: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      const err = error as { code?: string; message?: string };
      emitLog(`FIRESTORE ERROR: Falha ao criar viagem e roteiro. Detalhe: ${err?.message || error}`);
      console.error(error);
      throw error;
    }
  }

  // Fallback para LocalStorage
  emitLog("SIMULATOR: Criando nova viagem no localStorage...");
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(MOCK_TRIPS_KEY);
    const viagens: Viagem[] = raw ? JSON.parse(raw) : [];
    const novaViagem: Viagem = {
      id: tempId,
      usuario_id: "operator-01",
      origem,
      destino,
      data_inicio: dataInicio,
      data_fim: dataFim,
      criado_em: new Date().toISOString(),
      orcamento_maximo: orcamento,
    };
    viagens.unshift(novaViagem);
    localStorage.setItem(MOCK_TRIPS_KEY, JSON.stringify(viagens));

    // Inicializa o roteiro diário vazio localmente
    const dias = gerarDiasPeriodo(dataInicio, dataFim);
    const roteiro: Record<string, RoteiroDiario> = {};
    for (const dia of dias) {
      roteiro[dia] = { hospedagem: null, atividades: [] };
    }
    localStorage.setItem(`${MOCK_ITINERARY_PREFIX}${tempId}`, JSON.stringify(roteiro));

    emitLog(`SIMULATOR: Viagem registrada localmente. ID atribuído: ${tempId}`);
    return tempId;
  }
  return tempId;
}

/**
 * Mantém compatibilidade com a assinatura antiga chamando internamente criarNovaViagem
 */
export async function criarViagem(viagemData: Omit<Viagem, "id" | "criado_em">): Promise<string> {
  return criarNovaViagem(
    viagemData.origem,
    viagemData.destino,
    viagemData.data_inicio,
    viagemData.data_fim,
    viagemData.orcamento_maximo || 0
  );
}

/**
 * Retorna todo o roteiro diário agrupado por data do dia.
 */
export async function obterRoteiroDiario(viagemId: string): Promise<Record<string, RoteiroDiario>> {
  emitLog(`REQUEST: Solicitando itinerário diário para a viagem ID: ${viagemId}...`);

  if (isFirebaseConfigured && db) {
    try {
      emitLog(`FIRESTORE: getDocs(collection('viagens/${viagemId}/roteiro_diario'))`);
      const snapshot = await withTimeout(
        getDocs(collection(db, "viagens", viagemId, "roteiro_diario")),
        4000,
        "Tempo limite esgotado ao buscar roteiro diário."
      );
      const roteiro: Record<string, RoteiroDiario> = {};
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        roteiro[docSnap.id] = {
          hospedagem: data.hospedagem || null,
          atividades: data.atividades || [],
        };
      });
      emitLog(`FIRESTORE: Roteiro carregado contendo ${Object.keys(roteiro).length} dias preenchidos.`);
      return roteiro;
    } catch (error) {
      const err = error as { code?: string; message?: string };
      emitLog(`FIRESTORE ERROR: Falha ao recuperar subcoleção roteiro_diario. Detalhe: ${err?.message || error}`);
      console.error(error);
    }
  }

  // Fallback para LocalStorage
  emitLog(`SIMULATOR: Buscando roteiro no localStorage para ${MOCK_ITINERARY_PREFIX}${viagemId}...`);
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(`${MOCK_ITINERARY_PREFIX}${viagemId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, RoteiroDiario>;
      emitLog(`SIMULATOR: Roteiro retornado com ${Object.keys(parsed).length} dias ativos.`);
      return parsed;
    }
    emitLog("SIMULATOR: Roteiro vazio. Inicializado objeto em branco.");
    return {};
  }
  return {};
}

/**
 * Insere ou atualiza um item no roteiro diário (hotel ou passeio).
 * Usa updateDoc com arrayUnion para passeios e atribuição direta de hospedagem para hotel.
 */
export async function injetarItemNoRoteiro(
  viagemId: string,
  dataDia: string,
  item: Hospedagem | Atividade,
  tipo: "hotel" | "passeio"
): Promise<void> {
  emitLog(`REQUEST: Injetando item [${item.nome}] (${tipo}) no dia ${dataDia}...`);

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "viagens", viagemId, "roteiro_diario", dataDia);
      if (tipo === "hotel") {
        emitLog(`FIRESTORE: updateDoc(docRef, { hospedagem: {...} }) no dia ${dataDia}...`);
        await withTimeout(
          updateDoc(docRef, { hospedagem: item }),
          4000,
          "Tempo limite esgotado ao salvar hospedagem no Firestore."
        );
      } else {
        emitLog(`FIRESTORE: updateDoc(docRef, { atividades: arrayUnion({...}) }) no dia ${dataDia}...`);
        await withTimeout(
          updateDoc(docRef, {
            atividades: arrayUnion(item),
          }),
          4000,
          "Tempo limite esgotado ao salvar atividade no Firestore."
        );
      }
      emitLog(`FIRESTORE: Item (${tipo}) injetado com sucesso no dia ${dataDia}.`);
      return;
    } catch (error) {
      const err = error as { code?: string; message?: string };
      emitLog(`FIRESTORE ERROR: Falha ao injetar item. Detalhe: ${err?.message || error}`);
      console.error(error);
      throw error;
    }
  }

  // Fallback para LocalStorage
  emitLog(`SIMULATOR: Injetando item (${tipo}) no dia ${dataDia} localmente...`);
  if (typeof window !== "undefined") {
    const key = `${MOCK_ITINERARY_PREFIX}${viagemId}`;
    const raw = localStorage.getItem(key);
    const roteiro: Record<string, RoteiroDiario> = raw ? JSON.parse(raw) : {};

    if (!roteiro[dataDia]) {
      roteiro[dataDia] = { hospedagem: null, atividades: [] };
    }

    if (tipo === "hotel") {
      roteiro[dataDia].hospedagem = item as Hospedagem;
    } else {
      roteiro[dataDia].atividades.push(item as Atividade);
    }
    
    localStorage.setItem(key, JSON.stringify(roteiro));
    emitLog(`SIMULATOR: Item (${tipo}) salvo localmente no dia ${dataDia}.`);
  }
}

/**
 * Define ou atualiza a hospedagem de um dia específico.
 */
export async function atualizarHospedagemDia(
  viagemId: string,
  dataDia: string,
  hospedagem: Hospedagem
): Promise<void> {
  return injetarItemNoRoteiro(viagemId, dataDia, hospedagem, "hotel");
}

/**
 * Adiciona uma atividade na lista de atividades do dia correspondente usando arrayUnion.
 */
export async function adicionarAtividadeDia(
  viagemId: string,
  dataDia: string,
  atividade: Atividade
): Promise<void> {
  return injetarItemNoRoteiro(viagemId, dataDia, atividade, "passeio");
}

/**
 * Remove uma atividade pelo índice no dia correspondente.
 */
export async function removerAtividadeDia(
  viagemId: string,
  dataDia: string,
  atividadeIndex: number
): Promise<void> {
  emitLog(`REQUEST: Removendo atividade no índice ${atividadeIndex} do dia ${dataDia}...`);

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "viagens", viagemId, "roteiro_diario", dataDia);
      emitLog(`FIRESTORE: Lendo documento para remover item no índice ${atividadeIndex}...`);
      const docSnap = await withTimeout(
        getDoc(docRef),
        4000,
        "Tempo limite esgotado ao ler atividades para remoção."
      );
      if (docSnap.exists()) {
        const data = docSnap.data();
        const atividades = [...(data.atividades || [])];
        if (atividadeIndex >= 0 && atividadeIndex < atividades.length) {
          const removida = atividades.splice(atividadeIndex, 1);
          emitLog(`FIRESTORE: updateDoc(docRef, { atividades }) após remover '${removida[0]?.nome}'...`);
          await withTimeout(
            updateDoc(docRef, { atividades }),
            4000,
            "Tempo limite esgotado ao remover atividade do Firestore."
          );
          emitLog(`FIRESTORE: Atividade removida com sucesso no dia ${dataDia}.`);
        }
      }
      return;
    } catch (error) {
      const err = error as { code?: string; message?: string };
      emitLog(`FIRESTORE ERROR: Falha ao deletar atividade. Detalhe: ${err?.message || error}`);
      console.error(error);
    }
  }

  // Fallback para LocalStorage
  emitLog(`SIMULATOR: Removendo atividade localmente no dia ${dataDia}...`);
  if (typeof window !== "undefined") {
    const key = `${MOCK_ITINERARY_PREFIX}${viagemId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const roteiro: Record<string, RoteiroDiario> = JSON.parse(raw);
      if (roteiro[dataDia] && roteiro[dataDia].atividades) {
        const removida = roteiro[dataDia].atividades.splice(atividadeIndex, 1);
        localStorage.setItem(key, JSON.stringify(roteiro));
        emitLog(`SIMULATOR: Atividade '${removida[0]?.nome}' excluída do dia ${dataDia}.`);
      }
    }
  }
}

/**
 * Remove a hospedagem de um dia específico.
 */
export async function removerHospedagemDia(viagemId: string, dataDia: string): Promise<void> {
  emitLog(`REQUEST: Excluindo hospedagem vinculada ao dia ${dataDia}...`);

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "viagens", viagemId, "roteiro_diario", dataDia);
      emitLog(`FIRESTORE: updateDoc(docRef, { hospedagem: null }) no dia ${dataDia}...`);
      await withTimeout(
        updateDoc(docRef, { hospedagem: null }),
        4000,
        "Tempo limite esgotado ao remover hospedagem do Firestore."
      );
      emitLog(`FIRESTORE: Hospedagem desvinculada com sucesso no dia ${dataDia}.`);
      return;
    } catch (error) {
      const err = error as { code?: string; message?: string };
      emitLog(`FIRESTORE ERROR: Falha ao deletar hospedagem. Detalhe: ${err?.message || error}`);
      console.error(error);
    }
  }

  // Fallback para LocalStorage
  emitLog(`SIMULATOR: Excluindo hospedagem localmente no dia ${dataDia}...`);
  if (typeof window !== "undefined") {
    const key = `${MOCK_ITINERARY_PREFIX}${viagemId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const roteiro: Record<string, RoteiroDiario> = JSON.parse(raw);
      if (roteiro[dataDia]) {
        roteiro[dataDia].hospedagem = null;
        localStorage.setItem(key, JSON.stringify(roteiro));
        emitLog(`SIMULATOR: Hospedagem desvinculada no dia ${dataDia}.`);
      }
    }
  }
}

/**
 * Executa o JOB de atualização e recotação de preços sob demanda.
 * Simula a flutuação cambial ou tarifária de mercado para o console industrial.
 */
export async function atualizarCotacoesOnDemand(viagemId: string): Promise<void> {
  emitLog(`REQUEST: Iniciando JOB sob demanda para recotação de Viagem ID: ${viagemId}...`);

  // Carrega o roteiro diário atual
  const roteiro = await obterRoteiroDiario(viagemId);
  const dias = Object.keys(roteiro);

  if (dias.length === 0) {
    emitLog("SYSTEM WARNING: Nenhum roteiro diário escalado para recotador.");
    return;
  }

  let alterouAlgum = false;

  for (const dia of dias) {
    const diario = roteiro[dia];
    let alterouDia = false;
    const updates: Partial<RoteiroDiario> = {};

    // 1. Hospedagem
    if (diario.hospedagem) {
      const precoAntigo = diario.hospedagem.preco_diario;
      // Flutuação de -12% a +12%
      const fator = 0.88 + Math.random() * 0.24;
      const precoNovo = Math.max(80, Math.round(precoAntigo * fator));
      
      if (precoNovo !== precoAntigo) {
        diario.hospedagem.preco_diario = precoNovo;
        updates.hospedagem = diario.hospedagem;
        alterouDia = true;
        emitLog(`JOB: Preço da Hospedagem em [${dia}] variou de R$ ${precoAntigo} para R$ ${precoNovo} (Flutuação de Mercado).`);
      }
    }

    // 2. Atividades
    if (diario.atividades && diario.atividades.length > 0) {
      const novasAtividades = diario.atividades.map((atv) => {
        const valorAntigo = atv.valor;
        // Flutuação de -6% a +6%
        const fator = 0.94 + Math.random() * 0.12;
        const valorNovo = Math.max(20, Math.round(valorAntigo * fator));
        
        if (valorNovo !== valorAntigo) {
          emitLog(`JOB: Atividade [${atv.nome}] recalibrada de R$ ${valorAntigo} para R$ ${valorNovo}.`);
          alterouDia = true;
          return { ...atv, valor: valorNovo };
        }
        return atv;
      });

      if (alterouDia) {
        updates.atividades = novasAtividades;
        diario.atividades = novasAtividades;
      }
    }

    // Gravar atualizações
    if (alterouDia) {
      alterouAlgum = true;
      if (isFirebaseConfigured && db) {
        try {
          const docRef = doc(db, "viagens", viagemId, "roteiro_diario", dia);
          await withTimeout(
            updateDoc(docRef, updates),
            4000,
            "Tempo limite esgotado ao sincronizar recotação de preços."
          );
        } catch (error) {
          console.error("Erro no JOB Firestore:", error);
        }
      } else {
        // LocalStorage
        if (typeof window !== "undefined") {
          const key = `${MOCK_ITINERARY_PREFIX}${viagemId}`;
          localStorage.setItem(key, JSON.stringify(roteiro));
        }
      }
    }
  }

  if (alterouAlgum) {
    emitLog("SYSTEM: JOB de atualização de cotações concluído. Valores atualizados no banco de dados.");
  } else {
    emitLog("SYSTEM: JOB concluído. Valores mantidos estáveis nesta janela transacional.");
  }
}

/**
 * Edita uma viagem existente no Firestore ou LocalStorage.
 */
export async function editarViagem(
  id: string,
  origem: string,
  destino: string,
  dataInicio: string,
  dataFim: string,
  orcamento: number
): Promise<void> {
  emitLog(`REQUEST: Editando rota ID: ${id} com novos parâmetros...`);

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "viagens", id);
      
      // Verifica se o documento existe no Firestore (para cobrir rotas defaults/locais)
      const docSnap = await withTimeout(
        getDoc(docRef),
        3000,
        "Erro ao verificar existência da rota no Firestore (Timeout)."
      );

      const record = {
        origem,
        destino,
        data_inicio: dataInicio,
        data_fim: dataFim,
        orcamento_maximo: orcamento,
        usuario_id: "operator-01",
      };

      if (docSnap.exists()) {
        emitLog(`FIRESTORE: updateDoc(doc(db, 'viagens', '${id}')) com novos valores...`);
        await withTimeout(
          updateDoc(docRef, record),
          4000,
          "Erro ao atualizar viagem no Firestore (Timeout ou Regras de Segurança)."
        );
      } else {
        emitLog(`FIRESTORE: setDoc(doc(db, 'viagens', '${id}')) (Criação de rota padrão/mock no ar)...`);
        await withTimeout(
          setDoc(docRef, {
            ...record,
            criado_em: Timestamp.now(),
          }),
          4000,
          "Erro ao criar rota padrão no Firestore (Timeout ou Regras de Segurança)."
        );
      }

      // Garante que novos dias sejam inicializados se as datas expandiram
      const dias = gerarDiasPeriodo(dataInicio, dataFim);
      for (const dia of dias) {
        const diaDocRef = doc(db, "viagens", id, "roteiro_diario", dia);
        const diaSnap = await withTimeout(
          getDoc(diaDocRef),
          3000,
          "Erro ao verificar dia do roteiro (Timeout)."
        );
        if (!diaSnap.exists()) {
          await withTimeout(
            setDoc(diaDocRef, {
              hospedagem: null,
              atividades: [],
            }),
            3000,
            "Erro ao inicializar novos dias expandidos do roteiro (Timeout)."
          );
        }
      }

      emitLog(`FIRESTORE: Viagem ID ${id} atualizada com sucesso.`);
      return;
    } catch (error) {
      const err = error as { code?: string; message?: string };
      emitLog(`FIRESTORE ERROR: Falha ao editar viagem. Detalhe: ${err?.message || error}`);
      console.error(error);
      throw error;
    }
  }

  // Fallback para LocalStorage
  emitLog(`SIMULATOR: Editando viagem ID ${id} no localStorage...`);
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(MOCK_TRIPS_KEY);
    if (raw) {
      const viagens: Viagem[] = JSON.parse(raw);
      const idx = viagens.findIndex((v) => v.id === id);
      if (idx !== -1) {
        viagens[idx] = {
          ...viagens[idx],
          origem,
          destino,
          data_inicio: dataInicio,
          data_fim: dataFim,
          orcamento_maximo: orcamento,
        };
        localStorage.setItem(MOCK_TRIPS_KEY, JSON.stringify(viagens));

        // Inicializa os novos dias locais se necessário
        const dias = gerarDiasPeriodo(dataInicio, dataFim);
        const key = `${MOCK_ITINERARY_PREFIX}${id}`;
        const rawRoteiro = localStorage.getItem(key);
        const roteiro: Record<string, RoteiroDiario> = rawRoteiro ? JSON.parse(rawRoteiro) : {};

        let alterouRoteiroLocal = false;
        for (const dia of dias) {
          if (!roteiro[dia]) {
            roteiro[dia] = { hospedagem: null, atividades: [] };
            alterouRoteiroLocal = true;
          }
        }
        if (alterouRoteiroLocal) {
          localStorage.setItem(key, JSON.stringify(roteiro));
        }

        emitLog(`SIMULATOR: Viagem ID ${id} atualizada localmente.`);
      }
    }
  }
}

/**
 * Atualiza o cronograma horário (agenda de horas do dia) de um dia específico.
 */
export async function atualizarCronogramaHorario(
  viagemId: string,
  dataDia: string,
  cronograma: Record<string, string>
): Promise<void> {
  emitLog(`REQUEST: Sincronizando cronograma horário do dia ${dataDia}...`);

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "viagens", viagemId, "roteiro_diario", dataDia);
      await withTimeout(
        updateDoc(docRef, { cronograma_horario: cronograma }),
        4000,
        "Tempo limite esgotado ao salvar cronograma horário no Firestore."
      );
      emitLog(`FIRESTORE: Cronograma horário salvo com sucesso no dia ${dataDia}.`);
      return;
    } catch (error) {
      const err = error as { code?: string; message?: string };
      emitLog(`FIRESTORE ERROR: Falha ao salvar cronograma. Detalhe: ${err?.message || error}`);
      console.error(error);
      throw error;
    }
  }

  // Fallback para LocalStorage
  emitLog(`SIMULATOR: Salvando cronograma horário no dia ${dataDia} localmente...`);
  if (typeof window !== "undefined") {
    const key = `${MOCK_ITINERARY_PREFIX}${viagemId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const roteiro: Record<string, RoteiroDiario> = JSON.parse(raw);
      if (!roteiro[dataDia]) {
        roteiro[dataDia] = { hospedagem: null, atividades: [] };
      }
      roteiro[dataDia].cronograma_horario = cronograma;
      localStorage.setItem(key, JSON.stringify(roteiro));
      emitLog(`SIMULATOR: Cronograma horário salvo localmente no dia ${dataDia}.`);
    }
  }
}
