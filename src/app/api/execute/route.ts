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
 * Execute code via Wandbox API as a code execution backend.
 * This runs code natively in isolated containers completely for free.
 */
async function executeViaWandbox(
  code: string,
  language: string,
  stdin: string,
  files: { name: string, content: string }[] = []
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  // Map our language names to Wandbox's compiler names
  const compilerMap: Record<string, string> = {
    python: "cpython-3.13.8",
    cpp: "gcc-13.2.0",
    "c++": "gcc-13.2.0",
    c: "gcc-13.2.0-c",
    java: "openjdk-jdk-22+36",
    csharp: "mono-6.12.0.199",
    go: "go-1.23.2",
    rust: "rust-1.82.0",
    php: "php-8.3.12",
    ruby: "ruby-4.0.2",
    swift: "swift-6.0.1",
    kotlin: "kotlin-1.9.22",
    sql: "sqlite-3.46.1",
    javascript: "nodejs-20.17.0",
    typescript: "typescript-5.6.2",
  };

  const compiler = compilerMap[language.toLowerCase()];
  if (!compiler) {
    return {
      stdout: "",
      stderr: `Language '${language}' is not supported by the Wandbox compiler backend.`,
      exitCode: 1,
    };
  }

  const codesArray = files.map(f => ({ file: f.name, code: f.content }));

  try {
    const response = await fetch("https://wandbox.org/api/compile.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        compiler: compiler,
        code: code,
        codes: codesArray.length > 0 ? codesArray : undefined,
        stdin: stdin,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        stdout: "",
        stderr: `Wandbox API error (${response.status}): ${errText}`,
        exitCode: 1,
      };
    }

    const data = await response.json();
    return {
      stdout: data.program_output || "",
      stderr: data.compiler_error || data.program_error || "",
      exitCode: data.status === "0" ? 0 : 1,
    };
  } catch (err: any) {
    return {
      stdout: "",
      stderr: `Failed to connect to Wandbox execution engine: ${err.message}`,
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

    // Use Wandbox natively for everything else (or if local Python isn't found)
    const result = await executeViaWandbox(code, language, stdin, files);
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
