import { FileCode, FileJson, FileText, Code2, Terminal, Database, FileSpreadsheet, Layout, FileTerminal } from "lucide-react";
import React from "react";

export interface FileTypeInfo {
  language: string;
  defaultExtension: string;
  icon: React.ElementType;
}

export const EXTENSION_MAP: Record<string, { language: string; icon: React.ElementType }> = {
  // Web
  js: { language: "javascript", icon: FileCode },
  jsx: { language: "javascript", icon: FileCode },
  ts: { language: "typescript", icon: FileCode },
  tsx: { language: "typescript", icon: FileCode },
  html: { language: "html", icon: Layout },
  htm: { language: "html", icon: Layout },
  css: { language: "css", icon: Layout },
  scss: { language: "scss", icon: Layout },
  json: { language: "json", icon: FileJson },
  
  // Backend & Systems
  py: { language: "python", icon: FileCode },
  pyw: { language: "python", icon: FileCode },
  java: { language: "java", icon: FileCode },
  c: { language: "c", icon: FileCode },
  cpp: { language: "cpp", icon: FileCode },
  cc: { language: "cpp", icon: FileCode },
  cxx: { language: "cpp", icon: FileCode },
  h: { language: "cpp", icon: FileCode },
  hpp: { language: "cpp", icon: FileCode },
  cs: { language: "csharp", icon: FileCode },
  go: { language: "go", icon: FileCode },
  rs: { language: "rust", icon: FileCode },
  php: { language: "php", icon: FileCode },
  rb: { language: "ruby", icon: FileCode },
  swift: { language: "swift", icon: FileCode },
  kt: { language: "kotlin", icon: FileCode },
  kts: { language: "kotlin", icon: FileCode },
  
  // Shell & Scripts
  sh: { language: "shell", icon: Terminal },
  bash: { language: "shell", icon: Terminal },
  zsh: { language: "shell", icon: Terminal },
  bat: { language: "bat", icon: FileTerminal },
  ps1: { language: "powershell", icon: FileTerminal },

  // Data & Config
  sql: { language: "sql", icon: Database },
  xml: { language: "xml", icon: Code2 },
  yaml: { language: "yaml", icon: FileJson },
  yml: { language: "yaml", icon: FileJson },
  toml: { language: "toml", icon: FileJson },
  csv: { language: "plaintext", icon: FileSpreadsheet },
  
  // Docs
  md: { language: "markdown", icon: FileText },
  txt: { language: "plaintext", icon: FileText },
};

export const LANGUAGE_TO_EXT: Record<string, string> = {
  python: "py",
  javascript: "js",
  typescript: "ts",
  c: "c",
  cpp: "cpp",
  csharp: "cs",
  java: "java",
  go: "go",
  rust: "rs",
  php: "php",
  ruby: "rb",
  kotlin: "kt",
  swift: "swift",
  html: "html",
  css: "css",
  scss: "scss",
  json: "json",
  xml: "xml",
  yaml: "yaml",
  sql: "sql",
  markdown: "md",
  shell: "sh",
  powershell: "ps1",
  plaintext: "txt",
};

export const SUPPORTED_UPLOAD_ACCEPT = ".py,.pyw,.js,.jsx,.ts,.tsx,.c,.cpp,.cc,.cxx,.h,.hpp,.java,.cs,.go,.rs,.php,.rb,.swift,.kt,.kts,.html,.htm,.css,.scss,.json,.xml,.yaml,.yml,.toml,.sql,.md,.txt,.sh,.bash,.zsh,.bat,.ps1";

export function getFileTypeInfo(filename: string): FileTypeInfo {
  const parts = filename.split('.');
  if (parts.length < 2) {
    return { language: "plaintext", defaultExtension: "txt", icon: FileText };
  }
  const ext = parts.pop()?.toLowerCase() || "";
  const info = EXTENSION_MAP[ext];
  if (info) {
    return { ...info, defaultExtension: ext };
  }
  return { language: "plaintext", defaultExtension: "txt", icon: FileText };
}

export function getExtensionForLanguage(language: string): string {
  return LANGUAGE_TO_EXT[language.toLowerCase()] || "txt";
}

/**
 * Intelligent client-side programming language detector based on heuristic patterns.
 * Returns the detected language ID, or null if no confident match.
 */
