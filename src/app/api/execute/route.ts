import { NextResponse } from "next/server";

// Cache for Piston runtimes to avoid fetching on every request
let runtimesCache: { language: string; version: string; aliases: string[] }[] | null = null;

async function getPistonRuntimes() {
  if (runtimesCache) return runtimesCache;
  try {
    const res = await fetch("https://emkc.org/api/v2/piston/runtimes");
    if (res.ok) {
      runtimesCache = await res.json();
      return runtimesCache;
    }
  } catch (error) {
    console.error("Failed to fetch Piston runtimes:", error);
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const { code, language, stdin = "" } = await req.json();

    if (!code || !code.trim()) {
      return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }

    // Map our frontend language names to Piston language names
    const languageMap: Record<string, string> = {
      python: "python",
      javascript: "javascript",
      typescript: "typescript",
      cpp: "c++",
      c: "c",
      java: "java",
      csharp: "csharp",
      go: "go",
      rust: "rust",
      php: "php",
      ruby: "ruby",
      swift: "swift",
      kotlin: "kotlin",
    };

    const pistonLang = languageMap[language];
    if (!pistonLang) {
      return NextResponse.json(
        { error: `Language "${language}" execution is not supported.` },
        { status: 400 }
      );
    }

    const runtimes = await getPistonRuntimes();
    if (!runtimes) {
      return NextResponse.json(
        { error: "Execution service (Piston API) is currently unavailable." },
        { status: 503 }
      );
    }

    // Find the matching runtime
    const runtime = runtimes.find(
      (r) => r.language === pistonLang || r.aliases.includes(pistonLang)
    );

    if (!runtime) {
      return NextResponse.json(
        { error: `No execution environment found for "${language}".` },
        { status: 400 }
      );
    }

    // Call Piston API
    const response = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: runtime.language,
        version: runtime.version,
        files: [{ name: `main.${language}`, content: code }],
        stdin: stdin,
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Execution failed with status ${response.status}` },
        { status: 500 }
      );
    }

    const data = await response.json();

    if (data.message) {
      return NextResponse.json({ error: data.message }, { status: 400 });
    }

    // Format output to match our expected format
    return NextResponse.json(
      {
        stdout: data.run?.stdout || "",
        stderr: data.run?.stderr || data.compile?.stderr || "",
        exitCode: data.run?.code ?? 1,
        cloud: true,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("API Execute Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute code" },
      { status: 500 }
    );
  }
}
