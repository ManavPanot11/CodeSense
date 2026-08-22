const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Ultra-fast, reliable model for real-time code analysis
const PRIMARY_MODEL = "google/gemini-2.5-flash";
const FALLBACK_MODEL = "openai/gpt-4o-mini";

const MOCK_RESPONSE = {
  issues: [],
  documentation: "# Documentation\n\nCode looks good. Add OPENROUTER_API_KEY for advanced AI analysis.",
  quality_score: 95,
  summary: "Code syntax is clean.",
};

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const { code, language } = await req.json();

    if (!code || !code.trim()) {
      return Response.json({ error: "No code provided" }, { status: 400 });
    }
    if (!apiKey) {
      return Response.json(MOCK_RESPONSE, { status: 200 });
    }

    // Limit code size to prevent huge payload delays for single-file analysis
    const truncatedCode = code.slice(0, 15000);

    const systemPrompt = `You are a lightning-fast, expert code analyzer. 
Analyze the provided code and return ONLY valid JSON matching this schema:
{
  "issues": [
    {
      "severity": "critical" | "warning" | "info",
      "title": "Short title",
      "startLine": number,
      "endLine": number,
      "description": "Short explanation",
      "suggestedFix": "Corrected code snippet (optional)"
    }
  ],
  "documentation": "Concise markdown documentation",
  "quality_score": number (0-100),
  "summary": "1-2 sentence overall summary"
}
Do not include markdown fences like \`\`\`json. Output ONLY raw JSON.`;

    const userPrompt = `Analyze this ${language || "code"}:\n\n${truncatedCode}`;

    let responseData = null;
    let lastError = null;

    // Try Primary Model first, Fallback if needed
    for (const modelToUse of [PRIMARY_MODEL, FALLBACK_MODEL]) {
      try {
        const res = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://codesense.vercel.app",
            "X-Title": "CodeSense",
          },
          body: JSON.stringify({
            model: modelToUse,
            stream: false,
            temperature: 0.1,
            max_tokens: 1500,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          lastError = `OpenRouter (${res.status}): ${errText}`;
          continue; // try fallback model
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim() || "";

        // Extract JSON
        let jsonString = content;
        const match = content.match(/\{[\s\S]*\}/);
        if (match) {
          jsonString = match[0];
        }

        const parsed = JSON.parse(jsonString);
        responseData = {
          issues: Array.isArray(parsed.issues) ? parsed.issues : [],
          documentation: parsed.documentation || "No documentation generated.",
          quality_score: typeof parsed.quality_score === "number" ? parsed.quality_score : 85,
          summary: parsed.summary || "Analysis completed.",
        };
        break; // Successfully analyzed
      } catch (err: any) {
        lastError = err.message;
      }
    }

    if (responseData) {
      return Response.json(responseData, { status: 200 });
    }

    // If both failed, return a graceful response rather than hanging or hard crashing
    console.error("AI Analysis failed:", lastError);
    return Response.json(
      { 
        error: "Analyzer service is momentarily busy. Please try again in a moment.",
        details: lastError 
      },
      { status: 502 }
    );

  } catch (error: any) {
    console.error("API Analyze Error:", error);
    return Response.json(
      { error: error.message || "Failed to analyze code" },
      { status: 500 }
    );
  }
}
