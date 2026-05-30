import { db, isFirebaseConfigured } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  Timestamp,
  getDoc,
  deleteDoc
} from "firebase/firestore";


// --- INTERFACES ---
export interface Hospedagem {
  nome: string;
  preco_diario: number;
  link: string;
}

export interface Atividade {
  id?: string;
  nome: string;
  valor: number;
  link: string;
}

export interface Despesa {
  id?: string;
  diaId: string;
  nome: string;
  valor: number;
  categoria: string;
  criado_em?: unknown;
}

export interface RoteiroDiario {
  hospedagem: Hospedagem | null;
  atividades: Atividade[];
  despesas?: Despesa[];
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
  let viagensFirestore: Viagem[] = [];
  let isFirestoreOk = false;

  if (isFirebaseConfigured && db) {
    try {
      emitLog("FIRESTORE: Executando getDocs(collection('viagens')) [Order: criado_em desc]...");
      const q = query(collection(db, "viagens"), orderBy("criado_em", "desc"));
      const snapshot = await withTimeout(
        getDocs(q),
        6000,
        "Tempo limite de conexão esgotado ao listar viagens (Firestore offline ou bloqueado)."
      );
      viagensFirestore = snapshot.docs.map((d) => {
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
      emitLog(`FIRESTORE: ${viagensFirestore.length} viagens carregadas com sucesso.`);
      isFirestoreOk = true;
    } catch (error) {
      const err = error as { code?: string; message?: string };
      emitLog(`FIRESTORE ERROR: Falha ao ler viagens. Detalhe: ${err?.message || error}`);
      console.error(error);
    }
  }

  // Se o Firestore carregou com sucesso e retornou viagens, usamos elas como principal, mas mesclamos se houver locais
  if (isFirestoreOk && viagensFirestore.length > 0) {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem(MOCK_TRIPS_KEY);
      const parsed = raw ? (JSON.parse(raw) as Viagem[]) : [];
      // Mescla viagens locais que não existem no Firestore para evitar que sumam
      const idsFirestore = new Set(viagensFirestore.map(v => v.id));
      const locaisUnicas = parsed.filter(v => !idsFirestore.has(v.id));
      return [...viagensFirestore, ...locaisUnicas];
    }
    return viagensFirestore;
  }

  // Fallback e mescla com LocalStorage se o Firestore estiver vazio ou falhar
  emitLog("SIMULATOR: Lendo registros da base de dados local (localStorage)...");
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(MOCK_TRIPS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Viagem[];
      emitLog(`SIMULATOR: ${parsed.length} viagens recuperadas da memória local.`);
      return [...viagensFirestore, ...parsed];
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
    return [...viagensFirestore, ...defaultTrips];
  }
  return viagensFirestore;
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
      emitLog(`FIRESTORE: Inicializando ${dias.length} documentos de cronograma vazios na subcoleção 'roteiros'...`);

      // Cria cada documento de cronograma diário como vazio
      for (const dia of dias) {
        const roteiroDocRef = doc(db, "viagens", docRef.id, "roteiros", dia);
        await withTimeout(
          setDoc(roteiroDocRef, {
            cronograma_horario: {},
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
 * Garante a existência do documento pai da viagem
 */
async function garantirViagemNoFirestore(viagemId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "viagens", viagemId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() && typeof window !== "undefined") {
        const rawTrips = localStorage.getItem(MOCK_TRIPS_KEY);
        if (rawTrips) {
          const trips = JSON.parse(rawTrips) as Viagem[];
          const localTrip = trips.find(v => v.id === viagemId);
          if (localTrip) {
            emitLog(`FIRESTORE: Auto-sincronizando viagem principal '${localTrip.destino}' no Firestore...`);
            await setDoc(docRef, {
              usuario_id: localTrip.usuario_id || "operator-01",
              origem: localTrip.origem,
              destino: localTrip.destino,
              data_inicio: localTrip.data_inicio,
              data_fim: localTrip.data_fim,
              criado_em: Timestamp.now(),
              orcamento_maximo: localTrip.orcamento_maximo
            });
            emitLog(`FIRESTORE: Viagem pai criada com sucesso no banco de dados.`);
          }
        }
      }
    } catch (e) {
      console.error("Erro ao sincronizar viagem pai:", e);
    }
  }
}

/**
 * Retorna todo o roteiro diário agrupado por data do dia de forma consistente.
 */
export async function obterRoteiroDiario(viagemId: string): Promise<Record<string, RoteiroDiario>> {
  emitLog(`REQUEST: Solicitando itinerário diário para a viagem ID: ${viagemId}...`);

  // Garante a existência do documento pai da viagem antes da leitura
  await garantirViagemNoFirestore(viagemId);

  const roteiro: Record<string, RoteiroDiario> = {};

  // 1. Tenta carregar do Firestore primeiro se estiver configurado e estável
  if (isFirebaseConfigured && db) {
    try {
      emitLog(`FIRESTORE: Iniciando carregamento paralelo das subcoleções (hoteis, passeios, roteiros, despesas)...`);
      const [hoteisSnap, passeiosSnap, roteirosSnap, despesasSnap] = await withTimeout(
        Promise.all([
          getDocs(collection(db, "viagens", viagemId, "hoteis")),
          getDocs(collection(db, "viagens", viagemId, "passeios")),
          getDocs(collection(db, "viagens", viagemId, "roteiros")),
          getDocs(collection(db, "viagens", viagemId, "despesas"))
        ]),
        5000,
        "Tempo limite esgotado ao buscar subcoleções do roteiro diário."
      );

      let dadosEncontradosNaNuvem = false;

      // Processar roteiros/cronogramas
      roteirosSnap.docs.forEach((docSnap) => {
        dadosEncontradosNaNuvem = true;
        const data = docSnap.data();
        const diaId = docSnap.id;
        if (!roteiro[diaId]) {
          roteiro[diaId] = { hospedagem: null, atividades: [], despesas: [], cronograma_horario: {} };
        }
        roteiro[diaId].cronograma_horario = {
          ...roteiro[diaId].cronograma_horario,
          ...(data.cronograma_horario || {})
        };
      });

      // Processar hospedagem/hotéis
      hoteisSnap.docs.forEach((docSnap) => {
        dadosEncontradosNaNuvem = true;
        const data = docSnap.data();
        const diaId = docSnap.id;
        if (!roteiro[diaId]) {
          roteiro[diaId] = { hospedagem: null, atividades: [], despesas: [], cronograma_horario: {} };
        }
        roteiro[diaId].hospedagem = {
          nome: data.nome || "",
          preco_diario: Number(data.preco_diario) || 0,
          link: data.link || ""
        };
      });

      // Processar passeios/atividades (Preservando a ordenação cronológica)
      interface TempPasseio {
        id: string;
        nome: string;
        valor: number;
        link: string;
        criado_em?: { seconds: number; nanoseconds: number } | null;
      }

      const passeiosPorDia: Record<string, Array<TempPasseio>> = {};

      passeiosSnap.docs.forEach((docSnap) => {
        dadosEncontradosNaNuvem = true;
        const data = docSnap.data();
        const diaId = data.diaId;
        if (!diaId) return;

        if (!passeiosPorDia[diaId]) {
          passeiosPorDia[diaId] = [];
        }

        const jaExiste = passeiosPorDia[diaId].some(p => p.id === docSnap.id);
        if (!jaExiste) {
          passeiosPorDia[diaId].push({
            id: docSnap.id,
            nome: data.nome || "",
            valor: Number(data.valor) || 0,
            link: data.link || "",
            criado_em: data.criado_em || null
          });
        }
      });

      Object.keys(passeiosPorDia).forEach((diaId) => {
        const passeiosOrdenados = passeiosPorDia[diaId].sort((a, b) => {
          const tA = a.criado_em?.seconds || 0;
          const tB = b.criado_em?.seconds || 0;
          return tA - tB;
        });

        if (!roteiro[diaId]) {
          roteiro[diaId] = { hospedagem: null, atividades: [], despesas: [], cronograma_horario: {} };
        }
        roteiro[diaId].atividades = passeiosOrdenados.map((p) => ({
          id: p.id,
          nome: p.nome,
          valor: p.valor,
          link: p.link
        }));
      });

      // Processar despesas customizadas (Preservando a ordenação cronológica)
      interface TempDespesa {
        id: string;
        diaId: string;
        nome: string;
        valor: number;
        categoria: string;
        criado_em?: { seconds: number; nanoseconds: number } | null;
      }

      const despesasPorDia: Record<string, Array<TempDespesa>> = {};

      despesasSnap.docs.forEach((docSnap) => {
        dadosEncontradosNaNuvem = true;
        const data = docSnap.data();
        const diaId = data.diaId;
        if (!diaId) return;

        if (!despesasPorDia[diaId]) {
          despesasPorDia[diaId] = [];
        }

        const jaExiste = despesasPorDia[diaId].some(d => d.id === docSnap.id);
        if (!jaExiste) {
          despesasPorDia[diaId].push({
            id: docSnap.id,
            diaId: data.diaId,
            nome: data.nome || "",
            valor: Number(data.valor) || 0,
            categoria: data.categoria || "Outros",
            criado_em: data.criado_em || null
          });
        }
      });

      Object.keys(despesasPorDia).forEach((diaId) => {
        const despesasOrdenadas = despesasPorDia[diaId].sort((a, b) => {
          const tA = a.criado_em?.seconds || 0;
          const tB = b.criado_em?.seconds || 0;
          return tA - tB;
        });

        if (!roteiro[diaId]) {
          roteiro[diaId] = { hospedagem: null, atividades: [], despesas: [], cronograma_horario: {} };
        }
        roteiro[diaId].despesas = despesasOrdenadas.map((d) => ({
          id: d.id,
          diaId: d.diaId,
          nome: d.nome,
          valor: d.valor,
          categoria: d.categoria
        }));
      });

      if (dadosEncontradosNaNuvem) {
        emitLog(`FIRESTORE: Itinerário diário hidratado com sucesso diretamente da nuvem.`);
        // Atualiza de forma transparente o localStorage para manter o cache offline perfeito
        if (typeof window !== "undefined") {
          localStorage.setItem(`${MOCK_ITINERARY_PREFIX}${viagemId}`, JSON.stringify(roteiro));
        }
        return roteiro;
      }
    } catch (error) {
      const err = error as { code?: string; message?: string };
      emitLog(`FIRESTORE ERROR: Falha ao recuperar subcoleções estruturadas da nuvem. Detalhe: ${err?.message || error}`);
      console.error(error);
    }
  }

  // 2. Fallback resiliente: Se o Firestore falhar, estiver instável ou vazio, consome o LocalStorage
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(`${MOCK_ITINERARY_PREFIX}${viagemId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, RoteiroDiario>;
      emitLog(`SIMULATOR: Roteiro carregado de forma estável do LocalStorage fallback.`);
      return parsed;
    }
  }

  return roteiro;
}

/**
 * Insere ou atualiza um item no roteiro diário (hotel ou passeio).
 */
export async function injetarItemNoRoteiro(
  viagemId: string,
  dataDia: string,
  item: Hospedagem | Atividade,
  tipo: "hotel" | "passeio"
): Promise<void> {
  emitLog(`REQUEST: Injetando item [${item.nome}] (${tipo}) no dia ${dataDia}...`);

  await garantirViagemNoFirestore(viagemId);

  // 1. Sempre persistir localmente no LocalStorage primeiro para resposta imediata
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
      const jaExiste = roteiro[dataDia].atividades.some(a => a.nome === item.nome && a.valor === (item as Atividade).valor);
      if (!jaExiste) {
        roteiro[dataDia].atividades.push(item as Atividade);
      }
    }

    localStorage.setItem(key, JSON.stringify(roteiro));
    emitLog(`SIMULATOR: Item (${tipo}) persistido localmente com sucesso.`);
  }

  // 2. Sincronizar em background com o Firestore
  if (isFirebaseConfigured && db) {
    try {
      if (tipo === "hotel") {
        const docRef = doc(db, "viagens", viagemId, "hoteis", dataDia);
        emitLog(`FIRESTORE: setDoc(docRef, hospedagem) no dia ${dataDia}...`);
        await withTimeout(
          setDoc(docRef, {
            nome: item.nome,
            preco_diario: (item as Hospedagem).preco_diario,
            link: item.link
          }),
          4000,
          "Tempo limite esgotado ao salvar hospedagem no Firestore."
        );
      } else {
        const colRef = collection(db, "viagens", viagemId, "passeios");
        const docRef = doc(colRef);
        emitLog(`FIRESTORE: setDoc(docRef, passeio) no dia ${dataDia}...`);
        await withTimeout(
          setDoc(docRef, {
            diaId: dataDia,
            nome: item.nome,
            valor: (item as Atividade).valor,
            link: item.link,
            criado_em: Timestamp.now()
          }),
          4000,
          "Tempo limite esgotado ao salvar atividade no Firestore."
        );
      }
      emitLog(`FIRESTORE: Item (${tipo}) sincronizado com sucesso no Firestore.`);
    } catch (error) {
      const err = error as { code?: string; message?: string };
      emitLog(`FIRESTORE ERROR: Falha na sincronização. Detalhe: ${err?.message || error}`);
      console.error(error);
    }
  }
}

export async function atualizarHospedagemDia(viagemId: string, dataDia: string, hospedagem: Hospedagem): Promise<void> {
  return injetarItemNoRoteiro(viagemId, dataDia, hospedagem, "hotel");
}

export async function adicionarAtividadeDia(viagemId: string, dataDia: string, atividade: Atividade): Promise<void> {
  return injetarItemNoRoteiro(viagemId, dataDia, atividade, "passeio");
}

/**
 * Remove uma atividade pelo índice no dia correspondente.
 */
export async function removerAtividadeDia(viagemId: string, dataDia: string, atividadeIndex: number): Promise<void> {
  emitLog(`REQUEST: Removendo atividade no índice ${atividadeIndex} do dia ${dataDia}...`);

  await garantirViagemNoFirestore(viagemId);

  if (typeof window !== "undefined") {
    const key = `${MOCK_ITINERARY_PREFIX}${viagemId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const roteiro: Record<string, RoteiroDiario> = JSON.parse(raw);
      if (roteiro[dataDia] && roteiro[dataDia].atividades) {
        const removida = roteiro[dataDia].atividades.splice(atividadeIndex, 1);
        localStorage.setItem(key, JSON.stringify(roteiro));
        emitLog(`SIMULATOR: Atividade '${removida[0]?.nome}' excluída localmente.`);
      }
    }
  }

  if (isFirebaseConfigured && db) {
    try {
      const snapshot = await withTimeout(
        getDocs(collection(db, "viagens", viagemId, "passeios")),
        4000,
        "Tempo limite esgotado ao ler atividades para remoção."
      );

      interface PasseioDoc {
        id: string;
        diaId: string;
        nome: string;
        valor: number;
        link: string;
        criado_em?: { seconds: number; nanoseconds: number } | null;
      }

      const diaPasseios = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            diaId: data.diaId || "",
            nome: data.nome || "",
            valor: Number(data.valor) || 0,
            link: data.link || "",
            criado_em: data.criado_em || null
          } as PasseioDoc;
        })
        .filter((p) => p.diaId === dataDia)
        .sort((a, b) => {
          const tA = a.criado_em?.seconds || 0;
          const tB = b.criado_em?.seconds || 0;
          return tA - tB;
        });

      if (atividadeIndex >= 0 && atividadeIndex < diaPasseios.length) {
        const passeioParaDeletar = diaPasseios[atividadeIndex];
        const docRef = doc(db, "viagens", viagemId, "passeios", passeioParaDeletar.id);
        await withTimeout(deleteDoc(docRef), 4500, "Erro ao remover do Firestore.");
        emitLog(`FIRESTORE: Atividade removida com sucesso no Firestore.`);
      }
    } catch (error) {
      console.error(error);
    }
  }
}

