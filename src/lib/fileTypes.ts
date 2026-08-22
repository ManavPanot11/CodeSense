import { FileCode, FileJson, FileText, Image, Code2, Terminal, Database, FileSpreadsheet, Layout, FileTerminal } from "lucide-react";
import React from "react";

export interface FileTypeInfo {
  language: string;
  icon: React.ElementType;
}

const EXTENSION_MAP: Record<string, FileTypeInfo> = {
  // Web
  js: { language: "javascript", icon: FileCode },
  jsx: { language: "javascript", icon: FileCode },
  ts: { language: "typescript", icon: FileCode },
  tsx: { language: "typescript", icon: FileCode },
  html: { language: "html", icon: Layout },
  css: { language: "css", icon: Layout },
  scss: { language: "scss", icon: Layout },
  json: { language: "json", icon: FileJson },
  
  // Backend & Systems
  py: { language: "python", icon: FileCode },
  java: { language: "java", icon: FileCode },
  c: { language: "c", icon: FileCode },
  cpp: { language: "cpp", icon: FileCode },
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

export function getFileTypeInfo(filename: string): FileTypeInfo {
  const parts = filename.split('.');
  if (parts.length < 2) {
    return { language: "plaintext", icon: FileText };
  }
  const ext = parts.pop()?.toLowerCase() || "";
  return EXTENSION_MAP[ext] || { language: "plaintext", icon: FileText };
}
