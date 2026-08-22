import React, { useRef } from "react";
import { Folder, FileCode, ChevronRight, ChevronDown, Plus, Upload } from "lucide-react";
import { FileNode } from "../hooks/useWorkspace";

interface FileExplorerProps {
  fileTree: FileNode[];
  onOpenFile: (fileId: string, name: string, content: string, language: string) => void;
  onUploadWorkspace: (tree: FileNode[]) => void;
}

export default function FileExplorer({ fileTree, onOpenFile, onUploadWorkspace }: FileExplorerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Convert flat FileList to FileNode tree
    const rootNodes: FileNode[] = [];
    const dirMap = new Map<string, FileNode>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const pathParts = file.webkitRelativePath.split("/");
      
      // Read file content
      const content = await file.text();
      let currentLevel = rootNodes;
      
      for (let j = 0; j < pathParts.length; j++) {
        const part = pathParts[j];
        const isFile = j === pathParts.length - 1;
        const currentPath = pathParts.slice(0, j + 1).join("/");

        if (isFile) {
          currentLevel.push({
            id: currentPath,
            name: part,
            type: "file",
            content,
            language: getLanguageFromFilename(part)
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
    
    onUploadWorkspace(rootNodes);
  };

  return (
    <div className="w-64 border-r border-panel-border bg-[#0d0d0f] flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-panel-border">
        <h2 className="text-sm font-semibold text-gray-300">EXPLORER</h2>
        <div className="flex items-center gap-2 text-gray-400">
          <button onClick={handleUploadClick} className="hover:text-primary transition-colors cursor-pointer" title="Upload Folder">
            <Upload className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <input 
        type="file" 
        ref={inputRef} 
        onChange={handleFileChange} 
        style={{ display: "none" }} 
        {...({ webkitdirectory: "true", directory: "true" } as any)}
      />

      <div className="flex-1 overflow-y-auto p-2">
        {fileTree.length === 0 ? (
          <div className="text-xs text-gray-500 text-center py-4">
            No folder loaded.<br/>Click the upload icon above to load a workspace.
          </div>
        ) : (
          fileTree.map(node => (
            <FileTreeNode key={node.id} node={node} onOpenFile={onOpenFile} />
          ))
        )}
      </div>
    </div>
  );
}

function FileTreeNode({ node, onOpenFile, depth = 0 }: { node: FileNode, onOpenFile: any, depth?: number }) {
  const [isOpen, setIsOpen] = React.useState(true);
  const isDir = node.type === "folder";

  const handleClick = () => {
    if (isDir) {
      setIsOpen(!isOpen);
    } else {
      onOpenFile(node.id, node.name, node.content || "", node.language || "plaintext");
    }
  };

  return (
    <div>
      <div 
        className="flex items-center py-1 hover:bg-white/5 cursor-pointer text-sm text-gray-300 rounded px-1 transition-colors group"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={handleClick}
      >
        {isDir ? (
          <span className="w-4 h-4 mr-1 flex items-center justify-center text-gray-500">
            {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </span>
        ) : (
          <span className="w-4 h-4 mr-1 flex items-center justify-center" />
        )}
        
        {isDir ? (
          <Folder className="w-4 h-4 mr-2 text-blue-400" />
        ) : (
          <FileCode className="w-4 h-4 mr-2 text-gray-400 group-hover:text-primary transition-colors" />
        )}
        <span className="truncate">{node.name}</span>
      </div>
      
      {isDir && isOpen && node.children && (
        <div>
          {node.children.map(child => (
            <FileTreeNode key={child.id} node={child} onOpenFile={onOpenFile} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js': return 'javascript';
    case 'ts': return 'typescript';
    case 'jsx': return 'javascript';
    case 'tsx': return 'typescript';
    case 'py': return 'python';
    case 'json': return 'json';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'md': return 'markdown';
    default: return 'plaintext';
  }
}
