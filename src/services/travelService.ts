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
 * Retorna todo o roteiro diário agrupado por data do dia.
 */
export async function obterRoteiroDiario(viagemId: string): Promise<Record<string, RoteiroDiario>> {
  emitLog(`REQUEST: Solicitando itinerário diário para a viagem ID: ${viagemId}...`);
  const roteiro: Record<string, RoteiroDiario> = {};

  // 1. Sempre ler do LocalStorage primeiro para ter a resposta instantânea e persistente localmente
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(`${MOCK_ITINERARY_PREFIX}${viagemId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, RoteiroDiario>;
      Object.assign(roteiro, parsed);
      emitLog(`SIMULATOR: Roteiro inicializado do LocalStorage contendo ${Object.keys(parsed).length} dias.`);
    }
  }

  // 2. Mesclar de forma transparente com os dados do Firestore se estiver configurado e online
  if (isFirebaseConfigured && db) {
    try {
      emitLog(`FIRESTORE: Iniciando carregamento paralelo das subcoleções (hoteis, passeios, roteiros)...`);
      const [hoteisSnap, passeiosSnap, roteirosSnap] = await withTimeout(
        Promise.all([
          getDocs(collection(db, "viagens", viagemId, "hoteis")),
          getDocs(collection(db, "viagens", viagemId, "passeios")),
          getDocs(collection(db, "viagens", viagemId, "roteiros"))
        ]),
        5000,
        "Tempo limite esgotado ao buscar subcoleções do roteiro diário."
      );

      // Processar roteiros/cronogramas
      roteirosSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const diaId = docSnap.id;
        if (!roteiro[diaId]) {
          roteiro[diaId] = { hospedagem: null, atividades: [], cronograma_horario: {} };
        }
        roteiro[diaId].cronograma_horario = {
          ...roteiro[diaId].cronograma_horario,
          ...(data.cronograma_horario || {})
        };
      });

      // Processar hospedagem/hotéis
      hoteisSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const diaId = docSnap.id;
        if (!roteiro[diaId]) {
          roteiro[diaId] = { hospedagem: null, atividades: [], cronograma_horario: {} };
        }
        roteiro[diaId].hospedagem = {
          nome: data.nome || "",
          preco_diario: Number(data.preco_diario) || 0,
          link: data.link || ""
        };
      });

      // Processar passeios/atividades
      interface TempPasseio {
        id: string;
        nome: string;
        valor: number;
        link: string;
        criado_em?: { seconds: number; nanoseconds: number } | null;
      }
      
      const passeiosPorDia: Record<string, Array<TempPasseio>> = {};
      
      passeiosSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const diaId = data.diaId;
        if (!diaId) return;

        if (!passeiosPorDia[diaId]) {
          passeiosPorDia[diaId] = [];
        }
        passeiosPorDia[diaId].push({
          id: docSnap.id,
          nome: data.nome || "",
          valor: Number(data.valor) || 0,
          link: data.link || "",
          criado_em: data.criado_em || null
        });
      });

      Object.keys(passeiosPorDia).forEach((diaId) => {
        const passeiosOrdenados = passeiosPorDia[diaId].sort((a, b) => {
          const tA = a.criado_em?.seconds || 0;
          const tB = b.criado_em?.seconds || 0;
          return tA - tB;
        });

        if (!roteiro[diaId]) {
          roteiro[diaId] = { hospedagem: null, atividades: [], cronograma_horario: {} };
        }
        roteiro[diaId].atividades = passeiosOrdenados.map((p) => ({
          id: p.id,
          nome: p.nome,
          valor: p.valor,
          link: p.link
        }));
      });

      emitLog(`FIRESTORE: Dados do Firestore mesclados com sucesso no itinerário diário.`);
    } catch (error) {
      const err = error as { code?: string; message?: string };
      emitLog(`FIRESTORE ERROR: Falha ao recuperar subcoleções estruturadas. Detalhe: ${err?.message || error}`);
      console.error(error);
    }
  }

  return roteiro;
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

  // 1. Sempre persistir localmente no LocalStorage primeiro para resposta imediata e resiliência total
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
      // Evita duplicados em inserções concorrentes
      const jaExiste = roteiro[dataDia].atividades.some(a => a.nome === item.nome && a.valor === (item as Atividade).valor);
      if (!jaExiste) {
        roteiro[dataDia].atividades.push(item as Atividade);
      }
    }
    
    localStorage.setItem(key, JSON.stringify(roteiro));
    emitLog(`SIMULATOR: Item (${tipo}) persistido localmente com sucesso.`);
  }

  // 2. Sincronizar em background com o Firestore (se configurado)
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
      // Não relança o erro para evitar a reversão da UI local que já foi salva
    }
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

  // 1. Sempre remover do LocalStorage primeiro para resposta visual instantânea e garantida
  if (typeof window !== "undefined") {
    const key = `${MOCK_ITINERARY_PREFIX}${viagemId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const roteiro: Record<string, RoteiroDiario> = JSON.parse(raw);
      if (roteiro[dataDia] && roteiro[dataDia].atividades) {
        const removida = roteiro[dataDia].atividades.splice(atividadeIndex, 1);
        localStorage.setItem(key, JSON.stringify(roteiro));
        emitLog(`SIMULATOR: Atividade '${removida[0]?.nome}' excluída localmente com sucesso.`);
      }
    }
  }

  // 2. Sincronizar em background com o Firestore (se configurado)
  if (isFirebaseConfigured && db) {
    try {
      emitLog(`FIRESTORE: Carregando todos os passeios da viagem para localizar o índice...`);
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
        emitLog(`FIRESTORE: deletando passeio ID ${passeioParaDeletar.id} ('${passeioParaDeletar.nome}') no dia ${dataDia}...`);
        await withTimeout(
          deleteDoc(docRef),
          4500,
          "Tempo limite esgotado ao remover atividade do Firestore."
        );
        emitLog(`FIRESTORE: Atividade removida com sucesso no Firestore.`);
      }
    } catch (error) {
      const err = error as { code?: string; message?: string };
      emitLog(`FIRESTORE ERROR: Falha ao deletar atividade. Detalhe: ${err?.message || error}`);
      console.error(error);
    }
  }
}

