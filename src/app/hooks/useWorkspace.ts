import { useState, useEffect, useCallback } from "react";
import * as idb from "idb-keyval";

export interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  content?: string;
  originalContent?: string;
  language?: string;
}

export interface OpenTab {
  fileId: string;
  name: string;
  language: string;
  content: string;
  savedContent: string;
  cursorPosition?: { line: number; column: number };
}

export interface WorkspaceState {
  fileTree: FileNode[];
  openTabs: OpenTab[];
  activeTabId: string | null;
  activeGitRepo?: { owner: string; repo: string; branch: string };
}

const STORAGE_KEY = "codesense_workspace_state";

const INTRODUCTION_CONTENT = `Welcome to CodeSense! 🚀
======================
Your intelligent, browser-based coding sandbox.

Here is a quick guide on how to navigate the editor:

1. ⚡ Executing Code
   - Write your code in languages like Python, C++, Java, Rust, or JavaScript.
   - Click the "Run" or "Compile & Run" button in the top right.
   - If your program requires input (e.g., standard input for C++ or Python), expand the "Stdin" panel in the bottom right Console and type your inputs there before running.

2. 🧠 AI Code Analyst
   - Click the "Analyze" button (lightning bolt) to get real-time feedback on your code.
   - Switch to the "Score" tab in the right panel to see your code rated on Function, Design, Security, and Readability.
   - Review the "Areas of Improvement" to see specific issues and suggestions.

3. 📚 Auto-Documentation
   - Need a README? Click the "Book" icon next to the download button in the top right.
   - The AI will generate a highly detailed, professional markdown documentation file specifically for your active code.
   - Switch to the "About" tab in the right panel for a quick overview of what your code does.

4. 🐙 GitHub Integration
   - Click the GitHub icon in the left sidebar to authenticate.
   - Browse your repositories and click "Import" to pull them directly into your virtual workspace.

5. 💾 File Management
   - Use the File Explorer (left sidebar) to create, rename, or delete files and folders.
   - Your workspace is automatically saved locally in your browser.
   - Hit Ctrl+S / Cmd+S at any time to explicitly save.
   - Need to take your code with you? Click "Download Workspace" to get a ZIP of all your files!

Happy Coding!
`;

const DEFAULT_STATE: WorkspaceState = {
  fileTree: [
    {
      id: "root/Introduction.txt",
      name: "Introduction.txt",
      type: "file",
      content: INTRODUCTION_CONTENT,
      language: "plaintext",
    }
  ],
  openTabs: [
    {
      fileId: "root/Introduction.txt",
      name: "Introduction.txt",
      language: "plaintext",
      content: INTRODUCTION_CONTENT,
      savedContent: INTRODUCTION_CONTENT
    }
  ],
  activeTabId: "root/Introduction.txt"
};

import { getFileTypeInfo } from "@/lib/fileTypes";

const getUniqueName = (desiredName: string, siblings: FileNode[], isFolder: boolean = false): string => {
  let newName = desiredName;
  let counter = 1;
  const siblingNames = new Set(siblings.map(s => s.name.toLowerCase()));
  
  const lastDotIndex = desiredName.lastIndexOf('.');
  const hasExtension = !isFolder && lastDotIndex > 0 && lastDotIndex < desiredName.length - 1;
  const baseName = hasExtension ? desiredName.substring(0, lastDotIndex) : desiredName;
  const ext = hasExtension ? desiredName.substring(lastDotIndex) : "";

  while (siblingNames.has(newName.toLowerCase())) {
    newName = `${baseName}(${counter})${ext}`;
    counter++;
  }
  return newName;
};

