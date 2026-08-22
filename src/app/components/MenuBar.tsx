import React, { useState, useRef, useEffect } from "react";

interface MenuBarProps {
  onNewFile: () => void;
  onNewFolder: () => void;
  onUploadFile: () => void;
  onSave: () => void;
  onDownloadFile: () => void;
  onDownloadZip: () => void;
  onCloseFile: () => void;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  onSetLeftTab: (tab: "explorer" | "github" | "git") => void;
  editorRef: React.RefObject<any>;
  theme?: "dark" | "light";
  hasActiveFile: boolean;
}

type MenuId = "file" | "edit" | "selection" | "view" | null;

export default function MenuBar({
  onNewFile,
  onNewFolder,
  onUploadFile,
  onSave,
  onDownloadFile,
  onDownloadZip,
  onCloseFile,
  onToggleSidebar,
  onToggleTheme,
  onSetLeftTab,
  editorRef,
  theme = "dark",
  hasActiveFile,
}: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<MenuId>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const isLight = theme === "light";

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const execEditorAction = (actionId: string) => {
    const editor = editorRef.current;
    if (editor) {
      editor.focus();
      editor.trigger("menu", actionId, null);
    }
    setOpenMenu(null);
  };

  const handleAction = (fn: () => void) => {
    fn();
    setOpenMenu(null);
  };

  const menuBg = isLight
    ? "bg-white border-gray-200 shadow-lg"
    : "bg-[#1e1e1e] border-panel-border shadow-2xl";
  const itemHover = isLight ? "hover:bg-gray-100" : "hover:bg-white/10";
  const itemText = isLight ? "text-gray-700" : "text-gray-200";
  const itemDisabled = "opacity-40 cursor-default pointer-events-none";
  const separator = isLight ? "border-gray-200" : "border-white/10";

  const MenuItem = ({
    label,
    shortcut,
    onClick,
    disabled,
  }: {
    label: string;
    shortcut?: string;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <button
      className={`w-full flex items-center justify-between px-3 py-1.5 text-[11px] ${itemText} ${disabled ? itemDisabled : itemHover} transition-colors`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <span>{label}</span>
      {shortcut && (
        <span className="text-[10px] text-gray-400 ml-4">{shortcut}</span>
      )}
    </button>
  );

  const Separator = () => <div className={`border-t my-1 ${separator}`} />;

  const menus: { id: MenuId; label: string }[] = [
    { id: "file", label: "File" },
    { id: "edit", label: "Edit" },
    { id: "selection", label: "Selection" },
    { id: "view", label: "View" },
  ];

  return (
    <div
      ref={barRef}
      className={`flex items-center border-b text-xs shrink-0 select-none ${
        isLight
          ? "bg-gray-50 border-gray-200 text-gray-700"
          : "bg-[#0d0d0f] border-panel-border text-gray-300"
      }`}
    >
      {menus.map((menu) => (
        <div key={menu.id} className="relative">
          <button
            className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${
              openMenu === menu.id
                ? isLight
                  ? "bg-gray-200 text-gray-900"
                  : "bg-white/10 text-white"
                : isLight
                ? "hover:bg-gray-200 text-gray-600"
                : "hover:bg-white/10 text-gray-400"
            }`}
            onClick={() => setOpenMenu(openMenu === menu.id ? null : (menu.id as MenuId))}
            onMouseEnter={() => openMenu && setOpenMenu(menu.id as MenuId)}
          >
            {menu.label}
          </button>

          {openMenu === menu.id && (
            <div
              className={`absolute top-full left-0 min-w-[220px] border rounded-md py-1 z-50 ${menuBg}`}
            >
              {menu.id === "file" && (
                <>
                  <MenuItem label="New File" shortcut="" onClick={() => handleAction(onNewFile)} />
                  <MenuItem label="New Folder" onClick={() => handleAction(onNewFolder)} />
                  <Separator />
                  <MenuItem label="Upload File" onClick={() => handleAction(onUploadFile)} />
                  <Separator />
                  <MenuItem label="Save" shortcut="Ctrl+S" onClick={() => handleAction(onSave)} disabled={!hasActiveFile} />
                  <Separator />
                  <MenuItem label="Download File" onClick={() => handleAction(onDownloadFile)} disabled={!hasActiveFile} />
                  <MenuItem label="Download as ZIP" onClick={() => handleAction(onDownloadZip)} />
                  <Separator />
                  <MenuItem label="Close File" onClick={() => handleAction(onCloseFile)} disabled={!hasActiveFile} />
                </>
              )}

              {menu.id === "edit" && (
                <>
                  <MenuItem label="Undo" shortcut="Ctrl+Z" onClick={() => execEditorAction("undo")} disabled={!hasActiveFile} />
                  <MenuItem label="Redo" shortcut="Ctrl+Y" onClick={() => execEditorAction("redo")} disabled={!hasActiveFile} />
                  <Separator />
                  <MenuItem label="Cut" shortcut="Ctrl+X" onClick={() => execEditorAction("editor.action.clipboardCutAction")} disabled={!hasActiveFile} />
                  <MenuItem label="Copy" shortcut="Ctrl+C" onClick={() => execEditorAction("editor.action.clipboardCopyAction")} disabled={!hasActiveFile} />
                  <MenuItem label="Paste" shortcut="Ctrl+V" onClick={() => { document.execCommand("paste"); setOpenMenu(null); }} disabled={!hasActiveFile} />
                  <Separator />
                  <MenuItem label="Select All" shortcut="Ctrl+A" onClick={() => execEditorAction("editor.action.selectAll")} disabled={!hasActiveFile} />
                  <MenuItem label="Find" shortcut="Ctrl+F" onClick={() => execEditorAction("actions.find")} disabled={!hasActiveFile} />
                  <MenuItem label="Replace" shortcut="Ctrl+H" onClick={() => execEditorAction("editor.action.startFindReplaceAction")} disabled={!hasActiveFile} />
                </>
              )}

              {menu.id === "selection" && (
                <>
                  <MenuItem label="Select All" shortcut="Ctrl+A" onClick={() => execEditorAction("editor.action.selectAll")} disabled={!hasActiveFile} />
                  <MenuItem label="Select Line" onClick={() => execEditorAction("expandLineSelection")} disabled={!hasActiveFile} />
                  <MenuItem label="Select All Occurrences" shortcut="Ctrl+Shift+L" onClick={() => execEditorAction("editor.action.selectHighlights")} disabled={!hasActiveFile} />
                  <Separator />
                  <MenuItem label="Expand Selection" shortcut="Shift+Alt+→" onClick={() => execEditorAction("editor.action.smartSelect.expand")} disabled={!hasActiveFile} />
                  <MenuItem label="Shrink Selection" shortcut="Shift+Alt+←" onClick={() => execEditorAction("editor.action.smartSelect.shrink")} disabled={!hasActiveFile} />
                </>
              )}

              {menu.id === "view" && (
                <>
                  <MenuItem label="Explorer" onClick={() => handleAction(() => onSetLeftTab("explorer"))} />
                  <MenuItem label="Source Control" onClick={() => handleAction(() => onSetLeftTab("git"))} />
                  <MenuItem label="GitHub" onClick={() => handleAction(() => onSetLeftTab("github"))} />
                  <Separator />
                  <MenuItem label="Toggle Sidebar" onClick={() => handleAction(onToggleSidebar)} />
                  <MenuItem label="Toggle Theme" onClick={() => handleAction(onToggleTheme)} />
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
