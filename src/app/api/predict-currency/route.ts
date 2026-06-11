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

const CurrencyPredictionSchema = z.object({
  brlAmount: z.number().describe("The converted amount in BRL (R$)"),
  predictedRate: z.number().describe("The exchange rate used for conversion (1 unit of currency = X BRL)"),
  predictiveTip: z.string().describe("Predictive context tip: what this amount can buy at the destination, local cash vs card advice, and expected rate stability in the next few days"),
});

export async function POST(req: NextRequest) {
  try {
    const { currency, amount, destination } = await req.json();

    if (!currency || !amount) {
      return NextResponse.json(
        { error: "Currency and amount are required." },
        { status: 400 }
      );
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number." },
        { status: 400 }
      );
    }

    const prompt = `Convert ${numAmount} ${currency} to BRL (R$) for a traveler going to "${destination || "their destination"}".
    Predictive analytics task:
    1. Look up or approximate the current exchange rate for ${currency} to BRL.
    2. Convert ${numAmount} ${currency} to BRL.
    3. Generate a predictive tip in Portuguese discussing:
       - What this amount of money represents at "${destination}" (e.g., "In Santiago, this is equivalent to about 2 standard dinners", or "In Paris, this covers 3 museum tickets").
       - Advice on local payment methods (e.g., cash vs card at "${destination}").
       - Short-term exchange rate stability prediction (e.g., "predicted to remain stable", "slight volatility expected").
    
    The response must strictly follow the output schema.`;

    const response = await ai.generate({
      model: googleAI.model("gemini-2.5-flash"),
      prompt,
      output: {
        schema: CurrencyPredictionSchema,
      },
    });

    if (!response.output) {
      return NextResponse.json({ error: "Failed to generate currency prediction content." }, { status: 500 });
    }

    return NextResponse.json(response.output);
  } catch (error) {
    console.error("Error predicting currency:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
