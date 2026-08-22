import React, { useState } from "react";
import { GitCommit, UploadCloud, FileCode, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { FileNode } from "../hooks/useWorkspace";
import { useSession } from "next-auth/react";
import { Octokit } from "@octokit/rest";

interface SourceControlPaneProps {
  fileTree: FileNode[];
  activeTabId: string | null;
  activeGitRepo?: { owner: string; repo: string; branch: string };
  theme?: "dark" | "light";
}

export default function SourceControlPane({ fileTree, activeTabId, activeGitRepo, theme = "dark" }: SourceControlPaneProps) {
  const { data: sessionData } = useSession();
  const session = sessionData as any;
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
  // Only include files that have been genuinely modified by the user.
  // If a file has an originalContent (imported from GitHub), compare against that.
  // If a file has no originalContent (created locally), it's always considered modified.
  const modifiedFiles = allFiles.filter(f => {
    if (f.content === undefined) return false;
    if (f.content === "// Content not loaded. Double click to fetch.") return false;
    // If imported from GitHub, only count as modified if content actually changed
    if (f.originalContent !== undefined) {
      return f.content !== f.originalContent;
    }
    // Locally created files are always considered new/modified
    return true;
  });

  const handlePush = async () => {
    if (!commitMessage.trim() || !activeGitRepo || !session?.accessToken) return;
    setIsPushing(true);
    setStatus(null);
    
    try {
      const octokit = new Octokit({ auth: session.accessToken as string });
      const { owner, repo, branch } = activeGitRepo;

      // 1. Get the current branch reference
      const refResult = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`,
      });
      const currentCommitSha = refResult.data.object.sha;

      // 2. Get the current commit to find its base tree
      const commitResult = await octokit.rest.git.getCommit({
        owner,
        repo,
        commit_sha: currentCommitSha,
      });
      const baseTreeSha = commitResult.data.tree.sha;

      // 3. Create blobs for all modified files
      const treeUpdates: any[] = [];
      for (const file of modifiedFiles) {
        if (!file.content) continue;
        const blobResult = await octokit.rest.git.createBlob({
          owner,
          repo,
          content: file.content,
          encoding: "utf-8",
        });
        
        // Remove 'root/' prefix if present
        const filePath = file.id.startsWith("root/") ? file.id.substring(5) : file.id;
        
        treeUpdates.push({
          path: filePath,
          mode: "100644",
          type: "blob",
          sha: blobResult.data.sha,
        });
      }

      if (treeUpdates.length === 0) {
        setStatus({ type: "success", message: "Nothing to push." });
        setIsPushing(false);
        return;
      }

      // 4. Create a new tree with the base tree
      const newTreeResult = await octokit.rest.git.createTree({
        owner,
        repo,
        base_tree: baseTreeSha,
        tree: treeUpdates,
      });

      // 5. Create a new commit
      const newCommitResult = await octokit.rest.git.createCommit({
        owner,
        repo,
        message: commitMessage,
        tree: newTreeResult.data.sha,
        parents: [currentCommitSha],
      });

      // 6. Update the branch reference to point to the new commit
      await octokit.rest.git.updateRef({
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: newCommitResult.data.sha,
      });

      setStatus({ type: "success", message: `Successfully pushed to ${branch}!` });
      setCommitMessage("");
    } catch (err: any) {
      console.error("Push failed:", err);
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

  if (!activeGitRepo) {
    return (
      <div className="p-6 text-center text-xs text-gray-400 mt-6 flex flex-col gap-2">
        <AlertCircle className="w-8 h-8 text-yellow-500/50 mx-auto" />
        <div>
          <p className="font-bold text-gray-300">No Repository Connected</p>
          <p className="mt-1 leading-relaxed">Import a repository from the GitHub tab to use Source Control.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${theme === "light" ? "text-gray-800" : "text-gray-200"}`}>
      <div className={`p-3 border-b ${theme === "light" ? "border-gray-200" : "border-panel-border"}`}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
          <span className="flex items-center gap-1.5"><GitCommit className="w-3.5 h-3.5" /> Source Control</span>
          <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded normal-case text-gray-300 font-mono overflow-hidden text-ellipsis max-w-[120px]" title={`${activeGitRepo.owner}/${activeGitRepo.repo}`}>
            {activeGitRepo.repo}
          </span>
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
