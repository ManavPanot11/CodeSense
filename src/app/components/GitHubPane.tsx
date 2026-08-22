import React, { useState, useEffect } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { GitBranch, LogIn, LogOut, Download, Loader2, Folder, Search } from "lucide-react";
import { Octokit } from "@octokit/rest";
import { FileNode } from "../hooks/useWorkspace";
import { getFileTypeInfo } from "@/lib/fileTypes";

interface GitHubPaneProps {
  onImportRepository: (tree: FileNode[], repoInfo?: { owner: string; repo: string; branch: string }) => void;
  theme?: "dark" | "light";
}

export default function GitHubPane({ onImportRepository, theme = "dark" }: GitHubPaneProps) {
  const { data: sessionData, status } = useSession();
  const session = sessionData as any;
  const [repos, setRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingRepo, setImportingRepo] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (session?.accessToken) {
      fetchRepos(session.accessToken as string);
    }
  }, [session]);

  const fetchRepos = async (token: string) => {
    setLoading(true);
    try {
      const octokit = new Octokit({ auth: token });
      const { data } = await octokit.rest.repos.listForAuthenticatedUser({
        sort: "updated",
        per_page: 50,
      });
      setRepos(data);
    } catch (err) {
      console.error("Failed to fetch repos", err);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (owner: string, repo: string, defaultBranch: string) => {
    if (!session?.accessToken) return;
    setImportingRepo(repo);
    try {
      const octokit = new Octokit({ auth: session.accessToken as string });
      
      const { data: treeData } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: defaultBranch,
        recursive: "true",
      });

      const rootNodes: FileNode[] = [];
      const dirMap = new Map<string, FileNode>();
      const files = treeData.tree.filter(t => t.type === "blob");
      
      let fetchedFiles = 0;

      for (const item of files) {
        if (!item.path) continue;
        
        const pathParts = item.path.split("/");
        let currentLevel = rootNodes;
        
        for (let j = 0; j < pathParts.length; j++) {
          const part = pathParts[j];
          const isFile = j === pathParts.length - 1;
          const currentPath = pathParts.slice(0, j + 1).join("/");
          
          if (isFile) {
            let content = "// Content not loaded. Double click to fetch.";
            
            if (fetchedFiles < 30 && item.size && item.size < 100000) {
               try {
                 const { data: fileData } = await octokit.rest.repos.getContent({
                    owner,
                    repo,
                    path: item.path,
                 });
                 if (!Array.isArray(fileData) && fileData.type === 'file' && fileData.content) {
                   content = decodeURIComponent(escape(atob(fileData.content)));
                   fetchedFiles++;
                 }
               } catch (e) {
                 console.error("Failed to load file", item.path);
               }
            }

            const typeInfo = getFileTypeInfo(part);
            currentLevel.push({
              id: currentPath,
              name: part,
              type: "file",
              content,
              language: typeInfo.language,
            });
          } else {
            if (!dirMap.has(currentPath)) {
              const newFolder: FileNode = {
                id: currentPath,
                name: part,
                type: "folder",
                children: []
              };
              dirMap.set(currentPath, newFolder);
              currentLevel.push(newFolder);
            }
            currentLevel = dirMap.get(currentPath)!.children!;
          }
        }
      }
      onImportRepository(rootNodes, { owner, repo, branch: defaultBranch });
      
    } catch (err) {
      console.error("Failed to import repo", err);
      alert("Failed to import repository.");
    } finally {
      setImportingRepo(null);
    }
  };

  if (status === "loading") {
    return <div className="p-4 text-gray-400 flex justify-center"><Loader2 className="animate-spin" /></div>;
  }

  if (!session) {
    return (
      <div className="p-6 flex flex-col items-center justify-center text-center">
        <GitBranch className="w-10 h-10 text-gray-400 mb-3" />
        <h3 className="text-sm font-semibold mb-1">Connect to GitHub</h3>
        <p className="text-xs text-gray-400 mb-5">
          Log in to view your repositories, import projects, and push changes directly from CodeSense.
        </p>
        <button 
          onClick={() => signIn("github")}
          className="flex items-center gap-2 bg-[#2ea043] hover:bg-[#2c974b] text-white px-4 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer"
        >
          <LogIn className="w-3.5 h-3.5" /> Continue with GitHub
        </button>
      </div>
    );
  }

  const filteredRepos = repos.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={`flex flex-col h-full ${theme === "light" ? "text-gray-800" : "text-gray-200"}`}>
      <div className={`p-3 border-b flex flex-col gap-2.5 ${theme === "light" ? "border-gray-200" : "border-panel-border"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {session.user?.image ? (
              <img src={session.user.image} alt="" className="w-5 h-5 rounded-full" />
            ) : (
              <GitBranch className="w-4 h-4 text-gray-400" />
            )}
            <span className="text-xs font-semibold truncate max-w-[140px]">{session.user?.name || session.user?.email}</span>
          </div>
          <button 
            onClick={() => signOut()}
            className="text-gray-400 hover:text-red-400 transition-colors p-1"
            title="Log out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
        
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search repositories..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full border rounded-md pl-8 pr-2.5 py-1.5 text-xs outline-none focus:border-primary transition-colors ${
              theme === "light" 
                ? "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400" 
                : "bg-black/50 border-panel-border text-gray-200 placeholder:text-gray-500"
            }`}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex justify-center p-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : filteredRepos.length === 0 ? (
          <div className="text-center p-6 text-gray-500 text-xs">No repositories found.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {filteredRepos.map(repo => (
              <div 
                key={repo.id} 
                className={`group flex flex-col p-2.5 rounded-md border transition-colors ${
                  theme === "light"
                    ? "border-gray-200 hover:border-gray-300 hover:bg-gray-100/70"
                    : "border-panel-border hover:border-white/20 hover:bg-white/5"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col overflow-hidden">
                    <span 
                      className="text-xs font-semibold text-blue-400 truncate cursor-pointer hover:underline" 
                      onClick={() => window.open(repo.html_url, '_blank')}
                    >
                      {repo.name}
                    </span>
                    {repo.description && (
                      <span className="text-[11px] text-gray-400 truncate mt-0.5">{repo.description}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleImport(repo.owner.login, repo.name, repo.default_branch)}
                    disabled={importingRepo === repo.name}
                    className="shrink-0 flex items-center justify-center bg-white/10 hover:bg-white/20 text-gray-300 p-1.5 rounded transition-colors disabled:opacity-50 cursor-pointer"
                    title="Import Repository"
                  >
                    {importingRepo === repo.name ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1"><Folder className="w-3 h-3" /> {repo.default_branch}</span>
                  <span>•</span>
                  <span>{repo.private ? "Private" : "Public"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
