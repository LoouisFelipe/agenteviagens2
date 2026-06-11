import { NextRequest, NextResponse } from "next/server";
import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";

// Ensure GEMINI_API_KEY is populated from GOOGLE_GENAI_API_KEY
if (!process.env.GEMINI_API_KEY && process.env.GOOGLE_GENAI_API_KEY) {
  process.env.GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;
}

// Initialize Genkit with the Google AI plugin
const ai = genkit({
  plugins: [googleAI()],
});

const ItinerarySchema = z.object({
  hospedagem: z.object({
    nome: z.string().describe("Name of the recommended hotel or lodging"),
    preco_diario: z.number().describe("Estimated daily price in BRL"),
    link: z.string().describe("Search link or Google Travel search URL for this lodging"),
  }),
  atividades: z.array(
    z.object({
      dia: z.string().describe("The date of this activity in YYYY-MM-DD format"),
      nome: z.string().describe("Name of the recommended activity/tour"),
      valor: z.number().describe("Estimated price of this activity per person in BRL"),
      link: z.string().describe("Search link or official URL for the activity"),
    })
  ).describe("List of activities mapped to specific days"),
});

export async function POST(req: NextRequest) {
  try {
    const { destination, origin, data_inicio, data_fim, orcamento } = await req.json();

    if (!destination || !data_inicio || !data_fim) {
      return NextResponse.json(
        { error: "Destination, data_inicio, and data_fim are required." },
        { status: 400 }
      );
    }

    const prompt = `You are an expert travel planner. Create a daily itinerary for a trip from "${origin || "unknown origin"}" to "${destination}" starting on "${data_inicio}" and ending on "${data_fim}". 
    The total budget is R$ ${orcamento || "flexible"}.
    Recommend one main lodging (hospedagem) for the entire stay, and at least one key activity/tour for each day of the trip.
    Provide realistic estimated prices in BRL (R$).
    Ensure dates in the activities array exactly match the YYYY-MM-DD format of each day between "${data_inicio}" and "${data_fim}" inclusive.
    The response must strictly follow the output schema.`;

    const response = await ai.generate({
      model: googleAI.model("gemini-2.5-flash"),
      prompt,
      output: {
        schema: ItinerarySchema,
      },
    });

    if (!response.output) {
      return NextResponse.json({ error: "Failed to generate itinerary content." }, { status: 500 });
    }

    return NextResponse.json(response.output);
  } catch (error) {
    console.error("Error generating itinerary:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
