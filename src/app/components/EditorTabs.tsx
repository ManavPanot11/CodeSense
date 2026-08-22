import React from "react";
import { X, FileCode } from "lucide-react";
import { OpenTab } from "../hooks/useWorkspace";

interface EditorTabsProps {
  tabs: OpenTab[];
  activeTabId: string | null;
  onSwitchTab: (id: string) => void;
  onCloseTab: (id: string) => void;
}

export default function EditorTabs({ tabs, activeTabId, onSwitchTab, onCloseTab }: EditorTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex bg-[#1e1e1e] border-b border-panel-border overflow-x-auto hide-scrollbar">
      {tabs.map((tab) => {
        const isActive = tab.fileId === activeTabId;
        const isDirty = tab.content !== tab.savedContent;

        return (
          <div
            key={tab.fileId}
            onClick={() => onSwitchTab(tab.fileId)}
            className={`flex items-center gap-2 px-3 py-2 text-xs cursor-pointer border-r border-panel-border min-w-[120px] max-w-[200px] group transition-colors ${
              isActive 
                ? "bg-[#252526] text-white border-t-2 border-t-primary" 
                : "bg-[#2d2d2d] text-gray-400 hover:bg-[#2a2a2b] border-t-2 border-t-transparent"
            }`}
          >
            <FileCode className={`w-3.5 h-3.5 ${isActive ? 'text-primary' : 'text-gray-500'}`} />
            <span className="truncate flex-1">{tab.name}</span>
            
            <div className="flex items-center justify-center w-5 h-5 ml-1">
              {isDirty ? (
                <span className="w-2 h-2 rounded-full bg-white group-hover:hidden" />
              ) : null}
              <button
                className={`w-4 h-4 rounded-sm flex items-center justify-center hover:bg-white/10 ${isDirty ? 'hidden group-hover:flex' : 'opacity-0 group-hover:opacity-100'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.fileId);
                }}
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
