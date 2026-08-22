import React, { useRef, useState, useEffect } from "react";
import { Folder, ChevronRight, ChevronDown, Upload, FilePlus, FolderPlus, Edit2, Trash2, Download } from "lucide-react";
import { FileNode } from "../hooks/useWorkspace";
import { getFileTypeInfo } from "../lib/fileTypes";

interface FileExplorerProps {
  fileTree: FileNode[];
  onOpenFile: (fileId: string, name: string, content: string, language: string) => void;
  onUploadWorkspace: (tree: FileNode[]) => void;
  onCreateFile: (parentId: string | null, name: string) => void;
  onCreateFolder: (parentId: string | null, name: string) => void;
  onRename: (nodeId: string, newName: string) => void;
  onDelete: (nodeId: string) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  node: FileNode | null; // null means clicked on root area
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
          const typeInfo = getFileTypeInfo(part);
          currentLevel.push({
            id: currentPath,
            name: part,
            type: "file",
            content,
            language: typeInfo.language
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

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, node: FileNode | null) => {
    e.preventDefault();
    setContextMenu({ x: e.pageX, y: e.pageY, node });
  };

  const executeAction = (action: string) => {
    if (!contextMenu) return;
    const { node } = contextMenu;
    const isRoot = node === null;
    const isDir = node?.type === "folder";
    const parentId = isRoot ? null : (isDir ? node.id : (node.id.includes('/') ? node.id.substring(0, node.id.lastIndexOf('/')) : null));

    if (action === "newFile") {
      const name = prompt("File name:");
      if (name) onCreateFile(parentId, name);
    } else if (action === "newFolder") {
      const name = prompt("Folder name:");
      if (name) onCreateFolder(parentId, name);
    } else if (action === "rename" && node) {
      const name = prompt("New name:", node.name);
      if (name && name !== node.name) onRename(node.id, name);
    } else if (action === "delete" && node) {
      if (confirm(`Are you sure you want to delete ${node.name}?`)) onDelete(node.id);
    } else if (action === "download" && node && !isDir) {
      const blob = new Blob([node.content || ""], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = node.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
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

      <div 
        className="flex-1 overflow-y-auto p-2"
        onContextMenu={(e) => {
          if (e.target === e.currentTarget) {
            handleContextMenu(e, null);
          }
        }}
      >
        {fileTree.length === 0 ? (
          <div className="text-xs text-gray-500 text-center py-4">
            No folder loaded.<br/>Click the upload icon above to load a workspace.
          </div>
        ) : (
          fileTree.map(node => (
            <FileTreeNode 
              key={node.id} 
              node={node} 
              onOpenFile={onOpenFile}
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-50 bg-[#1a1a1f] border border-panel-border rounded-md shadow-xl py-1 text-sm text-gray-300 w-48"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="w-full flex items-center px-3 py-1.5 hover:bg-white/10 transition-colors" onClick={() => executeAction('newFile')}>
            <FilePlus className="w-4 h-4 mr-2" /> New File
          </button>
          <button className="w-full flex items-center px-3 py-1.5 hover:bg-white/10 transition-colors" onClick={() => executeAction('newFolder')}>
            <FolderPlus className="w-4 h-4 mr-2" /> New Folder
          </button>
          {contextMenu.node && (
            <>
              <div className="h-px bg-panel-border my-1" />
              <button className="w-full flex items-center px-3 py-1.5 hover:bg-white/10 transition-colors" onClick={() => executeAction('rename')}>
                <Edit2 className="w-4 h-4 mr-2" /> Rename
              </button>
              <button className="w-full flex items-center px-3 py-1.5 hover:bg-red-500/20 text-red-400 transition-colors" onClick={() => executeAction('delete')}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </button>
              {contextMenu.node.type === "file" && (
                <>
                  <div className="h-px bg-panel-border my-1" />
                  <button className="w-full flex items-center px-3 py-1.5 hover:bg-white/10 transition-colors" onClick={() => executeAction('download')}>
                    <Download className="w-4 h-4 mr-2" /> Download
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FileTreeNode({ 
  node, 
  onOpenFile, 
  onContextMenu, 
  depth = 0 
}: { 
  node: FileNode, 
  onOpenFile: any, 
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void,
  depth?: number 
}) {
  const [isOpen, setIsOpen] = useState(true);
  const isDir = node.type === "folder";
  const typeInfo = getFileTypeInfo(node.name);
  const FileIcon = typeInfo.icon;

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
        onContextMenu={(e) => onContextMenu(e, node)}
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
          <FileIcon className="w-4 h-4 mr-2 text-gray-400 group-hover:text-primary transition-colors" />
        )}
        <span className="truncate">{node.name}</span>
      </div>
      
      {isDir && isOpen && node.children && (
        <div>
          {node.children.map(child => (
            <FileTreeNode 
              key={child.id} 
              node={child} 
              onOpenFile={onOpenFile} 
              onContextMenu={onContextMenu}
              depth={depth + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
