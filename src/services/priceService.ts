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
      { nome: "Hotel Plaza San Francisco", preco_diario: 480, link: "https://plazasanfrancisco.cl" },
      { nome: "Solace Hotel Providencia", preco_diario: 560, link: "https://solacehotel.cl" },
      { nome: "The Singular Hotel Santiago", preco_diario: 920, link: "https://thesingular.com" },
      { nome: "Hostal Forestal Eco Lodge", preco_diario: 180, link: "https://hostalforestal.cl" },
      { nome: "W Santiago Luxury Suites", preco_diario: 850, link: "https://marriott.com" },
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
