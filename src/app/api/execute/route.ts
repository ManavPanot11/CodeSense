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
 * Execute code via Piston API as a code execution backend.
 * This runs code natively in isolated containers without using AI tokens.
 */
async function executeViaPiston(
  code: string,
  language: string,
  stdin: string,
  files: { name: string, content: string }[] = []
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  // Map our language names to Piston's language names
  const langMap: Record<string, string> = {
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
    sql: "sqlite3",
  };

  const pistonLang = langMap[language.toLowerCase()] || language;

  const pistonFiles = [
    {
      name: "main",
      content: code
    },
    ...files.map(f => ({ name: f.name, content: f.content }))
  ];

  try {
    const response = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        language: pistonLang,
        version: "*",
        files: pistonFiles,
        stdin: stdin,
        compile_timeout: 10000,
        run_timeout: 10000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        stdout: "",
        stderr: `Piston API error (${response.status}): ${errText}`,
        exitCode: 1,
      };
    }

    const data = await response.json();
    return {
      stdout: data.run?.stdout || "",
      stderr: data.compile?.stderr || data.run?.stderr || "",
      exitCode: data.run?.code ?? (data.compile?.code ?? 1),
    };
  } catch (err: any) {
    return {
      stdout: "",
      stderr: `Failed to connect to Piston execution engine: ${err.message}`,
      exitCode: 1,
    };
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

    // Use Piston natively for everything else (or if local Python isn't found)
    const result = await executeViaPiston(code, language, stdin, files);
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