export function detectLanguageFromContent(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length < 5) return null;

  // 1. JSON
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // Not valid JSON, continue checks
    }
  }

  // 2. HTML / XML
  if (/<(!DOCTYPE\s+html|html|head|body|div|span|p|h[1-6]|script|style|table|form|input|button)[\s>]/i.test(trimmed)) {
    return "html";
  }
  if (/<\?xml[\s\S]*\?>/i.test(trimmed) || /<[a-zA-Z0-9_\-]+(\s+[a-zA-Z0-9_\-]+="[^"]*")*\s*>[\s\S]*<\/[a-zA-Z0-9_\-]+>/i.test(trimmed)) {
    return "xml";
  }

  // 3. CSS / SCSS
  if (/(@import|@media|@keyframes|:\s*(root|hover|focus|active)|(\.[a-zA-Z0-9_\-]+\s*\{)|(#[a-zA-Z0-9_\-]+\s*\{)|([a-zA-Z0-9_\-]+\s*:\s*[^;]+;\s*\}))/i.test(trimmed) &&
      !/(function|def|public\s+class|import\s+sys)/.test(trimmed)) {
    return "css";
  }

  // 4. SQL
  if (/\b(SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+.+\s+SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b/i.test(trimmed)) {
    return "sql";
  }

  // 5. Python
  if (/\b(def\s+[a-zA-Z_]\w*\s*\(|class\s+[a-zA-Z_]\w*(\s*\(|\s*:)|import\s+[a-zA-Z_]|from\s+[a-zA-Z_]\w*\s+import|if\s+__name__\s*==\s*['"]__main__['"]|print\s*\(|elif\s+|elif\s*\()/i.test(trimmed)) {
    // Check if it doesn't have semicolons / brackets typical of C/Java
    if (!/;\s*$/.test(trimmed.split('\n')[0]) && !/\{\s*$/.test(trimmed.split('\n')[0])) {
      return "python";
    }
  }

  // 6. C / C++
  if (/#include\s*<[a-zA-Z0-9_.]+>|#include\s*"[a-zA-Z0-9_.]+"|using\s+namespace\s+std;|std::cout|std::cin|std::vector|printf\s*\(|scanf\s*\(/i.test(trimmed)) {
    return "cpp";
  }

  // 7. Java / C#
  if (/\bpublic\s+(static\s+)?void\s+main\s*\(|System\.out\.print(ln)?\s*\(|public\s+class\s+[a-zA-Z_]\w*|package\s+[a-zA-Z0-9_.]+\s*;/i.test(trimmed)) {
    return "java";
  }
  if (/\bnamespace\s+[a-zA-Z0-9_.]+|using\s+System(\.[a-zA-Z0-9_.]+)?\s*;|Console\.WriteLine\s*\(/i.test(trimmed)) {
    return "csharp";
  }

  // 8. Rust
  if (/\bfn\s+main\s*\(\s*\)|println!\s*\(|let\s+mut\s+|impl(\s+[a-zA-Z_]\w*)?\s+for|use\s+std::/i.test(trimmed)) {
    return "rust";
  }

  // 9. Go
  if (/\bpackage\s+main|func\s+main\s*\(\s*\)|fmt\.Println\s*\(|fmt\.Printf\s*\(|import\s*\(\s*"fmt"\s*\)/i.test(trimmed)) {
    return "go";
  }

  // 10. PHP
  if (/<\?php|\$[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*\s*=/i.test(trimmed)) {
    return "php";
  }

  // 11. Ruby
  if (/\bdef\s+[a-zA-Z_]\w*|puts\s+["']|require\s+['"][a-zA-Z0-9_.]+['"]|attr_accessor|end\b/i.test(trimmed) && !/[;{}]/.test(trimmed)) {
    return "ruby";
  }

  // 12. TypeScript
  if (/\binterface\s+[A-Z]\w*\s*\{|\btype\s+[A-Z]\w*\s*=\s*|:\s*(string|number|boolean|any|void|unknown|never)\b|as\s+const\b/i.test(trimmed)) {
    return "typescript";
  }

  // 13. JavaScript / React JSX
  if (/\b(const|let|var)\s+[a-zA-Z_$][0-9a-zA-Z_$]*\s*=|console\.(log|error|warn|info)\s*\(|function\s+[a-zA-Z_$][0-9a-zA-Z_$]*\s*\(|=>\s*\{|export\s+(default\s+)?(function|class|const)|import\s+.*\s+from\s+['"].*['"]/i.test(trimmed)) {
    return "javascript";
  }

  // 14. Markdown
  if (/^#\s+.+|```[a-z]*\n[\s\S]*```/m.test(trimmed)) {
    return "markdown";
  }

  return null;
}
