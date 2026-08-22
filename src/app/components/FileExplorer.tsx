import React, { useRef, useState, useEffect } from "react";
import { Folder, ChevronRight, ChevronDown, Upload, FileUp, FilePlus, FolderPlus, Edit2, Trash2, Download } from "lucide-react";
import { FileNode } from "../hooks/useWorkspace";
import { getFileTypeInfo, SUPPORTED_UPLOAD_ACCEPT } from "@/lib/fileTypes";

interface FileExplorerProps {
  fileTree: FileNode[];
  onOpenFile: (fileId: string, name: string, content: string, language: string) => void;
  onUploadWorkspace: (tree: FileNode[]) => void;
  onAddFiles: (nodes: FileNode[]) => void;
  onCreateFile: (parentId: string | null, name: string) => void;
  onCreateFolder: (parentId: string | null, name: string) => void;
  onRename: (nodeId: string, newName: string) => void;
  onDelete: (nodeId: string) => void;
  theme?: "dark" | "light";
}

interface ContextMenuState {
  x: number;
  y: number;
  node: FileNode | null;
}

export default function FileExplorer({ 
  fileTree, 
  onOpenFile, 
  onUploadWorkspace,
  onAddFiles,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
  theme = "dark"
}: FileExplorerProps) {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadFolderClick = () => {
    folderInputRef.current?.click();
  };

  const handleUploadFileClick = () => {
    fileInputRef.current?.click();
  };

  // Upload individual source code files
  const handleSingleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newNodes: FileNode[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const content = await file.text();
      const typeInfo = getFileTypeInfo(file.name);
      
      newNodes.push({
        id: `root/${file.name}`,
        name: file.name,
        type: "file",
        content,
        language: typeInfo.language,
      });
    }

    onAddFiles(newNodes);
    // Reset file input value so same files can be re-uploaded if needed
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Upload entire directory workspace
  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const rootNodes: FileNode[] = [];
    const dirMap = new Map<string, FileNode>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const pathParts = file.webkitRelativePath ? file.webkitRelativePath.split("/") : [file.name];
      
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
    if (folderInputRef.current) folderInputRef.current.value = "";
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
      const name = prompt("File name (e.g. main.py, app.js):");
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
    setContextMenu(null);
  };

  return (
    <div className={`w-64 border-r flex flex-col h-full ${
      theme === "light" 
        ? "bg-gray-50 border-gray-200 text-gray-800" 
        : "bg-[#0d0d0f] border-panel-border text-gray-300"
    }`}>
      <div className={`flex items-center justify-between p-3 border-b ${
        theme === "light" ? "border-gray-200" : "border-panel-border"
      }`}>
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">EXPLORER</h2>
        <div className="flex items-center gap-1.5 text-gray-400">
          <button 
            onClick={() => onCreateFile(null, "untitled.py")} 
            className="p-1 hover:text-primary hover:bg-white/5 rounded transition-colors cursor-pointer" 
            title="New File"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => onCreateFolder(null, "new-folder")} 
            className="p-1 hover:text-primary hover:bg-white/5 rounded transition-colors cursor-pointer" 
            title="New Folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={handleUploadFileClick} 
            className="p-1 hover:text-primary hover:bg-white/5 rounded transition-colors cursor-pointer" 
            title="Upload File(s)"
          >
            <FileUp className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={handleUploadFolderClick} 
            className="p-1 hover:text-primary hover:bg-white/5 rounded transition-colors cursor-pointer" 
            title="Upload Folder"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      
      {/* Hidden file input for uploading individual source code files */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleSingleFilesChange} 
        style={{ display: "none" }} 
        multiple
        accept={SUPPORTED_UPLOAD_ACCEPT}
      />

      {/* Hidden directory input for uploading whole workspaces */}
      <input 
        type="file" 
        ref={folderInputRef} 
        onChange={handleFolderChange} 
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
          <div className="text-xs text-gray-500 text-center py-6">
            No files in workspace.<br/>
            <button 
              onClick={handleUploadFileClick} 
              className="mt-2 text-primary underline hover:opacity-80"
            >
              Upload File
            </button>
            {" "}or{" "}
            <button 
              onClick={() => onCreateFile(null, "index.py")} 
              className="text-primary underline hover:opacity-80"
            >
              Create File
            </button>
          </div>
        ) : (
          fileTree.map(node => (
            <FileTreeNode 
              key={node.id} 
              node={node} 
              onOpenFile={onOpenFile}
              onContextMenu={handleContextMenu}
              theme={theme}
            />
          ))
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className={`fixed z-50 rounded-md shadow-2xl py-1 text-xs w-48 border ${
            theme === "light"
              ? "bg-white border-gray-200 text-gray-700 shadow-gray-300"
              : "bg-[#1a1a1f] border-panel-border text-gray-300"
          }`}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            className={`w-full flex items-center px-3 py-1.5 transition-colors ${
              theme === "light" ? "hover:bg-gray-100" : "hover:bg-white/10"
            }`}
            onClick={() => executeAction('newFile')}
          >
            <FilePlus className="w-3.5 h-3.5 mr-2" /> New File
          </button>
          <button 
            className={`w-full flex items-center px-3 py-1.5 transition-colors ${
              theme === "light" ? "hover:bg-gray-100" : "hover:bg-white/10"
            }`}
            onClick={() => executeAction('newFolder')}
          >
            <FolderPlus className="w-3.5 h-3.5 mr-2" /> New Folder
          </button>
          {contextMenu.node && (
            <>
              <div className={`h-px my-1 ${theme === "light" ? "bg-gray-200" : "bg-panel-border"}`} />
              <button 
                className={`w-full flex items-center px-3 py-1.5 transition-colors ${
                  theme === "light" ? "hover:bg-gray-100" : "hover:bg-white/10"
                }`}
                onClick={() => executeAction('rename')}
              >
                <Edit2 className="w-3.5 h-3.5 mr-2" /> Rename
              </button>
              <button 
                className="w-full flex items-center px-3 py-1.5 hover:bg-red-500/20 text-red-400 transition-colors" 
                onClick={() => executeAction('delete')}
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
              </button>
              {contextMenu.node.type === "file" && (
                <>
                  <div className={`h-px my-1 ${theme === "light" ? "bg-gray-200" : "bg-panel-border"}`} />
                  <button 
                    className={`w-full flex items-center px-3 py-1.5 transition-colors ${
                      theme === "light" ? "hover:bg-gray-100" : "hover:bg-white/10"
                    }`}
                    onClick={() => executeAction('download')}
                  >
                    <Download className="w-3.5 h-3.5 mr-2" /> Download
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
  depth = 0,
  theme = "dark"
}: { 
  node: FileNode, 
  onOpenFile: any, 
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void,
  depth?: number,
  theme?: "dark" | "light"
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
        className={`flex items-center py-1 cursor-pointer text-xs rounded px-1 transition-colors group ${
          theme === "light"
            ? "text-gray-700 hover:bg-gray-200"
            : "text-gray-300 hover:bg-white/5"
        }`}
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
          <Folder className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
        ) : (
          <FileIcon className="w-3.5 h-3.5 mr-1.5 text-gray-400 group-hover:text-primary transition-colors" />
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
              theme={theme}
            />
          ))}
        </div>
      )}
    </div>
  );
}
