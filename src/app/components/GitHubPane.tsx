import React, { useState, useEffect } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { Github, LogIn, LogOut, Download, Loader2, Folder, Search } from "lucide-react";
import { Octokit } from "@octokit/rest";
import { FileNode } from "../hooks/useWorkspace";
import { getFileTypeInfo } from "../lib/fileTypes";

interface GitHubPaneProps {
  onImportRepository: (tree: FileNode[]) => void;
}

export default function GitHubPane({ onImportRepository }: GitHubPaneProps) {
  const { data: session, status } = useSession();
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
      
      // Fetch the full tree recursively
      const { data: treeData } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: defaultBranch,
        recursive: "true",
      });

      const rootNodes: FileNode[] = [];
      const dirMap = new Map<string, FileNode>();

      // Ensure we only process files/blobs and construct the tree
      const files = treeData.tree.filter(t => t.type === "blob");
      
      // Since downloading all file contents at once for a huge repo is bad,
      // we can lazily load content when opened, but to fit the current architecture,
      // we'll fetch them in parallel if the repo is small, or just load paths.
      // Wait, `FileNode` requires `content`. For a large repo, this will hit API rate limits.
      // Let's modify `FileNode` so `content` is optional, and it can store its `sha` and `url`.
      
      // For this MVP implementation, we will fetch contents for the first 20 files to prevent hitting rate limits
      // and for the rest we will set a placeholder that will prompt to fetch later. (Ideal is lazy load)
      
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
            
            // Only eagerly fetch small files (under 1MB) and limit total eager fetches
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

      onImportRepository(rootNodes);
      
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
        <Github className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-200 mb-2">Connect to GitHub</h3>
        <p className="text-sm text-gray-400 mb-6">
          Log in to view your repositories, import projects, and push changes directly from CodeSense.
        </p>
        <button 
          onClick={() => signIn("github")}
          className="flex items-center gap-2 bg-[#2ea043] hover:bg-[#2c974b] text-white px-4 py-2 rounded-md font-medium transition-colors"
        >
          <LogIn className="w-4 h-4" /> Continue with GitHub
        </button>
      </div>
    );
  }

  const filteredRepos = repos.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-panel-border flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {session.user?.image ? (
              <img src={session.user.image} alt="" className="w-6 h-6 rounded-full" />
            ) : (
              <Github className="w-5 h-5 text-gray-300" />
            )}
            <span className="text-sm font-medium text-gray-200">{session.user?.name || session.user?.email}</span>
          </div>
          <button 
            onClick={() => signOut()}
            className="text-gray-400 hover:text-red-400 transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2 top-2 text-gray-500" />
          <input 
            type="text" 
            placeholder="Search repositories..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black/50 border border-panel-border rounded-md pl-8 pr-3 py-1.5 text-sm text-gray-200 outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : filteredRepos.length === 0 ? (
          <div className="text-center p-8 text-gray-500 text-sm">No repositories found.</div>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredRepos.map(repo => (
              <div key={repo.id} className="group flex flex-col p-3 rounded-md border border-transparent hover:border-panel-border hover:bg-white/5 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-medium text-blue-400 truncate cursor-pointer hover:underline" onClick={() => window.open(repo.html_url, '_blank')}>
                      {repo.name}
                    </span>
                    {repo.description && (
                      <span className="text-xs text-gray-500 truncate mt-1">{repo.description}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleImport(repo.owner.login, repo.name, repo.default_branch)}
                    disabled={importingRepo === repo.name}
                    className="flex-shrink-0 flex items-center justify-center bg-white/10 hover:bg-white/20 text-gray-300 p-1.5 rounded-md transition-colors disabled:opacity-50"
                    title="Import Repository"
                  >
                    {importingRepo === repo.name ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Folder className="w-3 h-3" /> {repo.default_branch}</span>
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
