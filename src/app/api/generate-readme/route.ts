import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const { code, language, filename } = await req.json();

    if (!code || !filename) {
      return NextResponse.json({ error: "Missing code or filename" }, { status: 400 });
    }

    if (!apiKey) {
      // Fallback if no API key
      return NextResponse.json({
        readme: `File: ${filename}\n\nLanguage: ${language || "Unknown"}\n\nREADME generation could not be completed automatically (Missing API Key).\n\nThe file is included in the ZIP so you can inspect it manually.`
      });
    }

    const truncatedCode = code.slice(0, 15000); // Prevent massive payloads

    const systemPrompt = `You are a Senior Staff Software Engineer generating professional documentation and code annotations.
Your job is to read the provided source code file and return a highly detailed, professional README AND an annotated version of the code.

The annotated code must contain injected comments explaining complex logic, architectural decisions, and how different parts are used. You MUST use the correct comment syntax for the specific programming language (e.g. \`//\` or \`/* */\` for JS/TS/C++, \`#\` for Python/Ruby, \`<!-- -->\` for HTML).

Respond ONLY with a raw, valid JSON object containing exactly two keys:
{
  "readme": "Highly detailed, professional markdown documentation containing: Overview, Architecture, Functions/Classes deep dive, Dependencies, and Usage Context.",
  "annotatedCode": "The original code but with your detailed explanatory comments injected throughout."
}
Output strictly valid JSON with no markdown formatting blocks (no \`\`\`json fences).`;

    const userPrompt = `File: ${filename}\nLanguage: ${language || "Unknown"}\n\nCode:\n${truncatedCode}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "CodeSense"
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 8000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    let result;
    try {
      result = JSON.parse(data.choices[0]?.message?.content?.trim() || "{}");
    } catch (e) {
      // If parsing fails, just return what we have as readme
      result = { readme: data.choices[0]?.message?.content?.trim() || "", annotatedCode: code };
    }

    return NextResponse.json({ 
      readme: result.readme || "No detailed documentation generated.",
      annotatedCode: result.annotatedCode || code
    });
  } catch (error) {
    console.error("Error generating README:", error);
    // Silent fallback
    return NextResponse.json({
      readme: `README generation failed due to an error.\nThe file is included in the ZIP so you can inspect it manually.`,
      annotatedCode: null
    });
  }
}