/**
 * Remove a hospedagem de um dia específico.
 */
export async function removerHospedagemDia(viagemId: string, dataDia: string): Promise<void> {
  emitLog(`REQUEST: Excluindo hospedagem vinculada ao dia ${dataDia}...`);

  // 1. Sempre remover localmente do LocalStorage primeiro para resposta imediata
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

  // 2. Sincronizar em background com o Firestore (se configurado)
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "viagens", viagemId, "hoteis", dataDia);
      emitLog(`FIRESTORE: deleteDoc(docRef) no dia ${dataDia}...`);
      await withTimeout(
        deleteDoc(docRef),
        4000,
        "Tempo limite esgotado ao remover hospedagem do Firestore."
      );
      emitLog(`FIRESTORE: Hospedagem desvinculada no Firestore.`);
    } catch (error) {
      const err = error as { code?: string; message?: string };
      emitLog(`FIRESTORE ERROR: Falha ao deletar hospedagem. Detalhe: ${err?.message || error}`);
      console.error(error);
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
          if (updates.hospedagem) {
            const docRef = doc(db, "viagens", viagemId, "hoteis", dia);
            await withTimeout(
              setDoc(docRef, {
                nome: updates.hospedagem.nome,
                preco_diario: updates.hospedagem.preco_diario,
                link: updates.hospedagem.link
              }),
              4000,
              "Tempo limite esgotado ao atualizar cotação de hospedagem."
            );
          }
          if (updates.atividades) {
            for (const atv of updates.atividades) {
              if (atv.id) {
                const docRef = doc(db, "viagens", viagemId, "passeios", atv.id);
                await withTimeout(
                  updateDoc(docRef, { valor: atv.valor }),
                  4000,
                  "Tempo limite esgotado ao atualizar cotação de atividade."
                );
              }
            }
          }
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
        const roteiroDocRef = doc(db, "viagens", id, "roteiros", dia);
        const roteiroSnap = await withTimeout(
          getDoc(roteiroDocRef),
          3000,
          "Erro ao verificar dia do roteiro (Timeout)."
        );
        if (!roteiroSnap.exists()) {
          await withTimeout(
            setDoc(roteiroDocRef, {
              cronograma_horario: {},
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
 * Exclui uma viagem do Firestore ou LocalStorage.
 */
export async function deletarViagem(viagemId: string): Promise<void> {
  emitLog(`REQUEST: Excluindo viagem ID: ${viagemId} do banco de dados...`);

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "viagens", viagemId);
      await withTimeout(
        deleteDoc(docRef),
        4000,
        "Tempo limite esgotado ao deletar viagem do Firestore."
      );
      emitLog(`FIRESTORE: Viagem ID ${viagemId} excluída com sucesso.`);
      return;
    } catch (error) {
      const err = error as { code?: string; message?: string };
      emitLog(`FIRESTORE ERROR: Falha ao deletar viagem. Detalhe: ${err?.message || error}`);
      console.error(error);
      throw error;
    }
  }

  // Fallback para LocalStorage
  emitLog(`SIMULATOR: Deletando viagem ID ${viagemId} no localStorage...`);
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(MOCK_TRIPS_KEY);
    if (raw) {
      const viagens: Viagem[] = JSON.parse(raw);
      const filtradas = viagens.filter((v) => v.id !== viagemId);
      localStorage.setItem(MOCK_TRIPS_KEY, JSON.stringify(filtradas));
      
      // Remove também o roteiro diário local
      localStorage.removeItem(`${MOCK_ITINERARY_PREFIX}${viagemId}`);
      emitLog(`SIMULATOR: Viagem ID ${viagemId} removida localmente.`);
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

  // 1. Sempre persistir localmente no LocalStorage primeiro para resposta imediata
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
      emitLog(`SIMULATOR: Cronograma horário salvo localmente.`);
    }
  }

  // 2. Sincronizar em background com o Firestore (se configurado)
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "viagens", viagemId, "roteiros", dataDia);
      await withTimeout(
        setDoc(docRef, { cronograma_horario: cronograma }, { merge: true }),
        4000,
        "Tempo limite esgotado ao salvar cronograma horário no Firestore."
      );
      emitLog(`FIRESTORE: Cronograma horário salvo com sucesso no Firestore.`);
    } catch (error) {
      const err = error as { code?: string; message?: string };
      emitLog(`FIRESTORE ERROR: Falha ao salvar cronograma no Firestore. Detalhe: ${err?.message || error}`);
      console.error(error);
    }
  }
}