/**
 * Remove a hospedagem de um dia específico.
 */
export async function removerHospedagemDia(viagemId: string, dataDia: string): Promise<void> {
  emitLog(`REQUEST: Excluindo hospedagem vinculada ao dia ${dataDia}...`);

  await garantirViagemNoFirestore(viagemId);

  if (typeof window !== "undefined") {
    const key = `${MOCK_ITINERARY_PREFIX}${viagemId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const roteiro: Record<string, RoteiroDiario> = JSON.parse(raw);
      if (roteiro[dataDia]) {
        roteiro[dataDia].hospedagem = null;
        localStorage.setItem(key, JSON.stringify(roteiro));
        emitLog(`SIMULATOR: Hospedagem desvinculada localmente.`);
      }
    }
  }

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "viagens", viagemId, "hoteis", dataDia);
      await withTimeout(deleteDoc(docRef), 4000, "Erro ao remover hospedagem do Firestore.");
      emitLog(`FIRESTORE: Hospedagem desvinculada no Firestore.`);
    } catch (error) {
      console.error(error);
    }
  }
}

/**
 * JOB transacional de recotação sob demanda.
 */
export async function atualizarCotacoesOnDemand(viagemId: string): Promise<void> {
  emitLog(`REQUEST: Iniciando JOB sob demanda para recotação de Viagem ID: ${viagemId}...`);

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

    if (diario.hospedagem) {
      const precoAntigo = diario.hospedagem.preco_diario;
      const fator = 0.88 + Math.random() * 0.24;
      const precoNovo = Math.max(80, Math.round(precoAntigo * fator));

      if (precoNovo !== precoAntigo) {
        diario.hospedagem.preco_diario = precoNovo;
        updates.hospedagem = diario.hospedagem;
        alterouDia = true;
      }
    }

    if (diario.atividades && diario.atividades.length > 0) {
      const novasAtividades = diario.atividades.map((atv) => {
        const valorAntigo = atv.valor;
        const fator = 0.94 + Math.random() * 0.12;
        const valorNovo = Math.max(20, Math.round(valorAntigo * fator));

        if (valorNovo !== valorAntigo) {
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

    if (alterouDia) {
      alterouAlgum = true;
      if (isFirebaseConfigured && db) {
        try {
          if (updates.hospedagem) {
            const docRef = doc(db, "viagens", viagemId, "hoteis", dia);
            await setDoc(docRef, {
              nome: updates.hospedagem.nome,
              preco_diario: updates.hospedagem.preco_diario,
              link: updates.hospedagem.link
            });
          }
          if (updates.atividades) {
            for (const atv of updates.atividades) {
              if (atv.id) {
                const docRef = doc(db, "viagens", viagemId, "passeios", atv.id);
                await updateDoc(docRef, { valor: atv.valor });
              }
            }
          }
        } catch (error) {
          console.error("Erro no JOB Firestore:", error);
        }
      }
    }
  }

  if (alterouAlgum && typeof window !== "undefined") {
    const key = `${MOCK_ITINERARY_PREFIX}${viagemId}`;
    localStorage.setItem(key, JSON.stringify(roteiro));
  }

  emitLog("SYSTEM: JOB de atualização de cotações concluído.");
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
      const docSnap = await withTimeout(getDoc(docRef), 3000, "Erro ao verificar existência no Firestore.");

      const record = {
        origem,
        destino,
        data_inicio: dataInicio,
        data_fim: dataFim,
        orcamento_maximo: orcamento,
        usuario_id: "operator-01",
      };

      if (docSnap.exists()) {
        await withTimeout(updateDoc(docRef, record), 4000, "Erro ao atualizar no Firestore.");
      } else {
        await withTimeout(setDoc(docRef, { ...record, criado_em: Timestamp.now() }), 4000, "Erro ao criar no Firestore.");
      }

      const dias = gerarDiasPeriodo(dataInicio, dataFim);
      for (const dia of dias) {
        const roteiroDocRef = doc(db, "viagens", id, "roteiros", dia);
        const roteiroSnap = await getDoc(roteiroDocRef);
        if (!roteiroSnap.exists()) {
          await setDoc(roteiroDocRef, { cronograma_horario: {} });
        }
      }

      emitLog(`FIRESTORE: Viagem ID ${id} atualizada com sucesso.`);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

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
        emitLog(`SIMULATOR: Viagem ID ${id} atualizada localmente.`);
      }
    }
  }
}

/**
 * Exclui uma viagem do Firestore ou LocalStorage.
 */
export async function deletarViagem(viagemId: string): Promise<void> {
  emitLog(`REQUEST: Excluindo viagem ID: ${viagemId} do banco de dados...`);

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "viagens", viagemId);
      await withTimeout(deleteDoc(docRef), 4000, "Timeout ao deletar do Firestore.");
      emitLog(`FIRESTORE: Viagem ID ${viagemId} excluída com sucesso.`);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(MOCK_TRIPS_KEY);
    if (raw) {
      const viagens: Viagem[] = JSON.parse(raw);
      const filtradas = viagens.filter((v) => v.id !== viagemId);
      localStorage.setItem(MOCK_TRIPS_KEY, JSON.stringify(filtradas));
      localStorage.removeItem(`${MOCK_ITINERARY_PREFIX}${viagemId}`);
      emitLog(`SIMULATOR: Viagem ID ${viagemId} removida localmente.`);
    }
  }
}

/**
 * Sincroniza o cronograma de horários inline.
 */
export async function atualizarCronogramaHorario(
  viagemId: string,
  dataDia: string,
  cronograma: Record<string, string>
): Promise<void> {
  emitLog(`REQUEST: Sincronizando cronograma horário do dia ${dataDia}...`);

  await garantirViagemNoFirestore(viagemId);

  if (typeof window !== "undefined") {
    const key = `${MOCK_ITINERARY_PREFIX}${viagemId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const roteiro: Record<string, RoteiroDiario> = JSON.parse(raw);
      if (!roteiro[dataDia]) roteiro[dataDia] = { hospedagem: null, atividades: [] };
      roteiro[dataDia].cronograma_horario = cronograma;
      localStorage.setItem(key, JSON.stringify(roteiro));
    }
  }

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "viagens", viagemId, "roteiros", dataDia);
      await withTimeout(setDoc(docRef, { cronograma_horario: cronograma }, { merge: true }), 4000, "Erro ao salvar cronograma.");
      emitLog(`FIRESTORE: Cronograma horário salvo com sucesso.`);
    } catch (error) {
      console.error(error);
    }
  }
}

