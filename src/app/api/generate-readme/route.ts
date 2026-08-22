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

    const systemPrompt = `You are a technical documentation assistant.
Your job is to read the provided source code file and generate a concise, useful README text describing what it actually does.

Format your response EXACTLY like this example, but adapted to the ACTUAL CONTENT of the code:

File: [filename]
Language: [language]

Purpose:
[A short paragraph explaining the main purpose of the file]

What the code does:
- [bullet point 1]
- [bullet point 2]
- [bullet point 3]

Important functions/classes:
- [function 1]
- [class 1]

Notes:
- [Any important notes, dependencies, or interesting observations]

CRITICAL RULES:
- Base the description ONLY on the provided code.
- Be concise.
- Output ONLY the plain text format above, without any markdown formatting blocks like \`\`\`. Do not write conversational filler.`;

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
        temperature: 0.1,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    const readmeContent = data.choices[0]?.message?.content?.trim() || "";

    return NextResponse.json({ readme: readmeContent });
  } catch (error) {
    console.error("Error generating README:", error);
    // Silent fallback
    return NextResponse.json({
      readme: `README generation failed due to an error.\nThe file is included in the ZIP so you can inspect it manually.`
    });
  }
}
