"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Play,
  Download,
  Settings,
  FileCode,
  Bug,
  Book,
  BarChart,
  Terminal,
  Loader2,
  Zap,
  PanelLeft,
  Sun,
  Moon,
  Check,
} from "lucide-react";

import { useWorkspace } from "./hooks/useWorkspace";
import FileExplorer from "./components/FileExplorer";
import EditorTabs from "./components/EditorTabs";
import GitHubPane from "./components/GitHubPane";
import SourceControlPane from "./components/SourceControlPane";
import { detectLanguageFromContent, getExtensionForLanguage, getFileTypeInfo } from "@/lib/fileTypes";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export default function CodeSenseApp() {
  const {
    state: workspace,
    openFile,
    closeTab,
    switchTab,
    updateActiveTabContent,
    updateActiveTabLanguage,
    updateTabNameAndLanguage,
    saveActiveTab,
    setCursorPosition,
    uploadWorkspace,
    addFiles,
    createFile,
    createFolder,
    renameNode,
    deleteNode,
  } = useWorkspace();

  const [activeRightTab, setActiveRightTab] = useState("issues");
  const [activeLeftTab, setActiveLeftTab] = useState<"explorer" | "github" | "git">("explorer");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Theme State with localStorage persistence
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("codesense_theme") as "dark" | "light" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("codesense_theme", next);
  };

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [execResult, setExecResult] = useState<{
    stdout: string;
    stderr: string;
    exitCode: number;
    cloud?: boolean;
  } | null>(null);
  const [execTime, setExecTime] = useState<number | null>(null);

  // Request race condition management
  const abortRef = useRef<AbortController | null>(null);
  const lastAnalyzedCodeRef = useRef<string>("");
  const currentReqIdRef = useRef<number>(0);

  const activeTab = workspace?.openTabs.find((t) => t.fileId === workspace.activeTabId);
  const code = activeTab?.content || "";
  const language = activeTab?.language || "plaintext";

  // ── Automatic Language Detection ─────────────────────────────────
  const lastDetectedLangRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeTab || !code.trim()) return;

    // Detect language from code structure
    const detected = detectLanguageFromContent(code);
    if (detected && detected !== activeTab.language && detected !== lastDetectedLangRef.current) {
      lastDetectedLangRef.current = detected;
      
      // Update extension if default or generic
      const currentParts = activeTab.name.split(".");
      const baseName = currentParts.length > 1 ? currentParts.slice(0, -1).join(".") : activeTab.name;
      const targetExt = getExtensionForLanguage(detected);
      const newFileName = `${baseName}.${targetExt}`;

      updateTabNameAndLanguage(activeTab.fileId, newFileName, detected);
    }
  }, [code, activeTab, updateTabNameAndLanguage]);

  // ── Analyze (Fast non-blocking with race-condition guards) ────────
  const analyzeCode = useCallback(async (isManual = false) => {
    const trimmedCode = code.trim();
    if (!trimmedCode) return;

    // Avoid redundant duplicate requests unless clicked manually
    if (!isManual && trimmedCode === lastAnalyzedCodeRef.current) {
      return;
    }

    // Cancel in-flight stale requests
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const reqId = ++currentReqIdRef.current;
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    setIsAnalyzing(true);
    if (isManual) {
      setAnalysisResult(null);
    }

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmedCode, language }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Verify request is not superseded by a newer keystroke/request
      if (reqId !== currentReqIdRef.current) return;

      const data = await res.json();
      if (!res.ok) {
        setAnalysisResult({ error: data.error || "Analysis failed" });
      } else {
        setAnalysisResult(data);
        lastAnalyzedCodeRef.current = trimmedCode;
      }
    } catch (err: any) {
      if (reqId !== currentReqIdRef.current) return;

      if (err.name !== "AbortError") {
        console.error("Analysis error:", err);
        setAnalysisResult({ error: err.message || "Analysis service unavailable." });
      } else if (isManual) {
        setAnalysisResult({ error: "Analysis request timed out. Please try again." });
      }
    } finally {
      clearTimeout(timeoutId);
      if (reqId === currentReqIdRef.current) {
        setIsAnalyzing(false);
      }
    }
  }, [code, language]);

  // ── Auto-analyze with Debounce ───────────────────────────────────
  useEffect(() => {
    if (!code.trim() || isExecuting) return;
    const timer = setTimeout(() => {
      analyzeCode(false);
    }, 1500); // 1.5s debounce after typing stops
    return () => clearTimeout(timer);
  }, [code, language, isExecuting, analyzeCode]);

  // ── Execute code ──────────────────────────────────────────────────
  const executeCode = useCallback(async () => {
    if (!code.trim()) return;
    
    setIsExecuting(true);
    setExecResult(null);
    setExecTime(null);
    setActiveRightTab("console");
    const t0 = performance.now();
    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });
      const data = await res.json();
      setExecTime(Math.round(performance.now() - t0));
      if (data.error) {
        setExecResult({ stdout: "", stderr: data.error, exitCode: 1 });
      } else {
        setExecResult(data);
      }
    } catch (err: any) {
      setExecTime(Math.round(performance.now() - t0));
      setExecResult({ stdout: "", stderr: err.message, exitCode: 1 });
    } finally {
      setIsExecuting(false);
    }
  }, [code, language]);

  // ── Keyboard Shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveActiveTab();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        executeCode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveActiveTab, executeCode]);

  // ── Apply fix ─────────────────────────────────────────────────────
  const handleApplyFix = (issue: any) => {
    if (!issue.suggestedFix) return;
    const lines = code.split("\n");
    const startIdx = Math.max(0, (issue.startLine || 1) - 1);
    const endIdx = Math.min(lines.length, issue.endLine || lines.length);
    lines.splice(startIdx, endIdx - startIdx, issue.suggestedFix);
    updateActiveTabContent(lines.join("\n"));
  };

  // ── Export / Download helpers ────────────────────────────────────
  const handleExportCode = () => {
    if (!activeTab) return;
    
    // Determine proper filename with extension according to detected language
    let exportFileName = activeTab.name;
    const parts = exportFileName.split(".");
    const ext = parts.length > 1 ? parts.pop()?.toLowerCase() : "";
    const expectedExt = getExtensionForLanguage(language);
    
    if (!ext || ext === "txt") {
      const base = parts.join(".") || "code";
      exportFileName = `${base}.${expectedExt}`;
    }

    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportDocs = () => {
    if (!analysisResult?.documentation) return;
    const blob = new Blob([analysisResult.documentation], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "README.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleEditorMount = (editor: any) => {
    editor.onDidChangeCursorPosition((e: any) => {
      setCursorPosition(e.position.lineNumber, e.position.column);
    });
  };

  const rightTabs = [
    { id: "issues", label: "Issues", icon: Bug },
    { id: "console", label: "Console", icon: Terminal },
    { id: "docs", label: "Docs", icon: Book },
    { id: "score", label: "Score", icon: BarChart },
  ] as const;

  if (!workspace) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#09090b]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalLines = code.split('\n').length;
  const isLight = theme === "light";

  return (
    <div className={`flex flex-col h-screen select-none ${
      isLight ? "bg-white text-gray-900" : "bg-[#09090b] text-[#fafafa]"
    }`}>
      {/* Header */}
      <header className={`flex items-center justify-between px-3 py-2 border-b z-10 shrink-0 ${
        isLight ? "bg-gray-50 border-gray-200" : "bg-[#0d0d0f] border-panel-border"
      }`}>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-1.5 rounded-md transition-colors ${
              isLight ? "hover:bg-gray-200 text-gray-600" : "hover:bg-white/10 text-gray-400"
            }`}
            title="Toggle Sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-primary" />
            <h1 className="text-base font-bold tracking-tight hidden sm:block">
              Code<span className="text-primary">Sense</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Left Panel Toggles */}
          <div className={`flex items-center gap-1 mr-1 border-r pr-2 ${
            isLight ? "border-gray-200" : "border-panel-border"
          }`}>
            <button
              onClick={() => { setSidebarOpen(true); setActiveLeftTab("explorer"); }}
              className={`p-1.5 rounded-md text-xs flex items-center gap-1 font-medium transition-colors ${
                activeLeftTab === "explorer" && sidebarOpen
                  ? isLight ? "bg-gray-200 text-gray-900" : "bg-white/10 text-white"
                  : isLight ? "text-gray-500 hover:text-gray-900" : "text-gray-400 hover:text-white"
              }`}
              title="File Explorer"
            >
              <FileCode className="w-4 h-4" />
              <span className="hidden md:inline">Files</span>
            </button>
            <button
              onClick={() => { setSidebarOpen(true); setActiveLeftTab("git"); }}
              className={`p-1.5 rounded-md text-xs flex items-center gap-1 font-medium transition-colors ${
                activeLeftTab === "git" && sidebarOpen
                  ? isLight ? "bg-gray-200 text-gray-900" : "bg-white/10 text-white"
                  : isLight ? "text-gray-500 hover:text-gray-900" : "text-gray-400 hover:text-white"
              }`}
              title="Source Control"
            >
              <Terminal className="w-4 h-4" />
              <span className="hidden md:inline">Git</span>
            </button>
            <button
              onClick={() => { setSidebarOpen(true); setActiveLeftTab("github"); }}
              className={`p-1.5 rounded-md text-xs flex items-center gap-1 font-medium transition-colors ${
                activeLeftTab === "github" && sidebarOpen
                  ? isLight ? "bg-gray-200 text-gray-900" : "bg-white/10 text-white"
                  : isLight ? "text-gray-500 hover:text-gray-900" : "text-gray-400 hover:text-white"
              }`}
              title="GitHub Repositories"
            >
              <Zap className="w-4 h-4" />
              <span className="hidden md:inline">GitHub</span>
            </button>
          </div>

          {/* Language Selector */}
          {activeTab && (
            <select
              value={language}
              onChange={(e) => {
                const newLang = e.target.value;
                const expectedExt = getExtensionForLanguage(newLang);
                const parts = activeTab.name.split(".");
                const base = parts.length > 1 ? parts.slice(0, -1).join(".") : activeTab.name;
                updateTabNameAndLanguage(activeTab.fileId, `${base}.${expectedExt}`, newLang);
              }}
              className={`border rounded-md px-2 py-1 text-xs outline-none focus:border-primary transition-colors cursor-pointer ${
                isLight ? "bg-white border-gray-300 text-gray-900" : "bg-black/50 border-panel-border text-gray-200"
              }`}
            >
              <option value="python">Python (.py)</option>
              <option value="javascript">JavaScript (.js)</option>
              <option value="typescript">TypeScript (.ts)</option>
              <option value="cpp">C++ (.cpp)</option>
              <option value="c">C (.c)</option>
              <option value="java">Java (.java)</option>
              <option value="csharp">C# (.cs)</option>
              <option value="go">Go (.go)</option>
              <option value="rust">Rust (.rs)</option>
              <option value="php">PHP (.php)</option>
              <option value="ruby">Ruby (.rb)</option>
              <option value="swift">Swift (.swift)</option>
              <option value="kotlin">Kotlin (.kt)</option>
              <option value="html">HTML (.html)</option>
              <option value="css">CSS (.css)</option>
              <option value="scss">SCSS (.scss)</option>
              <option value="json">JSON (.json)</option>
              <option value="sql">SQL (.sql)</option>
              <option value="markdown">Markdown (.md)</option>
              <option value="plaintext">Plain Text (.txt)</option>
            </select>
          )}

          {/* Run Code */}
          <button
            onClick={executeCode}
            disabled={isExecuting || !activeTab}
            className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1 rounded-md text-xs font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isExecuting ? "Running…" : "Run"}</span>
          </button>

          {/* Analyze */}
          <button
            onClick={() => analyzeCode(true)}
            disabled={isAnalyzing || !activeTab}
            className="flex items-center gap-1.5 bg-primary text-black px-3 py-1 rounded-md text-xs font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isAnalyzing ? "Analyzing…" : "Analyze"}</span>
          </button>

          {/* Download Code & Docs */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleExportCode}
              disabled={!activeTab}
              className={`flex items-center p-1.5 border rounded-md transition-colors cursor-pointer disabled:opacity-30 ${
                isLight ? "border-gray-300 hover:bg-gray-200 text-gray-700" : "border-panel-border hover:bg-white/5 text-gray-300"
              }`}
              title="Download Code File"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleExportDocs}
              disabled={!analysisResult?.documentation}
              className={`flex items-center p-1.5 border rounded-md transition-colors cursor-pointer disabled:opacity-30 ${
                isLight ? "border-gray-300 hover:bg-gray-200 text-gray-700" : "border-panel-border hover:bg-white/5 text-gray-300"
              }`}
              title="Download Docs (README.md)"
            >
              <Book className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className={`p-1.5 border rounded-md transition-colors cursor-pointer flex items-center justify-center ${
              isLight 
                ? "border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-700" 
                : "border-panel-border bg-white/5 hover:bg-white/10 text-yellow-400"
            }`}
            title={`Switch to ${isLight ? "Dark" : "Light"} Mode`}
          >
            {isLight ? <Moon className="w-3.5 h-3.5 text-gray-700" /> : <Sun className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        {sidebarOpen && (
          <div className={`w-64 border-r flex flex-col shrink-0 ${
            isLight ? "bg-gray-50 border-gray-200" : "bg-[#0d0d0f] border-panel-border"
          }`}>
            {activeLeftTab === "explorer" && (
              <FileExplorer 
                fileTree={workspace.fileTree} 
                onOpenFile={openFile} 
                onUploadWorkspace={uploadWorkspace} 
                onAddFiles={addFiles}
                onCreateFile={createFile}
                onCreateFolder={createFolder}
                onRename={renameNode}
                onDelete={deleteNode}
                theme={theme}
              />
            )}
            {activeLeftTab === "github" && (
              <GitHubPane onImportRepository={uploadWorkspace} theme={theme} />
            )}
            {activeLeftTab === "git" && (
              <SourceControlPane fileTree={workspace.fileTree} activeTabId={workspace.activeTabId} theme={theme} />
            )}
          </div>
        )}

        {/* Center Pane: Editor */}
        <div className={`flex-1 flex flex-col min-w-0 border-r ${
          isLight ? "bg-white border-gray-200" : "bg-[#1e1e1e] border-panel-border"
        }`}>
          <EditorTabs 
            tabs={workspace.openTabs} 
            activeTabId={workspace.activeTabId} 
            onSwitchTab={switchTab} 
            onCloseTab={closeTab} 
            theme={theme}
          />
          
          <div className="flex-1 relative min-h-0">
            {activeTab ? (
              <Editor
                height="100%"
                language={language}
                theme={isLight ? "light" : "vs-dark"}
                value={code}
                onChange={(value) => updateActiveTabContent(value || "")}
                onMount={handleEditorMount}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  padding: { top: 14 },
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                  cursorSmoothCaretAnimation: "on",
                  formatOnPaste: true,
                  automaticLayout: true,
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 flex-col gap-3">
                <FileCode className="w-12 h-12 opacity-30" />
                <p className="text-xs">Select or upload a file from the explorer to begin.</p>
              </div>
            )}
          </div>
          
          {/* Status Bar */}
          {activeTab && (
            <div className={`flex items-center justify-between px-3 py-1 text-[11px] font-mono shrink-0 ${
              isLight ? "bg-gray-100 border-t border-gray-200 text-gray-600" : "bg-[#007acc] text-white"
            }`}>
              <div className="flex items-center gap-4">
                <span>Ln {activeTab.cursorPosition?.line || 1}, Col {activeTab.cursorPosition?.column || 1}</span>
                <span>{totalLines} lines</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="capitalize">{language}</span>
                {activeTab.content !== activeTab.savedContent && (
                   <span className="cursor-pointer font-semibold text-amber-300" onClick={saveActiveTab} title="Click to save (Ctrl+S)">● Unsaved Changes</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Pane: Feedback / Console */}
        <div className={`w-[380px] xl:w-[460px] flex flex-col shrink-0 ${
          isLight ? "bg-gray-50 text-gray-900" : "bg-[#0d0d0f] text-gray-100"
        }`}>
          {/* Tabs */}
          <div className={`flex border-b px-2 ${
            isLight ? "border-gray-200" : "border-panel-border"
          }`}>
            {rightTabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveRightTab(id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex-1 justify-center sm:flex-none ${
                  activeRightTab === id
                    ? "border-primary text-primary"
                    : isLight 
                      ? "border-transparent text-gray-500 hover:text-gray-900" 
                      : "border-transparent text-gray-400 hover:text-gray-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {id === "issues" && analysisResult?.issues && (
                  <span className={`px-1.5 py-0.2 rounded text-[10px] tabular-nums font-bold ${
                    isLight ? "bg-gray-200 text-gray-800" : "bg-white/10 text-gray-300"
                  }`}>
                    {analysisResult.issues.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* ── Issues ───────────────────────────────────── */}
            {activeRightTab === "issues" && (
              <div>
                {isAnalyzing && !analysisResult ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-xs">Analyzing code…</p>
                  </div>
                ) : !analysisResult ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 py-16">
                    <Settings className="w-10 h-10 opacity-30" />
                    <p className="text-xs text-center">Type code or click &quot;Analyze&quot; to review.</p>
                  </div>
                ) : analysisResult.error ? (
                  <div className="text-red-400 bg-red-500/10 border border-red-500/20 p-3.5 rounded-lg text-xs leading-relaxed flex flex-col gap-2">
                    <p>{analysisResult.error}</p>
                    <button 
                      onClick={() => analyzeCode(true)}
                      className="self-start px-2 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-red-300 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      Retry Analysis
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                        Detected Issues
                      </h2>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        isLight ? "bg-gray-200 text-gray-800" : "bg-white/10 text-gray-300"
                      }`}>
                        {analysisResult.issues?.length || 0} found
                      </span>
                    </div>
                    {!analysisResult.issues || analysisResult.issues.length === 0 ? (
                      <div className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-lg flex items-center gap-2 text-xs">
                        <Check className="w-4 h-4 shrink-0" />
                        <span>No issues found! Your code is looking clean.</span>
                      </div>
                    ) : (
                      analysisResult.issues.map((issue: any, idx: number) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border flex flex-col gap-1.5 ${
                            isLight ? "bg-white border-gray-200 shadow-xs" : "bg-white/5 border-panel-border"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                issue.severity === "critical"
                                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                  : issue.severity === "warning"
                                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                                    : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                              }`}
                            >
                              {issue.severity.toUpperCase()}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              Lines {issue.startLine}-{issue.endLine}
                            </span>
                          </div>
                          {issue.title && (
                            <h3 className="text-xs font-bold mt-0.5">
                              {issue.title}
                            </h3>
                          )}
                          <p className="text-xs text-gray-400 leading-relaxed">
                            {issue.description}
                          </p>
                          {issue.suggestedFix && (
                            <div className={`mt-2 p-2.5 rounded border relative group ${
                              isLight ? "bg-gray-100 border-gray-200" : "bg-black/60 border-white/5"
                            }`}>
                              <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">
                                Suggested Fix:
                              </div>
                              <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                                {issue.suggestedFix}
                              </pre>
                              <button
                                className="absolute top-2 right-2 bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 px-2 py-1 rounded text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                onClick={() => handleApplyFix(issue)}
                              >
                                Accept Fix
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Console ──────────────────────────────────── */}
            {activeRightTab === "console" && (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" /> Console Output
                  </h2>
                  <div className="flex items-center gap-2">
                    {execTime !== null && (
                      <span className="text-[10px] font-mono text-gray-400">
                        {execTime}ms
                      </span>
                    )}
                    {execResult && (
                      <button
                        onClick={() => {
                          setExecResult(null);
                          setExecTime(null);
                        }}
                        className="text-[11px] text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {isExecuting ? (
                  <div className="flex flex-col items-center justify-center flex-1 text-gray-400 gap-3 py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                    <p className="text-xs">Executing code…</p>
                  </div>
                ) : !execResult ? (
                  <div className="flex flex-col items-center justify-center flex-1 text-gray-400 gap-2 py-16">
                    <Terminal className="w-8 h-8 opacity-20" />
                    <p className="text-xs text-center">
                      Click <strong>&quot;Run&quot;</strong> or press <strong>Ctrl+Enter</strong> to execute.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 flex-1 min-h-0 pb-6">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          execResult.exitCode === 0
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-red-500/20 text-red-400 border border-red-500/30"
                        }`}
                      >
                        Exit code: {execResult.exitCode}
                      </span>
                      {execResult.cloud && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30 font-semibold">
                          ☁️ Cloud Run
                        </span>
                      )}
                    </div>

                    {execResult.stdout && (
                      <div className="flex-1 min-h-[80px] flex flex-col">
                        <pre className={`flex-1 console-output p-3 rounded-md text-xs font-mono whitespace-pre-wrap overflow-auto border ${
                          isLight ? "bg-gray-100 text-gray-900 border-gray-200" : "bg-[#0a0a0c] text-emerald-300 border-panel-border"
                        }`}>
                          {execResult.stdout}
                        </pre>
                      </div>
                    )}

                    {execResult.stderr && (
                      <div className="flex-1 min-h-[80px] flex flex-col">
                        <pre className="flex-1 console-output bg-[#0a0a0c] border border-red-500/20 rounded-md p-3 text-xs text-red-400 font-mono whitespace-pre-wrap overflow-auto">
                          {execResult.stderr}
                        </pre>
                      </div>
                    )}

                    {!execResult.stdout && !execResult.stderr && (
                      <div className="text-gray-400 text-xs italic py-2">
                        Program produced no output.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Docs ─────────────────────────────────────── */}
            {activeRightTab === "docs" && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  AI Documentation
                </h2>
                {analysisResult?.documentation ? (
                  <div className={`p-3.5 rounded-lg border ${
                    isLight ? "bg-white border-gray-200 shadow-xs" : "bg-white/5 border-panel-border"
                  }`}>
                    <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed">
                      {analysisResult.documentation}
                    </pre>
                  </div>
                ) : (
                  <div className="text-gray-400 text-xs py-8 text-center">
                    Analyze code to automatically generate documentation.
                  </div>
                )}
              </div>
            )}

            {/* ── Score ────────────────────────────────────── */}
            {activeRightTab === "score" && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Code Quality Score
                </h2>
                {analysisResult?.quality_score != null ? (
                  <div className={`p-4 rounded-lg border flex flex-col sm:flex-row items-center gap-4 ${
                    isLight ? "bg-white border-gray-200 shadow-xs" : "bg-white/5 border-panel-border"
                  }`}>
                    <div className="relative w-18 h-18 flex items-center justify-center shrink-0">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          className={isLight ? "text-gray-200" : "text-gray-800"}
                          strokeWidth="3.5"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className={`${
                            analysisResult.quality_score >= 80
                              ? "text-emerald-500"
                              : analysisResult.quality_score >= 60
                                ? "text-yellow-500"
                                : "text-red-500"
                          }`}
                          strokeWidth="3.5"
                          strokeDasharray={`${analysisResult.quality_score}, 100`}
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <span className="absolute text-xl font-bold font-mono">
                        {analysisResult.quality_score}
                      </span>
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <h3 className="font-bold text-xs uppercase text-gray-400 mb-1">Quality Assessment</h3>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        {analysisResult.summary || "Code quality analyzed successfully."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-400 text-xs py-8 text-center">
                    Analyze code to compute quality metric score.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
