import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let fileInfo = { filename: "Unknown", language: "Unknown", code: "" };
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const { code, language, filename } = await req.json();
    
    fileInfo = { filename: filename || "Unknown", language: language || "Unknown", code: code || "" };

    if (!code || !filename) {
      return NextResponse.json({ error: "Missing code or filename" }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({
        readme: `File: ${filename}\nLanguage: ${language || "Unknown"}\n\nREADME generation could not be completed automatically (Missing API Key).\nThe file is included in the ZIP so you can inspect it manually.`,
        annotatedCode: code
      });
    }

    const truncatedCode = code.slice(0, 15000);

    const systemPrompt = `You are a Senior Staff Software Engineer generating professional documentation and code annotations.
Your job is to read the provided source code file and return a highly detailed, professional README AND an annotated version of the code.

RULES FOR ANNOTATED CODE:
1. You MUST use the correct comment syntax for the specific programming language (e.g. \`//\` or \`/* */\` for JS/TS/C++, \`#\` for Python/Ruby, \`<!-- -->\` for HTML, \`--\` for SQL).
2. DO NOT add comments to every single line. Only comment on important logic, functions, classes, complex algorithms, or API calls.
3. DO NOT rewrite, mutate, rename, or change the logic of the original code in any way. The code must remain exactly the same, just with explanatory comments added around it.

Respond ONLY with a raw, valid JSON object containing exactly two keys:
{
  "readme": "Highly detailed, professional markdown documentation containing: Overview, Architecture, Functions/Classes deep dive, Dependencies, and Usage Context based on the actual code.",
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
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let rawContent = data.choices[0]?.message?.content?.trim() || "{}";
    
    // Sanitize markdown fences from the response
    rawContent = rawContent.replace(/^```(json)?/i, '').replace(/```$/i, '').trim();
    
    let result;
    try {
      result = JSON.parse(rawContent);
    } catch (e) {
      console.error("Failed to parse JSON from AI response:", e);
      result = { readme: rawContent, annotatedCode: code };
    }

    return NextResponse.json({ 
      readme: result.readme || "No detailed documentation generated.",
      annotatedCode: result.annotatedCode || code
    });
  } catch (error: any) {
    console.error("Error generating README:", error);
    return NextResponse.json({
      readme: `File: ${fileInfo.filename}\nLanguage: ${fileInfo.language}\n\nREADME generation failed due to an error: ${error.message}\n\nFile size: ${fileInfo.code.length} bytes\n\nThe original file is still included in the ZIP.`,
      annotatedCode: fileInfo.code
    });
  }
}
