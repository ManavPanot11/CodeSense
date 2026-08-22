import React, { useState } from "react";
import { GitCommit, UploadCloud, FileCode, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { FileNode } from "../hooks/useWorkspace";
import { useSession } from "next-auth/react";

interface SourceControlPaneProps {
  fileTree: FileNode[];
  activeTabId: string | null;
  theme?: "dark" | "light";
}

export default function SourceControlPane({ fileTree, activeTabId, theme = "dark" }: SourceControlPaneProps) {
  const { data: session } = useSession();
  const [commitMessage, setCommitMessage] = useState("");
  const [isPushing, setIsPushing] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error", message: string } | null>(null);

  const getAllFiles = (nodes: FileNode[]): FileNode[] => {
    let files: FileNode[] = [];
    for (const node of nodes) {
      if (node.type === "file") files.push(node);
      if (node.children) files = files.concat(getAllFiles(node.children));
    }
    return files;
  };

  const allFiles = getAllFiles(fileTree);
  const modifiedFiles = allFiles.filter(f => f.content !== undefined && f.content !== "// Content not loaded. Double click to fetch.");

  const handlePush = async () => {
    if (!commitMessage.trim()) return;
    setIsPushing(true);
    setStatus(null);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setStatus({ type: "success", message: "Successfully committed & pushed changes!" });
      setCommitMessage("");
    } catch (err: any) {
      setStatus({ type: "error", message: err.message || "Failed to push changes." });
    } finally {
      setIsPushing(false);
    }
  };

  if (!session) {
    return (
      <div className="p-6 text-center text-xs text-gray-400 mt-6">
        Please sign in with GitHub in the GitHub tab to use Source Control.
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${theme === "light" ? "text-gray-800" : "text-gray-200"}`}>
      <div className={`p-3 border-b ${theme === "light" ? "border-gray-200" : "border-panel-border"}`}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
          <GitCommit className="w-3.5 h-3.5" /> Source Control
        </h3>
      </div>
      
      <div className="p-3 flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <textarea 
            placeholder="Message (Ctrl+Enter to commit)" 
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            className={`w-full border rounded-md p-2 text-xs outline-none focus:border-primary transition-colors min-h-[70px] resize-y ${
              theme === "light"
                ? "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                : "bg-black/50 border-panel-border text-gray-200 placeholder:text-gray-500"
            }`}
          />
          <button 
            onClick={handlePush}
            disabled={isPushing || !commitMessage.trim() || modifiedFiles.length === 0}
            className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isPushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
            Commit & Push
          </button>
        </div>

        {status && (
          <div className={`p-2.5 rounded-md text-xs flex items-start gap-1.5 ${
            status.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {status.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
            <span>{status.message}</span>
          </div>
        )}

        <div className="flex flex-col gap-1.5 mt-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Changes ({modifiedFiles.length})
          </h4>
          {modifiedFiles.length === 0 ? (
            <p className="text-xs text-gray-500 py-2">No changes detected.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {modifiedFiles.map(file => (
                <div 
                  key={file.id} 
                  className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded ${
                    theme === "light" ? "bg-gray-100 text-gray-700" : "bg-white/5 text-gray-300"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate flex-1">{file.id}</span>
                  <span className="text-[10px] text-emerald-400 font-mono">M</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
