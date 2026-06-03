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

export interface PrecosResultado {
  hospedagens: Hospedagem[];
  atividades: Atividade[];
}

const DATABASE: Record<string, { hospedagens: Hospedagem[]; atividades: Atividade[] }> = {
  santiago: {
    hospedagens: [
      { 
        nome: "Solace Hotel Providencia", 
        preco_diario: 560, 
        link: "https://www.google.com/travel/search?q=Solace%20Hotel%20Providencia%20Santiago&ts=CAESCgoCCAMKAggDEAAqCQoFOgNCUkwaAA&ved=0CAAQ5JsGahgKEwioj5bI49uUAxUAAAAAHQAAAAAQkwI&ictx=3&hl=pt-BR&gl=BR&tcfs=UgRgAXgB&qs=CAAgACgA&ap=MAA" 
      },
      { 
        nome: "Novotel Santiago Providencia", 
        preco_diario: 430, 
        link: "https://www.google.com/travel/search?q=Novotel%20Santiago%20Providencia&ts=CAESCgoCCAMKAggDEAAqCQoFOgNCUkwaAA&ved=0CAAQ5JsGahgKEwioj5bI49uUAxUAAAAAHQAAAAAQkwI&ictx=3&hl=pt-BR&gl=BR&tcfs=UgRgAXgB&qs=CAAgACgA&ap=MAA" 
      },
      { 
        nome: "AC Hotel by Marriott Cenco Costanera", 
        preco_diario: 890, 
        link: "https://www.google.com/travel/search?q=AC%20Hotel%20by%20Marriott%20Santiago%20Cenco%20Costanera&ts=CAESCgoCCAMKAggDEAAqCQoFOgNCUkwaAA&ved=0CAAQ5JsGahgKEwioj5bI49uUAxUAAAAAHQAAAAAQkwI&ictx=3&hl=pt-BR&gl=BR&tcfs=UgRgAXgB&qs=CAAgACgA&ap=MAA" 
      },
      { 
        nome: "Ola Santiago Providencia Tapestry Tapestry Hilton", 
        preco_diario: 680, 
        link: "https://www.google.com/travel/search?q=Ola%20Santiago%20Providencia%20Tapestry%20Collection%20Hilton&ts=CAESCgoCCAMKAggDEAAqCQoFOgNCUkwaAA&ved=0CAAQ5JsGahgKEwioj5bI49uUAxUAAAAAHQAAAAAQkwI&ictx=3&hl=pt-BR&gl=BR&tcfs=UgRgAXgB&qs=CAAgACgA&ap=MAA" 
      },
      { 
        nome: "Hostal Providencia", 
        preco_diario: 150, 
        link: "https://www.google.com/travel/search?q=Hostal%20Providencia%20Santiago&ts=CAESCgoCCAMKAggDEAAqCQoFOgNCUkwaAA&ved=0CAAQ5JsGahgKEwioj5bI49uUAxUAAAAAHQAAAAAQkwI&ictx=3&hl=pt-BR&gl=BR&tcfs=UgRgAXgB&qs=CAAgACgA&ap=MAA" 
      },
    ],
    atividades: [
      { nome: "Tour Premium Concha y Toro", valor: 250, link: "https://conchaytoro.com" },
      { nome: "Excursão Cajón del Maipo & Embalse", valor: 380, link: "https://cajondelmaipo.cl" },
      { nome: "City Tour Histórico Centro", valor: 90, link: "https://santiagocitytour.cl" },
      { nome: "Valle Nevado & Farellones Ski", valor: 420, link: "https://vallenevado.com" },
      { nome: "Bali Hai Dinner Show Folclórico", valor: 310, link: "https://balihai.cl" },
    ],
  },
  "buenos aires": {
    hospedagens: [
      { nome: "Alvear Palace Hotel Luxury", preco_diario: 1100, link: "https://alvearpalace.com" },
      { nome: "NH Collection Centro Histórico", preco_diario: 420, link: "https://nh-hotels.com" },
      { nome: "Selina Palermo Soho Design", preco_diario: 220, link: "https://selina.com" },
      { nome: "Faena Hotel Puerto Madero", preco_diario: 980, link: "https://faena.com" },
    ],
    atividades: [
      { nome: "Madero Tango Dinner & Show", valor: 340, link: "https://maderotango.com" },
      { nome: "Navegação Delta do Tigre Express", valor: 190, link: "https://tigre.gob.ar" },
      { nome: "City Tour La Boca & Recoleta", valor: 85, link: "https://turismo.buenosaires.gob.ar" },
      { nome: "Visita Arquitetônica Teatro Colón", valor: 120, link: "https://teatrocolon.org.ar" },
    ],
  },
  paris: {
    hospedagens: [
      { nome: "Le Bristol Paris Palace", preco_diario: 2400, link: "https://oetkercollection.com" },
      { nome: "Hotel Regina Louvre Paris", preco_diario: 820, link: "https://regina-hotel.com" },
      { nome: "Generator Hostel Canal St Martin", preco_diario: 190, link: "https://generatorhostels.com" },
      { nome: "Hotel Ibis Eiffel Cambronne", preco_diario: 410, link: "https://ibis.com" },
    ],
    atividades: [
      { nome: "Ingresso Prioritário Torre Eiffel", valor: 210, link: "https://toureiffel.paris" },
      { nome: "Cruzeiro Rio Sena Bateaux-Mouches", valor: 95, link: "https://bateaux-mouches.fr" },
      { nome: "Ingresso Guiado Museu do Louvre", valor: 180, link: "https://louvre.fr" },
      { nome: "Tour Completo Palácio de Versalhes", valor: 320, link: "https://chateauversailles.fr" },
    ],
  },
};

