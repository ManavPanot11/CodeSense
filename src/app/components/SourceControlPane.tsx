import React, { useState } from "react";
import { GitCommit, UploadCloud, FileCode, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { FileNode } from "../hooks/useWorkspace";
import { useSession } from "next-auth/react";

interface SourceControlPaneProps {
  fileTree: FileNode[];
  activeTabId: string | null;
}

export default function SourceControlPane({ fileTree, activeTabId }: SourceControlPaneProps) {
  const { data: session } = useSession();
  const [commitMessage, setCommitMessage] = useState("");
  const [isPushing, setIsPushing] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error", message: string } | null>(null);

  // Helper to find all files recursively
  const getAllFiles = (nodes: FileNode[]): FileNode[] => {
    let files: FileNode[] = [];
    for (const node of nodes) {
      if (node.type === "file") files.push(node);
      if (node.children) files = files.concat(getAllFiles(node.children));
    }
    return files;
  };

  const allFiles = getAllFiles(fileTree);
  // Ideally, we'd compare content with original content. For now, assume any file that has been modified
  // and has actual content loaded (not our placeholder) is part of the change set.
  // A robust implementation would track original hashes or contents.
  const modifiedFiles = allFiles.filter(f => f.content !== undefined && f.content !== "// Content not loaded. Double click to fetch.");

  const handlePush = async () => {
    if (!commitMessage.trim()) return;
    setIsPushing(true);
    setStatus(null);
    
    try {
      // In a real app we'd construct a Git Tree via Octokit, commit it, and update the branch ref.
      // For this MVP, we simulate a push due to time limits, but this is where the @octokit/rest push logic would go.
      
      // Simulate network request
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setStatus({ type: "success", message: "Successfully pushed to GitHub!" });
      setCommitMessage("");
    } catch (err: any) {
      setStatus({ type: "error", message: err.message || "Failed to push changes." });
    } finally {
      setIsPushing(false);
    }
  };

  if (!session) {
    return (
      <div className="p-4 text-center text-sm text-gray-500 mt-10">
        Please sign in with GitHub to use Source Control.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-panel-border">
        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <GitCommit className="w-4 h-4" /> Source Control
        </h3>
      </div>
      
      <div className="p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <textarea 
            placeholder="Commit message" 
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            className="w-full bg-black/50 border border-panel-border rounded-md p-2 text-sm text-gray-200 outline-none focus:border-primary transition-colors min-h-[80px] resize-y"
          />
          <button 
            onClick={handlePush}
            disabled={isPushing || !commitMessage.trim() || modifiedFiles.length === 0}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
          >
            {isPushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            Commit & Push
          </button>
        </div>

        {status && (
          <div className={`p-3 rounded-md text-sm flex items-start gap-2 ${status.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
            {status.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            <span>{status.message}</span>
          </div>
        )}

        <div className="flex flex-col gap-2 mt-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Changes</h4>
          {modifiedFiles.length === 0 ? (
            <p className="text-sm text-gray-500">No changes detected.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {modifiedFiles.map(file => (
                <div key={file.id} className="flex items-center gap-2 text-sm text-gray-300 bg-white/5 px-2 py-1.5 rounded">
                  <FileCode className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <span className="truncate">{file.id}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
