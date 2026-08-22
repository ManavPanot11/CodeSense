import { NextResponse } from "next/server";
import { execFile, execSync } from "child_process";
import { writeFileSync, unlinkSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const MAX_OUTPUT = 50_000; // 50 KB max output
const TIMEOUT_MS = 10_000; // 10 seconds

/** Find a working Python binary on this machine, or return null. */
function findPython(): string | null {
  const candidates =
    process.platform === "win32"
      ? ["py", "python3", "python"]
      : ["python3", "python"];

  for (const cmd of candidates) {
    try {
      const check = process.platform === "win32" ? "where" : "which";
      const result = execSync(`${check} ${cmd}`, {
        timeout: 3000,
        stdio: ["pipe", "pipe", "pipe"],
      })
        .toString()
        .trim();

      if (result && !result.includes("WindowsApps")) {
        execSync(`${cmd} --version`, { timeout: 3000, stdio: "pipe" });
        return cmd;
      }
    } catch {
      // Not found — try next
    }
  }
  return null;
}

/**
 * Execute code via OpenRouter LLM as a code interpreter fallback.
 * Asks the model to act as a language runtime and return exact stdout/stderr.
 */
async function executeViaLLM(
  code: string,
  language: string,
  stdin: string,
  files: { name: string, content: string }[] = []
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      stdout: "",
      stderr:
        `Local runtime for ${language} is not available and no OPENROUTER_API_KEY is set.\n\n` +
        "To run this code, add an OPENROUTER_API_KEY to .env.local to enable cloud execution.",
      exitCode: 1,
    };
  }

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "CodeSense",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a strict code execution engine for ${language}. Execute the given ${language} code EXACTLY as a real compiler/interpreter would. Return ONLY a JSON object with these fields:
- "stdout": the exact standard output (string)
- "stderr": the exact standard error output (string, empty if no errors)
- "exitCode": 0 for success, 1 for errors (number)

Rules:
- Execute the code faithfully. Do NOT explain the code.
- Capture ALL print output in stdout, preserving newlines.
- If there are runtime or compilation errors, put the trace in stderr.
- Return ONLY raw JSON, no markdown fences, no extra text.
- If standard input is provided, pass it to the program.
- You have access to other files in the workspace. Read them if the code requires them.`,
          },
          {
            role: "user",
            content: `Execute this code:\n\`\`\`${language}\n${code}\n\`\`\`\n\nStandard Input (stdin):\n${stdin}\n\nWorkspace Files:\n${files.map(f => `--- ${f.name} ---\n${f.content}\n`).join("\n")}`,
          },
        ],
        temperature: 0,
        max_tokens: 1000, // Reduced to avoid OpenRouter limits
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    return {
      stdout: "",
      stderr: `OpenRouter API error (${response.status}): ${errText}`,
      exitCode: 1,
    };
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() || "";

  try {
    // Strip markdown fences if present
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    return {
      stdout: parsed.stdout ?? "",
      stderr: parsed.stderr ?? "",
      exitCode: typeof parsed.exitCode === "number" ? parsed.exitCode : 0,
    };
  } catch {
    // If the model didn't return valid JSON, treat the whole response as stdout
    return { stdout: content, stderr: "", exitCode: 0 };
  }
}

export async function POST(req: Request) {
  let tempFile = "";
  try {
    const { code, language, stdin = "", files = [] } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }

    // ── JavaScript / TypeScript — always local ──────────────────────
    if (language === "javascript" || language === "typescript") {
      const dir = mkdtempSync(join(tmpdir(), "codesense-"));
      tempFile = join(dir, "script.js");
      writeFileSync(tempFile, code, "utf8");

      const result = await runLocal(process.execPath, [
        "--max-old-space-size=128",
        tempFile,
      ]);
      try { unlinkSync(tempFile); } catch {}
      return NextResponse.json(result, { status: 200 });
    }

    // ── Python — try local first, fall back to LLM ─────────────────
    if (language === "python") {
      const pythonCmd = findPython();

      if (pythonCmd) {
        // Local Python available
        const dir = mkdtempSync(join(tmpdir(), "codesense-"));
        tempFile = join(dir, "script.py");
        writeFileSync(tempFile, code, "utf8");
        const result = await runLocal(pythonCmd, ["-u", tempFile]);
        try { unlinkSync(tempFile); } catch {}
        return NextResponse.json(result, { status: 200 });
      }
    }

    // Use LLM fallback for everything else (or if local Python isn't found)
    const result = await executeViaLLM(code, language, stdin, files);
    return NextResponse.json(
      { ...result, cloud: true },
      { status: 200 }
    );
  } catch (error: any) {
    try { if (tempFile) unlinkSync(tempFile); } catch {}
    console.error("API Execute Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute code" },
      { status: 500 }
    );
  }
}

/** Run a command locally with a timeout */
function runLocal(
  command: string,
  args: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        timeout: TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT,
        env: { ...process.env, NODE_NO_WARNINGS: "1" },
      },
      (error, stdout, stderr) => {
        const exitCode = error ? (error as any).code ?? 1 : 0;
        const timedOut = (error as any)?.killed;
        resolve({
          stdout: stdout?.toString() || "",
          stderr: timedOut
            ? `Execution timed out after ${TIMEOUT_MS / 1000}s\n${stderr?.toString() || ""}`
            : stderr?.toString() || "",
          exitCode: typeof exitCode === "number" ? exitCode : 1,
        });
      }
    );
  });
}