export function useWorkspace() {
  const [state, setState] = useState<WorkspaceState | null>(null);

  // Load state on mount
  useEffect(() => {
    idb.get<WorkspaceState>(STORAGE_KEY).then((stored) => {
      if (stored) {
        setState(stored);
      } else {
        setState(DEFAULT_STATE);
        idb.set(STORAGE_KEY, DEFAULT_STATE);
      }
    });
  }, []);

  // Save state on change (debounced)
  useEffect(() => {
    if (!state) return;
    const t = setTimeout(() => {
      idb.set(STORAGE_KEY, state);
    }, 500);
    return () => clearTimeout(t);
  }, [state]);

  const setWorkspaceState = useCallback((updater: (prev: WorkspaceState) => WorkspaceState) => {
    setState((prev) => prev ? updater(prev) : prev);
  }, []);

  // --- File/Tab Operations ---

  const openFile = useCallback((fileId: string, name: string, content: string, language: string) => {
    setWorkspaceState((prev) => {
      const existingTab = prev.openTabs.find((t) => t.fileId === fileId);
      if (existingTab) {
        return { ...prev, activeTabId: fileId };
      }
      const newTab: OpenTab = {
        fileId,
        name,
        language,
        content,
        savedContent: content,
      };
      return {
        ...prev,
        openTabs: [...prev.openTabs, newTab],
        activeTabId: fileId,
      };
    });
  }, [setWorkspaceState]);

  const closeTab = useCallback((fileId: string) => {
    setWorkspaceState((prev) => {
      const tabs = prev.openTabs.filter((t) => t.fileId !== fileId);
      let nextActive = prev.activeTabId;
      if (prev.activeTabId === fileId) {
        const closedIdx = prev.openTabs.findIndex((t) => t.fileId === fileId);
        if (tabs.length > 0) {
          nextActive = tabs[Math.max(0, closedIdx - 1)].fileId;
        } else {
          nextActive = null;
        }
      }
      return { ...prev, openTabs: tabs, activeTabId: nextActive };
    });
  }, [setWorkspaceState]);

  const switchTab = useCallback((fileId: string) => {
    setWorkspaceState((prev) => ({ ...prev, activeTabId: fileId }));
  }, [setWorkspaceState]);

  const updateActiveTabContent = useCallback((content: string) => {
    setWorkspaceState((prev) => {
      if (!prev.activeTabId) return prev;
      
      const updateNodeContent = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.id === prev.activeTabId) {
            return { ...node, content };
          }
          if (node.children) {
            return { ...node, children: updateNodeContent(node.children) };
          }
          return node;
        });
      };

      return {
        ...prev,
        fileTree: updateNodeContent(prev.fileTree),
        openTabs: prev.openTabs.map((t) =>
          t.fileId === prev.activeTabId ? { ...t, content } : t
        ),
      };
    });
  }, [setWorkspaceState]);

  const updateActiveTabLanguage = useCallback((language: string) => {
    setWorkspaceState((prev) => {
      if (!prev.activeTabId) return prev;
      return {
        ...prev,
        openTabs: prev.openTabs.map((t) =>
          t.fileId === prev.activeTabId ? { ...t, language } : t
        ),
      };
    });
  }, [setWorkspaceState]);

  const updateTabNameAndLanguage = useCallback((fileId: string, name: string, language: string) => {
    setWorkspaceState((prev) => {
      const parentId = fileId.includes('/') ? fileId.substring(0, fileId.lastIndexOf('/')) : null;
      const newId = parentId ? `${parentId}/${name}` : name;

      const updateTree = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.id === fileId) {
            return { ...node, id: newId, name, language };
          }
          if (node.children) {
            return { ...node, children: updateTree(node.children) };
          }
          return node;
        });
      };

      const newOpenTabs = prev.openTabs.map((t) =>
        t.fileId === fileId ? { ...t, fileId: newId, name, language } : t
      );

      return {
        ...prev,
        fileTree: updateTree(prev.fileTree),
        openTabs: newOpenTabs,
        activeTabId: prev.activeTabId === fileId ? newId : prev.activeTabId,
      };
    });
  }, [setWorkspaceState]);

  const saveActiveTab = useCallback(() => {
    setWorkspaceState((prev) => {
      if (!prev.activeTabId) return prev;
      const activeTab = prev.openTabs.find((t) => t.fileId === prev.activeTabId);
      if (!activeTab) return prev;

      // Update the file tree content as well
      const updateNodeContent = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.id === prev.activeTabId) {
            return { ...node, content: activeTab.content };
          }
          if (node.children) {
            return { ...node, children: updateNodeContent(node.children) };
          }
          return node;
        });
      };

      return {
        ...prev,
        fileTree: updateNodeContent(prev.fileTree),
        openTabs: prev.openTabs.map((t) =>
          t.fileId === prev.activeTabId ? { ...t, savedContent: t.content } : t
        ),
      };
    });
  }, [setWorkspaceState]);

  const setCursorPosition = useCallback((line: number, column: number) => {
    setWorkspaceState((prev) => {
      if (!prev.activeTabId) return prev;
      return {
        ...prev,
        openTabs: prev.openTabs.map((t) =>
          t.fileId === prev.activeTabId
            ? { ...t, cursorPosition: { line, column } }
            : t
        ),
      };
    });
  }, [setWorkspaceState]);

  const importGitHubRepo = useCallback((repoTree: FileNode[], repoInfo: { owner: string; repo: string; branch: string }) => {
    setWorkspaceState((prev) => {
      const repoFolderId = `github:${repoInfo.owner}/${repoInfo.repo}`;
      
      // Remove any existing folder for this repo (re-import)
      const filteredTree = prev.fileTree.filter(n => n.id !== repoFolderId);

      // Wrap all imported files under a project folder
      const repoFolder: FileNode = {
        id: repoFolderId,
        name: repoInfo.repo,
        type: "folder",
        children: repoTree,
      };

      return {
        ...prev,
        fileTree: [...filteredTree, repoFolder],
        activeGitRepo: repoInfo,
      };
    });
  }, [setWorkspaceState]);

  const uploadWorkspace = useCallback((fileTree: FileNode[], repoInfo?: { owner: string; repo: string; branch: string }) => {
    setWorkspaceState(() => ({
      fileTree,
      activeGitRepo: repoInfo,
      openTabs: [],
      activeTabId: null,
    }));
  }, [setWorkspaceState]);

  const addFiles = useCallback((newNodes: FileNode[]) => {
    setWorkspaceState((prev) => {
      const safelyRenamedNodes: FileNode[] = [];
      let currentSiblings = [...prev.fileTree];
      
      for (const node of newNodes) {
        const uniqueName = getUniqueName(node.name, currentSiblings, node.type === "folder");
        // addFiles currently adds to root
        const newId = uniqueName; 
        
        const newNode = { ...node, name: uniqueName, id: newId };
        
        if (newNode.children && uniqueName !== node.name) {
          const updateChildIds = (children: FileNode[], oldParent: string, newParent: string): FileNode[] => {
            return children.map(c => {
              const cNewId = c.id.replace(oldParent, newParent);
              return { ...c, id: cNewId, children: c.children ? updateChildIds(c.children, oldParent, newParent) : undefined };
            });
          };
          newNode.children = updateChildIds(newNode.children, node.id, newId);
        }
        
        safelyRenamedNodes.push(newNode);
        currentSiblings.push(newNode);
      }

      const updatedTree = [...prev.fileTree, ...safelyRenamedNodes];

      // Auto-open the first file if available
      let firstFile: FileNode | null = null;
      const findFirstFile = (nodes: FileNode[]) => {
        for (const n of nodes) {
          if (n.type === "file") {
            firstFile = n;
            return;
          }
          if (n.children) findFirstFile(n.children);
        }
      };
      findFirstFile(newNodes);

      if (firstFile) {
        const target: FileNode = firstFile;
        const alreadyOpen = prev.openTabs.some(t => t.fileId === target.id);
        const newTabs = alreadyOpen
          ? prev.openTabs
          : [
              ...prev.openTabs,
              {
                fileId: target.id,
                name: target.name,
                language: target.language || "plaintext",
                content: target.content || "",
                savedContent: target.content || "",
              },
            ];
        return {
          ...prev,
          fileTree: updatedTree,
          openTabs: newTabs,
          activeTabId: target.id,
        };
      }

      return {
        ...prev,
        fileTree: updatedTree,
      };
    });
  }, [setWorkspaceState]);


  const createFile = useCallback((parentId: string | null, desiredName: string) => {
    setWorkspaceState((prev) => {
      let siblings = prev.fileTree;
      if (parentId) {
        const findParent = (nodes: FileNode[]): FileNode | undefined => {
          for (const node of nodes) {
            if (node.id === parentId) return node;
            if (node.children) {
              const found = findParent(node.children);
              if (found) return found;
            }
          }
        };
        const parent = findParent(prev.fileTree);
        if (parent) {
          siblings = parent.children || [];
        }
      }

      const name = getUniqueName(desiredName, siblings, false);
      const typeInfo = getFileTypeInfo(name);
      const newFile: FileNode = {
        id: parentId ? `${parentId}/${name}` : name,
        name,
        type: "file",
        content: "",
        language: typeInfo.language,
      };

      if (!parentId) {
        return { ...prev, fileTree: [...prev.fileTree, newFile] };
      }

      const insertInto = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(node => {
          if (node.id === parentId && node.type === "folder") {
            return { ...node, children: [...(node.children || []), newFile] };
          }
          if (node.children) {
            return { ...node, children: insertInto(node.children) };
          }
          return node;
        });
      };
      return { ...prev, fileTree: insertInto(prev.fileTree) };
    });
  }, [setWorkspaceState]);

  const createFolder = useCallback((parentId: string | null, desiredName: string) => {
    setWorkspaceState((prev) => {
      let siblings = prev.fileTree;
      if (parentId) {
        const findParent = (nodes: FileNode[]): FileNode | undefined => {
          for (const node of nodes) {
            if (node.id === parentId) return node;
            if (node.children) {
              const found = findParent(node.children);
              if (found) return found;
            }
          }
        };
        const parent = findParent(prev.fileTree);
        if (parent) {
          siblings = parent.children || [];
        }
      }

      const name = getUniqueName(desiredName, siblings, true);
      const newFolder: FileNode = {
        id: parentId ? `${parentId}/${name}` : name,
        name,
        type: "folder",
        children: [],
      };

      if (!parentId) {
        return { ...prev, fileTree: [...prev.fileTree, newFolder] };
      }

      const insertInto = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(node => {
          if (node.id === parentId && node.type === "folder") {
            return { ...node, children: [...(node.children || []), newFolder] };
          }
          if (node.children) {
            return { ...node, children: insertInto(node.children) };
          }
          return node;
        });
      };
      return { ...prev, fileTree: insertInto(prev.fileTree) };
    });
  }, [setWorkspaceState]);

  const deleteNode = useCallback((nodeId: string) => {
    setWorkspaceState((prev) => {
      const removeFrom = (nodes: FileNode[]): FileNode[] => {
        return nodes.filter(node => node.id !== nodeId).map(node => {
          if (node.children) {
            return { ...node, children: removeFrom(node.children) };
          }
          return node;
        });
      };
      
      const newOpenTabs = prev.openTabs.filter(t => !t.fileId.startsWith(nodeId));
      let newActiveTabId = prev.activeTabId;
      if (prev.activeTabId?.startsWith(nodeId)) {
        newActiveTabId = newOpenTabs.length > 0 ? newOpenTabs[newOpenTabs.length - 1].fileId : null;
      }

      return { 
        ...prev, 
        fileTree: removeFrom(prev.fileTree),
        openTabs: newOpenTabs,
        activeTabId: newActiveTabId
      };
    });
  }, [setWorkspaceState]);

  const renameNode = useCallback((nodeId: string, desiredName: string) => {
    setWorkspaceState((prev) => {
      const parentId = nodeId.includes('/') ? nodeId.substring(0, nodeId.lastIndexOf('/')) : null;
      
      let siblings = prev.fileTree;
      if (parentId) {
        const findParent = (nodes: FileNode[]): FileNode | undefined => {
          for (const node of nodes) {
            if (node.id === parentId) return node;
            if (node.children) {
              const found = findParent(node.children);
              if (found) return found;
            }
          }
        };
        const parent = findParent(prev.fileTree);
        if (parent) {
          siblings = parent.children || [];
        }
      }
      
      // Exclude the node itself from sibling checks so renaming to the same name (case diff) works safely
      siblings = siblings.filter(s => s.id !== nodeId);

      const findNode = (nodes: FileNode[]): FileNode | undefined => {
        for (const node of nodes) {
          if (node.id === nodeId) return node;
          if (node.children) {
            const found = findNode(node.children);
            if (found) return found;
          }
        }
      };
      const targetNode = findNode(prev.fileTree);
      if (!targetNode) return prev;

      const newName = getUniqueName(desiredName, siblings, targetNode.type === "folder");
      const newId = parentId ? `${parentId}/${newName}` : newName;

      const renameInTree = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(node => {
          if (node.id === nodeId) {
            const updatedNode = { ...node, id: newId, name: newName };
            if (updatedNode.type === "file") {
              const typeInfo = getFileTypeInfo(newName);
              updatedNode.language = typeInfo.language;
            } else if (updatedNode.children) {
              // Technically we'd need to rename all children paths too, but for simplicity of UI:
              // Rebuilding all child IDs is complex. For a robust app we'd recursively update IDs.
              const updateChildIds = (children: FileNode[], oldParent: string, newParent: string): FileNode[] => {
                return children.map(c => {
                  const cNewId = c.id.replace(oldParent, newParent);
                  return { ...c, id: cNewId, children: c.children ? updateChildIds(c.children, oldParent, newParent) : undefined };
                });
              };
              updatedNode.children = updateChildIds(updatedNode.children, nodeId, newId);
            }
            return updatedNode;
          }
          if (node.children) {
            return { ...node, children: renameInTree(node.children) };
          }
          return node;
        });
      };

      const newOpenTabs = prev.openTabs.map(t => {
        if (t.fileId === nodeId) {
          const typeInfo = getFileTypeInfo(newName);
          return { ...t, fileId: newId, name: newName, language: typeInfo.language };
        } else if (t.fileId.startsWith(nodeId + "/")) {
           return { ...t, fileId: t.fileId.replace(nodeId, newId) };
        }
        return t;
      });

      let newActiveTabId = prev.activeTabId;
      if (prev.activeTabId === nodeId) newActiveTabId = newId;
      else if (prev.activeTabId?.startsWith(nodeId + "/")) newActiveTabId = prev.activeTabId.replace(nodeId, newId);

      return { 
        ...prev, 
        fileTree: renameInTree(prev.fileTree),
        openTabs: newOpenTabs,
        activeTabId: newActiveTabId
      };
    });
  }, [setWorkspaceState]);

  return {
    state,
    openFile,
    closeTab,
    switchTab,
    updateActiveTabContent,
    updateActiveTabLanguage,
    saveActiveTab,
    setCursorPosition,
    uploadWorkspace,
    importGitHubRepo,
    addFiles,
    updateTabNameAndLanguage,
    createFile,
    createFolder,
    deleteNode,
    renameNode,
  };
}