/**
 * Adiciona uma despesa customizada diária.
 */
export async function adicionarDespesaDia(
  viagemId: string,
  dataDia: string,
  despesa: Omit<Despesa, "id" | "diaId">
): Promise<void> {
  emitLog(`REQUEST: Adicionando despesa [${despesa.nome}] no dia ${dataDia}...`);

  await garantirViagemNoFirestore(viagemId);
  const tempId = "exp_" + Math.random().toString(36).substring(2, 9);

  if (typeof window !== "undefined") {
    const key = `${MOCK_ITINERARY_PREFIX}${viagemId}`;
    const raw = localStorage.getItem(key);
    const roteiro: Record<string, RoteiroDiario> = raw ? JSON.parse(raw) : {};

    if (!roteiro[dataDia]) roteiro[dataDia] = { hospedagem: null, atividades: [], despesas: [], cronograma_horario: {} };
    if (!roteiro[dataDia].despesas) roteiro[dataDia].despesas = [];

    roteiro[dataDia].despesas.push({
      id: tempId,
      diaId: dataDia,
      nome: despesa.nome,
      valor: despesa.valor,
      categoria: despesa.categoria,
      criado_em: new Date().toISOString()
    });

    localStorage.setItem(key, JSON.stringify(roteiro));
  }

  if (isFirebaseConfigured && db) {
    try {
      const colRef = collection(db, "viagens", viagemId, "despesas");
      const docRef = doc(colRef);
      await withTimeout(
        setDoc(docRef, {
          diaId: dataDia,
          nome: despesa.nome,
          valor: despesa.valor,
          categoria: despesa.categoria,
          criado_em: Timestamp.now()
        }),
        4000,
        "Erro ao salvar despesa no Firestore."
      );
      emitLog("FIRESTORE: Despesa sincronizada com sucesso.");
    } catch (error) {
      console.error(error);
    }
  }
}