export function obterPrecosLocais(destino: string): PrecosResultado {
  // Limpa strings como "Santiago (SCL)" para encontrar matches no dicionário
  const destClean = destino.split("(")[0].trim().toLowerCase();

  // Localiza correspondência exata ou parcial
  let matches = DATABASE[destClean];
  if (!matches) {
    const matchedKey = Object.keys(DATABASE).find(
      (k) => destClean.includes(k) || k.includes(destClean)
    );
    if (matchedKey) {
      matches = DATABASE[matchedKey];
    } else {
      // Fallback dinâmico para qualquer outro destino digitado
      const formattedDest = destino.toUpperCase();
      matches = {
        hospedagens: [
          { nome: `Grand Hotel Central [${formattedDest}]`, preco_diario: 520, link: "https://booking.com" },
          { nome: `Boutique Station Lodge [${formattedDest}]`, preco_diario: 350, link: "https://expedia.com" },
          { nome: `Backpackers Budget Inn [${formattedDest}]`, preco_diario: 150, link: "https://hostelworld.com" },
        ],
        atividades: [
          { nome: `City Tour Histórico [${formattedDest}]`, valor: 110, link: "https://getyourguide.com" },
          { nome: `Excursão Aventura & Trilhas`, valor: 280, link: "https://viator.com" },
          { nome: `Tour Culinário & Gastronomia`, valor: 190, link: "https://tripadvisor.com" },
        ],
      };
    }
  }

  // Introduz flutuação aleatória de mercado sutil (-4% a +4%) para simular scraping ativo
  const variacao = () => 0.96 + Math.random() * 0.08;

  return {
    hospedagens: matches.hospedagens.map((h) => ({
      ...h,
      preco_diario: Math.round(h.preco_diario * variacao()),
    })),
    atividades: matches.atividades.map((p) => ({
      ...p,
      valor: Math.round(p.valor * variacao()),
    })),
  };
}

/**
 * Realiza uma busca semântica simulada por IA, gerando opções dinâmicas
 * baseadas no destino e termo pesquisado (queryStr).
 */
