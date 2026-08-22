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
} from "lucide-react";

import { useWorkspace } from "./hooks/useWorkspace";
import FileExplorer from "./components/FileExplorer";
import EditorTabs from "./components/EditorTabs";
import GitHubPane from "./components/GitHubPane";
import SourceControlPane from "./components/SourceControlPane";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export default function CodeSenseApp() {
  const {
    state: workspace,
    openFile,
    closeTab,
    switchTab,
    updateActiveTabContent,
    updateActiveTabLanguage,
    saveActiveTab,
    setCursorPosition,
    uploadWorkspace,
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

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [execResult, setExecResult] = useState<{
    stdout: string;
    stderr: string;
    exitCode: number;
    cloud?: boolean;
  } | null>(null);
  const [execTime, setExecTime] = useState<number | null>(null);

  // Abort controller for cancellable requests
  const abortRef = useRef<AbortController | null>(null);

  const activeTab = workspace?.openTabs.find((t) => t.fileId === workspace.activeTabId);
  const code = activeTab?.content || "";
  const language = activeTab?.language || "plaintext";

  // ── Analyze (non-streaming) ───────────────────────────────────────
  const analyzeCode = useCallback(async () => {
    if (!code.trim()) return;

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    // Timeout to prevent infinite hanging
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok) {
        setAnalysisResult({ error: data.error || "Analysis failed" });
      } else {
        setAnalysisResult(data);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Analysis error:", err);
        setAnalysisResult({ error: err.message || "Request timed out or failed" });
      } else {
        setAnalysisResult({ error: "Analysis request timed out or was cancelled." });
      }
    } finally {
      setIsAnalyzing(false);
      clearTimeout(timeoutId);
    }
  }, [code, language]);

  // ── Auto-analyze ──────────────────────────────────────────────────
  useEffect(() => {
    if (!code.trim() || isExecuting) return;
    const timer = setTimeout(() => {
      analyzeCode();
    }, 2500); // 2.5s debounce
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
      // Ctrl/Cmd + S to Save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveActiveTab();
      }
      // Ctrl/Cmd + Enter to Run
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
    const startIdx = issue.startLine - 1;
    const endIdx = issue.endLine;
    lines.splice(startIdx, endIdx - startIdx, issue.suggestedFix);
    updateActiveTabContent(lines.join("\n"));
  };

  // ── Export helpers ────────────────────────────────────────────────
  const handleExportCode = () => {
    if (!activeTab) return;
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activeTab.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportDocs = () => {
    if (!analysisResult?.documentation) return;
    const blob = new Blob([analysisResult.documentation], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "README.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Editor Callbacks ──────────────────────────────────────────────
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

  if (!workspace) return <div className="h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const totalLines = code.split('\n').length;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-panel-border bg-panel glass-panel z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold tracking-tight hidden sm:block">
              Code<span className="text-primary">Sense</span>
            </h1>
          </div>
        </div>

          {/* Left Panel Toggles */}
          <div className="flex items-center gap-1 sm:gap-2 mr-2 border-r border-panel-border pr-2">
            <button
              onClick={() => { setSidebarOpen(true); setActiveLeftTab("explorer"); }}
              className={`p-1.5 rounded-md transition-colors ${activeLeftTab === "explorer" && sidebarOpen ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
              title="Explorer"
            >
              <FileCode className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setSidebarOpen(true); setActiveLeftTab("git"); }}
              className={`p-1.5 rounded-md transition-colors ${activeLeftTab === "git" && sidebarOpen ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
              title="Source Control"
            >
              <Terminal className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setSidebarOpen(true); setActiveLeftTab("github"); }}
              className={`p-1.5 rounded-md transition-colors ${activeLeftTab === "github" && sidebarOpen ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
              title="GitHub"
            >
              <Zap className="w-4 h-4" />
            </button>
          </div>

          {activeTab && (
            <select
              value={language}
              onChange={(e) => updateActiveTabLanguage(e.target.value)}
              className="bg-black/50 border border-panel-border rounded-md px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
            </select>
          )}

          {/* Run Code */}
          <button
            onClick={executeCode}
            disabled={isExecuting || !activeTab}
            className="flex items-center gap-1.5 sm:gap-2 bg-emerald-600 text-white px-3 py-1 sm:px-4 sm:py-1.5 rounded-md text-xs sm:text-sm font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isExecuting ? <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" /> : <Play className="w-3 h-3 sm:w-4 sm:h-4" />}
            <span className="hidden sm:inline">{isExecuting ? "Running…" : "Run"}</span>
          </button>

          {/* Analyze */}
          <button
            onClick={analyzeCode}
            disabled={isAnalyzing || !activeTab}
            className="flex items-center gap-1.5 sm:gap-2 bg-primary text-black px-3 py-1 sm:px-4 sm:py-1.5 rounded-md text-xs sm:text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isAnalyzing ? <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" /> : <Zap className="w-3 h-3 sm:w-4 sm:h-4" />}
            <span className="hidden sm:inline">{isAnalyzing ? "Analyzing…" : "Analyze"}</span>
          </button>

          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={handleExportCode}
              disabled={!activeTab}
              className="flex items-center gap-1.5 bg-panel border border-panel-border px-3 py-1.5 rounded-md text-xs sm:text-sm hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-30"
              title="Download Code"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handleExportDocs}
              disabled={!analysisResult?.documentation}
              className="flex items-center gap-1.5 bg-panel border border-panel-border px-3 py-1.5 rounded-md text-xs sm:text-sm hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-30"
              title="Download Docs"
            >
              <Book className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        {sidebarOpen && (
          <div className="w-64 border-r border-panel-border bg-[#0d0d0f] flex flex-col shrink-0">
            {activeLeftTab === "explorer" && (
              <FileExplorer 
                fileTree={workspace.fileTree} 
                onOpenFile={openFile} 
                onUploadWorkspace={uploadWorkspace} 
                onCreateFile={createFile}
                onCreateFolder={createFolder}
                onRename={renameNode}
                onDelete={deleteNode}
              />
            )}
            {activeLeftTab === "github" && (
              <GitHubPane onImportRepository={uploadWorkspace} />
            )}
            {activeLeftTab === "git" && (
              <SourceControlPane fileTree={workspace.fileTree} activeTabId={workspace.activeTabId} />
            )}
          </div>
        )}

        {/* Center Pane: Editor */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-panel-border bg-[#1e1e1e]">
          <EditorTabs 
            tabs={workspace.openTabs} 
            activeTabId={workspace.activeTabId} 
            onSwitchTab={switchTab} 
            onCloseTab={closeTab} 
          />
          
          <div className="flex-1 relative min-h-0">
            {activeTab ? (
              <Editor
                height="100%"
                language={language}
                theme="vs-dark"
                value={code}
                onChange={(value) => updateActiveTabContent(value || "")}
                onMount={handleEditorMount}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  padding: { top: 16 },
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                  cursorSmoothCaretAnimation: "on",
                  formatOnPaste: true,
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 flex-col gap-4">
                <FileCode className="w-16 h-16 opacity-20" />
                <p>Open a file from the explorer to start coding.</p>
              </div>
            )}
          </div>
          
          {/* Status Bar */}
          {activeTab && (
            <div className="flex items-center justify-between px-3 py-1 bg-[#007acc] text-white text-xs font-mono shrink-0">
              <div className="flex items-center gap-4">
                <span>Ln {activeTab.cursorPosition?.line || 1}, Col {activeTab.cursorPosition?.column || 1}</span>
                <span>{totalLines} lines</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="capitalize">{language}</span>
                {activeTab.content !== activeTab.savedContent && (
                   <span className="cursor-pointer" onClick={saveActiveTab} title="Click to save (or Ctrl+S)">Unsaved Changes</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Pane: Feedback / Console */}
        <div className="w-[400px] xl:w-[500px] flex flex-col bg-[#0d0d0f] shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-panel-border px-2">
            {rightTabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveRightTab(id)}
                className={`flex items-center gap-2 px-3 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors cursor-pointer flex-1 justify-center sm:flex-none sm:justify-start ${
                  activeRightTab === id
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-400 hover:text-gray-200"
                }`}
              >
                <Icon className="w-4 h-4 hidden sm:block" />
                {label}
                {id === "issues" && analysisResult?.issues && (
                  <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] tabular-nums">
                    {analysisResult.issues.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {/* ── Issues ───────────────────────────────────── */}
            {activeRightTab === "issues" && (
              <div>
                {isAnalyzing && !analysisResult ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4 py-20">
                    <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
                    <p className="text-sm">Analyzing code…</p>
                  </div>
                ) : !analysisResult ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4 py-20">
                    <Settings className="w-12 h-12 opacity-20" />
                    <p className="text-sm text-center">Click &quot;Analyze&quot; to review the active file.</p>
                  </div>
                ) : analysisResult.error ? (
                  <div className="text-red-400 bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-sm">
                    {analysisResult.error}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base sm:text-lg font-semibold text-white">
                        Detected Issues
                      </h2>
                      <span className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300">
                        {analysisResult.issues?.length || 0} found
                      </span>
                    </div>
                    {!analysisResult.issues ||
                    analysisResult.issues.length === 0 ? (
                      <div className="text-green-400 bg-green-500/10 border border-green-500/20 p-4 rounded-lg flex flex-col items-center text-center gap-2 text-sm">
                        <span>No issues found! Your code is looking great.</span>
                      </div>
                    ) : (
                      analysisResult.issues.map((issue: any, idx: number) => (
                        <div
                          key={idx}
                          className="glass-panel p-4 rounded-lg flex flex-col gap-2"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[10px] sm:text-xs font-bold px-2 py-1 rounded ${
                                issue.severity === "critical"
                                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                  : issue.severity === "warning"
                                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                                    : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                              }`}
                            >
                              {issue.severity.toUpperCase()}
                            </span>
                            <span className="text-[10px] sm:text-xs text-gray-500">
                              Lines {issue.startLine}-{issue.endLine}
                            </span>
                          </div>
                          {issue.title && (
                            <h3 className="text-xs sm:text-sm font-semibold text-white mt-1">
                              {issue.title}
                            </h3>
                          )}
                          <p className="text-xs sm:text-sm text-gray-300">
                            {issue.description}
                          </p>
                          {issue.suggestedFix && (
                            <div className="mt-2 sm:mt-3 bg-black/50 p-2 sm:p-3 rounded border border-white/5 relative group">
                              <div className="text-[10px] sm:text-xs text-gray-500 mb-1.5 sm:mb-2">
                                Suggested Fix:
                              </div>
                              <pre className="text-[10px] sm:text-sm text-gray-300 font-mono overflow-x-auto whitespace-pre-wrap">
                                {issue.suggestedFix}
                              </pre>
                              <button
                                className="absolute top-1 sm:top-2 right-1 sm:right-2 bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 px-2 sm:px-3 py-1 sm:py-1.5 rounded text-[10px] sm:text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center gap-1 font-medium"
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
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 sm:w-5 sm:h-5" /> Console
                  </h2>
                  <div className="flex items-center gap-2 sm:gap-3">
                    {execTime !== null && (
                      <span className="text-[10px] sm:text-xs text-gray-500">
                        {execTime}ms
                      </span>
                    )}
                    <button
                      onClick={executeCode}
                      disabled={isExecuting || !activeTab}
                      className="flex items-center gap-1.5 sm:gap-2 bg-emerald-600 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isExecuting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      Run Code
                    </button>
                    {execResult && (
                      <button
                        onClick={() => {
                          setExecResult(null);
                          setExecTime(null);
                        }}
                        className="text-[10px] sm:text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {isExecuting ? (
                  <div className="flex flex-col items-center justify-center flex-1 text-gray-500 gap-4 py-20">
                    <Loader2 className="w-10 h-10 animate-spin text-emerald-400/40" />
                    <p className="text-sm">Executing your code…</p>
                  </div>
                ) : !execResult ? (
                  <div className="flex flex-col items-center justify-center flex-1 text-gray-500 gap-4 py-20">
                    <Terminal className="w-12 h-12 opacity-20" />
                    <p className="text-sm text-center">
                      Click <strong>&quot;Run&quot;</strong> to execute
                      your code.
                    </p>
                    <p className="text-xs text-gray-600 text-center">
                      Supports JavaScript (Node.js) and Python
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 flex-1 min-h-0 pb-10">
                    {/* Exit code badge */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] sm:text-xs font-bold px-2 py-1 rounded ${
                          execResult.exitCode === 0
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : "bg-red-500/20 text-red-400 border border-red-500/30"
                        }`}
                      >
                        Exit code: {execResult.exitCode}
                      </span>
                      {execResult.cloud && (
                        <span className="text-[10px] sm:text-xs px-2 py-1 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center gap-1">
                          ☁️ Cloud
                        </span>
                      )}
                    </div>

                    {/* stdout */}
                    {execResult.stdout && (
                      <div className="flex-1 min-h-[100px] flex flex-col">
                        <div className="text-[10px] sm:text-xs text-gray-500 mb-1 font-medium">
                          stdout
                        </div>
                        <pre className="flex-1 console-output bg-[#0a0a0c] border border-panel-border rounded-lg p-3 sm:p-4 text-xs sm:text-sm text-green-300 font-mono whitespace-pre-wrap overflow-auto">
                          {execResult.stdout}
                        </pre>
                      </div>
                    )}

                    {/* stderr */}
                    {execResult.stderr && (
                      <div className="flex-1 min-h-[100px] flex flex-col">
                        <div className="text-[10px] sm:text-xs text-gray-500 mb-1 font-medium">
                          stderr
                        </div>
                        <pre className="flex-1 console-output bg-[#0a0a0c] border border-red-500/20 rounded-lg p-3 sm:p-4 text-xs sm:text-sm text-red-400 font-mono whitespace-pre-wrap overflow-auto">
                          {execResult.stderr}
                        </pre>
                      </div>
                    )}

                    {/* Empty output */}
                    {!execResult.stdout && !execResult.stderr && (
                      <div className="text-gray-500 text-sm italic">
                        Program produced no output.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Docs ─────────────────────────────────────── */}
            {activeRightTab === "docs" && (
              <div className="space-y-4">
                <h2 className="text-base sm:text-lg font-semibold mb-4 text-white">
                  Documentation
                </h2>
                {analysisResult?.documentation ? (
                  <div className="glass-panel p-4 rounded-lg">
                    <pre className="text-xs sm:text-sm text-gray-300 font-mono whitespace-pre-wrap">
                      {analysisResult.documentation}
                    </pre>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">
                    Run an analysis to generate documentation.
                  </div>
                )}
              </div>
            )}

            {/* ── Score ────────────────────────────────────── */}
            {activeRightTab === "score" && (
              <div className="space-y-4">
                <h2 className="text-base sm:text-lg font-semibold mb-4 text-white">
                  Quality Score
                </h2>
                {analysisResult?.quality_score != null ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-6 glass-panel p-4 sm:p-6 rounded-lg">
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center shrink-0 self-center">
                      <svg
                        className="w-full h-full transform -rotate-90"
                        viewBox="0 0 36 36"
                      >
                        <path
                          className="text-gray-800"
                          strokeWidth="3"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className={`${
                            analysisResult.quality_score >= 80
                              ? "text-green-500"
                              : analysisResult.quality_score >= 60
                                ? "text-yellow-500"
                                : "text-red-500"
                          }`}
                          strokeWidth="3"
                          strokeDasharray={`${analysisResult.quality_score}, 100`}
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <span className="absolute text-xl sm:text-2xl font-bold">
                        {analysisResult.quality_score}
                      </span>
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <h3 className="font-medium text-white mb-1 sm:mb-2 text-sm sm:text-base">Summary</h3>
                      <p className="text-xs sm:text-sm text-gray-400">
                        {analysisResult.summary || "No summary provided."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">
                    Run an analysis to see a quality score.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