/**
 * Remove uma despesa customizada pelo ID.
 */
export async function removerDespesaDia(viagemId: string, dataDia: string, despesaId: string): Promise<void> {
  emitLog(`REQUEST: Removendo despesa ID ${despesaId} do dia ${dataDia}...`);

  await garantirViagemNoFirestore(viagemId);

  if (typeof window !== "undefined") {
    const key = `${MOCK_ITINERARY_PREFIX}${viagemId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const roteiro: Record<string, RoteiroDiario> = JSON.parse(raw);
      if (roteiro[dataDia] && roteiro[dataDia].despesas) {
        roteiro[dataDia].despesas = roteiro[dataDia].despesas.filter(d => d.id !== despesaId);
        localStorage.setItem(key, JSON.stringify(roteiro));
      }
    }
  }

  if (isFirebaseConfigured && db) {
    try {
      if (!despesaId.startsWith("exp_")) {
        const docRef = doc(db, "viagens", viagemId, "despesas", despesaId);
        await withTimeout(deleteDoc(docRef), 4000, "Erro ao deletar despesa.");
      } else {
        const snapshot = await getDocs(collection(db, "viagens", viagemId, "despesas"));
        const match = snapshot.docs.find(d => d.data().diaId === dataDia);
        if (match) {
          await deleteDoc(doc(db, "viagens", viagemId, "despesas", match.id));
        }
      }
      emitLog("FIRESTORE: Despesa excluída com sucesso.");
    } catch (error) {
      console.error(error);
    }
  }
}