export async function obterPrecosComIA(
  destino: string,
  queryStr: string,
  tipo: "hospedagem" | "atividade"
): Promise<(Hospedagem | Atividade)[]> {
  // Simulamos um pequeno delay de processamento da IA (0.8s a 1.5s)
  await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 700));

  const q = queryStr.trim().toLowerCase();
  const formattedDest = destino.split("(")[0].trim().toUpperCase();

  // Flutuação de preço padrão
  const baseRandom = () => Math.round(100 + Math.random() * 800);

  if (tipo === "hospedagem") {
    // Lista base de hospedagens se a query for vazia
    if (!q) {
      const padrao = obterPrecosLocais(destino).hospedagens;
      return padrao;
    }

    // Gerador semântico para Hospedagens
    const results: Hospedagem[] = [];
    const queryEscaped = encodeURIComponent(`${queryStr} hotel ${destino}`);
    const googleTravelUrl = `https://www.google.com/travel/search?q=${queryEscaped}`;

    // Heurísticas de palavras-chave
    if (q.includes("colorado") || q.includes("farellones") || q.includes("neve") || q.includes("ski")) {
      results.push(
        { nome: `Hotel Colorado Farellones [IA]`, preco_diario: 580, link: googleTravelUrl },
        { nome: `Apartamento Valle Nevado Ski Resort [IA]`, preco_diario: 890, link: googleTravelUrl },
        { nome: `Chalé de Montanha Colorado Premium [IA]`, preco_diario: 950, link: googleTravelUrl },
        { nome: `EcoLodge Cordilheira Refúgio [IA]`, preco_diario: 420, link: googleTravelUrl }
      );
    } else if (q.includes("luxo") || q.includes("luxury") || q.includes("5 estrelas") || q.includes("palace") || q.includes("singular")) {
      results.push(
        { nome: `Grand Hyatt Luxury Residence [IA]`, preco_diario: 1450, link: googleTravelUrl },
        { nome: `The Singular Palace Hotel & Spa [IA]`, preco_diario: 1890, link: googleTravelUrl },
        { nome: `W Santiago Boutique Luxury [IA]`, preco_diario: 1100, link: googleTravelUrl },
        { nome: `Hotel Ritz Carlton Premium [IA]`, preco_diario: 1650, link: googleTravelUrl }
      );
    } else if (q.includes("barato") || q.includes("budget") || q.includes("hostel") || q.includes("albergue") || q.includes("compartilhado")) {
      results.push(
        { nome: `Backpackers Eco Hostel [IA]`, preco_diario: 120, link: googleTravelUrl },
        { nome: `Santiago Central Shared Rooms [IA]`, preco_diario: 95, link: googleTravelUrl },
        { nome: `Providencia Budget Inn [IA]`, preco_diario: 140, link: googleTravelUrl },
        { nome: `Hostal Bellavista Nomad [IA]`, preco_diario: 110, link: googleTravelUrl }
      );
    } else if (q.includes("airbnb") || q.includes("apartamento") || q.includes("apto") || q.includes("loft")) {
      results.push(
        { nome: `Loft Design com Vista para Cordilheira [IA]`, preco_diario: 350, link: googleTravelUrl },
        { nome: `Apartamento Studio em Providencia [IA]`, preco_diario: 280, link: googleTravelUrl },
        { nome: `Duplex Premium Las Condes Airbnb [IA]`, preco_diario: 520, link: googleTravelUrl },
        { nome: `Studio aconchegante no Centro Histórico [IA]`, preco_diario: 210, link: googleTravelUrl }
      );
    } else {
      // Fallback genérico inteligente
      const titleQuery = queryStr.charAt(0).toUpperCase() + queryStr.slice(1);
      results.push(
        { nome: `Hotel ${titleQuery} ${formattedDest} [IA]`, preco_diario: Math.max(180, baseRandom() - 100), link: googleTravelUrl },
        { nome: `Boutique Residence ${titleQuery} [IA]`, preco_diario: Math.max(220, baseRandom() + 150), link: googleTravelUrl },
        { nome: `Acomodação Customizada ${titleQuery} [IA]`, preco_diario: Math.max(150, baseRandom()), link: googleTravelUrl },
        { nome: `Hostal & Suites ${titleQuery} [IA]`, preco_diario: Math.max(110, Math.round(baseRandom() / 3)), link: googleTravelUrl }
      );
    }

    return results;
  } else {
    // Tipo: atividade / passeio
    if (!q) {
      const padrao = obterPrecosLocais(destino).atividades;
      return padrao;
    }

    const results: Atividade[] = [];
    const viatorUrl = (term: string) => `https://www.viator.com/search/${encodeURIComponent(`${term} ${destino}`)}`;

    if (q.includes("colorado") || q.includes("farellones") || q.includes("neve") || q.includes("ski") || q.includes("esqui")) {
      results.push(
        { nome: `Tour de Esqui Valle Nevado & El Colorado [IA]`, valor: 450, link: viatorUrl("Ski Colorado Farellones") },
        { nome: `Ski & Snowboard Equipamentos Rental Colorado [IA]`, valor: 180, link: viatorUrl("Ski Rental Colorado") },
        { nome: `Aula Particular de Ski no Colorado (2h) [IA]`, valor: 390, link: viatorUrl("Ski School Colorado") },
        { nome: `Translado Exclusivo Farellones & Colorado [IA]`, valor: 250, link: viatorUrl("Transfer Colorado") }
      );
    } else if (q.includes("vinicula") || q.includes("vinícola") || q.includes("vinho") || q.includes("wine") || q.includes("concha") || q.includes("toro")) {
      results.push(
        { nome: `Tour Sommelier Premium Concha y Toro [IA]`, valor: 350, link: viatorUrl("Concha y Toro Premium") },
        { nome: `Tour Privado Vinícola Undurraga & Santa Rita [IA]`, valor: 420, link: viatorUrl("Undurraga Santa Rita Tour") },
        { nome: `Boutique Wine Tasting no Vale de Casablanca [IA]`, valor: 580, link: viatorUrl("Casablanca Wine Tasting") },
        { nome: `Sunset & Vinho no Vale do Maipo [IA]`, valor: 310, link: viatorUrl("Maipo Valley Sunset Wine") }
      );
    } else if (q.includes("cajon") || q.includes("cajón") || q.includes("maipo") || q.includes("embalse") || q.includes("yeso") || q.includes("termas") || q.includes("colina")) {
      results.push(
        { nome: `Cajón del Maipo & Embalse El Yeso PicNic [IA]`, valor: 380, link: viatorUrl("Cajon del Maipo Embalse") },
        { nome: `Tour Termas de Colina & Banho Vulcânico [IA]`, valor: 480, link: viatorUrl("Termas de Colina") },
        { nome: `Trekking na Cascata de las Ánimas [IA]`, valor: 290, link: viatorUrl("Cascata de las Animas Trekking") },
        { nome: `Rafting Aventura no Rio Maipo [IA]`, valor: 320, link: viatorUrl("Rafting Rio Maipo") }
      );
    } else if (q.includes("city") || q.includes("tour") || q.includes("historico") || q.includes("histórico") || q.includes("centro") || q.includes("museu")) {
      results.push(
        { nome: `City Tour Histórico Privado com Guia [IA]`, valor: 150, link: viatorUrl("City Tour Santiago") },
        { nome: `Tour Palácio de La Moneda & Museu Pré-Colombino [IA]`, valor: 110, link: viatorUrl("La Moneda Museum Tour") },
        { nome: `Passeio Cerro Santa Lucía & San Cristóbal [IA]`, valor: 95, link: viatorUrl("Cerro San Cristobal Tour") },
        { nome: `Free Walking Tour Santiago Centro [IA]`, valor: 40, link: viatorUrl("Walking Tour Santiago") }
      );
    } else {
      // Fallback genérico inteligente
      const titleQuery = queryStr.charAt(0).toUpperCase() + queryStr.slice(1);
      results.push(
        { nome: `Passeio Guiado ${titleQuery} [IA]`, valor: Math.max(90, Math.round(baseRandom() / 2)), link: viatorUrl(queryStr) },
        { nome: `Excursão Aventura ${titleQuery} em ${formattedDest} [IA]`, valor: Math.max(180, Math.round(baseRandom() / 1.5)), link: viatorUrl(queryStr) },
        { nome: `Experiência Gastronômica & Cultural ${titleQuery} [IA]`, valor: Math.max(120, Math.round(baseRandom() / 1.8)), link: viatorUrl(queryStr) },
        { nome: `Tour Privado Exclusivo: ${titleQuery} [IA]`, valor: Math.max(250, baseRandom()), link: viatorUrl(queryStr) }
      );
    }

    return results;
  }
}

