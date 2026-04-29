import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface EmailResult {
  email: string;
  pattern: string;
  percentage: number;
  likelihood: "high" | "medium" | "low";
  reason?: string;
}

export const generatePermutations = (firstName: string, lastName: string, domain: string): EmailResult[] => {
  const f = firstName.toLowerCase().trim();
  const l = lastName.toLowerCase().trim();
  const d = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim();

  const patterns = [
    { email: `${f}.${l}@${d}`, pattern: "[first].[last]", percentage: 62.2 },
    { email: `${f}@${d}`, pattern: "[first]", percentage: 28.6 },
    { email: `${f}${l[0]}@${d}`, pattern: "[first][last_initial]", percentage: 2.6 },
    { email: `${f[0]}${l[0]}@${d}`, pattern: "[first_initial][last_initial]", percentage: 2.4 },
    { email: `${f[0]}${l}@${d}`, pattern: "[first_initial][last]", percentage: 1.6 },
    { email: `${l}@${d}`, pattern: "[last]", percentage: 1.1 },
    { email: `${f}${l}@${d}`, pattern: "[first][last]", percentage: 0.9 },
    { email: `${f}.${l[0]}@${d}`, pattern: "[first].[last_initial]", percentage: 0.6 },
  ];

  return patterns.map(p => ({
    ...p,
    likelihood: p.percentage > 50 ? "high" : p.percentage > 10 ? "medium" : "low"
  }));
};

export const predictBestEmails = async (firstName: string, lastName: string, domain: string): Promise<EmailResult[]> => {
  const permutations = generatePermutations(firstName, lastName, domain);
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an expert sales intelligence tool like Apollo.io. 
      Your task is to find the EXACT professional email used by this person.
      
      Person: ${firstName} ${lastName}
      Company Domain: ${domain}
      
      Instructions:
      1. Analyze the domain naming convention for "${domain}".
      2. Identify if there is a single most likely "Verified" email pattern used by this specific organization.
      3. Return a list of predictions. Even if you are unsure, provide the industry-standard Apollo-style prediction.
      4. Include a 'percentage' field reflecting the commonality of that pattern at ${domain}.
      5. Provide a 'reason' why this matches the company's verified standards.
      
      Return results in JSON format with an array of objects.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            predictions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  email: { type: Type.STRING },
                  pattern: { type: Type.STRING },
                  percentage: { type: Type.NUMBER },
                  likelihood: { type: Type.STRING, enum: ["high", "medium", "low"] },
                  reason: { type: Type.STRING }
                },
                required: ["email", "pattern", "percentage", "likelihood"]
              }
            }
          }
        }
      }
    });

    const data = JSON.parse(response.text || '{"predictions": []}');
    return data.predictions.sort((a: any, b: any) => b.percentage - a.percentage);
  } catch (error) {
    console.error("AI Prediction failed:", error);
    return permutations; 
  }
};
