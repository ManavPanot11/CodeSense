import React from "react";
import { X, FileCode } from "lucide-react";
import { OpenTab } from "../hooks/useWorkspace";
import { getFileTypeInfo } from "@/lib/fileTypes";

interface EditorTabsProps {
  tabs: OpenTab[];
  activeTabId: string | null;
  onSwitchTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  theme?: "dark" | "light";
}

export default function EditorTabs({ tabs, activeTabId, onSwitchTab, onCloseTab, theme = "dark" }: EditorTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div className={`flex border-b overflow-x-auto hide-scrollbar ${
      theme === "light" 
        ? "bg-gray-100 border-gray-200" 
        : "bg-[#18181b] border-panel-border"
    }`}>
      {tabs.map((tab) => {
        const isActive = tab.fileId === activeTabId;
        const isDirty = tab.content !== tab.savedContent;
        const typeInfo = getFileTypeInfo(tab.name);
        const FileIcon = typeInfo.icon || FileCode;

        return (
          <div
            key={tab.fileId}
            onClick={() => onSwitchTab(tab.fileId)}
            className={`flex items-center gap-2 px-3 py-2 text-xs cursor-pointer border-r min-w-[120px] max-w-[200px] group transition-colors select-none ${
              theme === "light"
                ? isActive
                  ? "bg-white text-gray-900 border-t-2 border-t-primary font-medium shadow-xs border-r-gray-200"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200 border-t-2 border-t-transparent border-r-gray-200"
                : isActive 
                  ? "bg-[#1e1e1e] text-white border-t-2 border-t-primary border-r-panel-border" 
                  : "bg-[#141416] text-gray-400 hover:bg-[#1a1a1c] border-t-2 border-t-transparent border-r-panel-border"
            }`}
          >
            <FileIcon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-primary' : 'text-gray-400'}`} />
            <span className="truncate flex-1">{tab.name}</span>
            
            <div className="flex items-center justify-center w-4 h-4 ml-1 flex-shrink-0">
              {isDirty ? (
                <span className={`w-2 h-2 rounded-full group-hover:hidden ${theme === "light" ? "bg-gray-700" : "bg-white"}`} />
              ) : null}
              <button
                className={`w-4 h-4 rounded-xs flex items-center justify-center hover:bg-black/10 transition-colors ${isDirty ? 'hidden group-hover:flex' : 'opacity-0 group-hover:opacity-100'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.fileId);
                }}
                title="Close Tab"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
