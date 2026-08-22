import { useState, useEffect, useCallback } from "react";
import * as idb from "idb-keyval";

export interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  content?: string;
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
}

const STORAGE_KEY = "codesense_workspace_state";

const DEFAULT_STATE: WorkspaceState = {
  fileTree: [
    {
      id: "root/index.js",
      name: "index.js",
      type: "file",
      content: '// Write some code here...\nfunction calculateTotal(items) {\n  let total = 0;\n  for(let i = 0; i < items.length; i++) {\n    total += items[i].price;\n  }\n  return total;\n}\n\n// Try running it!\nconsole.log(calculateTotal([{price:10},{price:20},{price:30}]));',
      language: "javascript",
    }
  ],
  openTabs: [
    {
      fileId: "root/index.js",
      name: "index.js",
      language: "javascript",
      content: '// Write some code here...\nfunction calculateTotal(items) {\n  let total = 0;\n  for(let i = 0; i < items.length; i++) {\n    total += items[i].price;\n  }\n  return total;\n}\n\n// Try running it!\nconsole.log(calculateTotal([{price:10},{price:20},{price:30}]));',
      savedContent: '// Write some code here...\nfunction calculateTotal(items) {\n  let total = 0;\n  for(let i = 0; i < items.length; i++) {\n    total += items[i].price;\n  }\n  return total;\n}\n\n// Try running it!\nconsole.log(calculateTotal([{price:10},{price:20},{price:30}]));'
    }
  ],
  activeTabId: "root/index.js"
};

import { getFileTypeInfo } from "@/lib/fileTypes";

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
      return {
        ...prev,
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

  // --- Folder Upload ---

  const uploadWorkspace = useCallback((fileTree: FileNode[]) => {
    setWorkspaceState(() => ({
      fileTree,
      openTabs: [],
      activeTabId: null,
    }));
  }, [setWorkspaceState]);


  const createFile = useCallback((parentId: string | null, name: string) => {
    setWorkspaceState((prev) => {
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

  const createFolder = useCallback((parentId: string | null, name: string) => {
    setWorkspaceState((prev) => {
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

  const renameNode = useCallback((nodeId: string, newName: string) => {
    setWorkspaceState((prev) => {
      const parentId = nodeId.includes('/') ? nodeId.substring(0, nodeId.lastIndexOf('/')) : null;
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
    createFile,
    createFolder,
    deleteNode,
    renameNode,
  };
}
