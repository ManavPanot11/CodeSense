const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "nvidia/nemotron-3.5-lightning:free";

const MOCK_RESPONSE = {
  issues: [
    {
      severity: "warning",
      title: "Missing API Key",
      startLine: 1,
      endLine: 1,
      description:
        "No API key configured. Add OPENROUTER_API_KEY to .env.local for real AI analysis.",
      suggestedFix: "// Set OPENROUTER_API_KEY in .env.local",
    },
  ],
  documentation: "# Mock Documentation\n\nSet OPENROUTER_API_KEY to enable real analysis.",
  quality_score: 75,
  summary: "Mock Mode: API key missing.",
};

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const { code, language } = await req.json();

    if (!code) {
      return Response.json({ error: "No code provided" }, { status: 400 });
    }
    if (!apiKey) {
      return Response.json(MOCK_RESPONSE, { status: 200 });
    }

    const systemPrompt = `You are a fast, concise code reviewer. Analyze the given code.
Identify bugs, security vulnerabilities, performance issues, and code smells.
Generate brief documentation.

You MUST respond with ONLY a valid JSON object matching this schema exactly.
Do not include any prose, explanations, or markdown fences (like \`\`\`json). Just the raw JSON object.

Schema:
{
  "issues": [
    {
      "severity": "critical" | "warning" | "info",
      "title": "Short title of the issue",
      "startLine": number,
      "endLine": number,
      "description": "Detailed explanation of the issue",
      "suggestedFix": "Code snippet or text to fix the issue (optional)"
    }
  ],
  "documentation": "Brief markdown documentation for the file",
  "quality_score": number (0-100),
  "summary": "Brief overall summary of the code quality"
}`;

    const userPrompt = `Analyze this ${language} code. Be brief and precise.\n\n\`\`\`${language}\n${code}\n\`\`\``;

    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "CodeSense",
      },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        temperature: 0,
        max_tokens: 4096,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        return Response.json({ error: "Rate limited by OpenRouter. Please try again shortly." }, { status: 429 });
      }
      const errText = await res.text();
      return Response.json({ error: `OpenRouter API error (${res.status}): ${errText}` }, { status: res.status });
    }

    const data = await res.json();
    let content = data.choices?.[0]?.message?.content?.trim() || "";

    // Defensive parsing: find the first { and last } to extract JSON
    let jsonString = content;
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      jsonString = match[0];
    }

    try {
      const parsed = JSON.parse(jsonString);
      return Response.json(parsed, { status: 200 });
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      return Response.json({ error: "Analysis failed to produce valid JSON. Please try again." }, { status: 500 });
    }

  } catch (error: any) {
    console.error("API Analyze Error:", error);
    return Response.json(
      { error: error.message || "Failed to analyze code" },
      { status: 500 }
    );
  }
}
