"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableItemProps {
  id: string;
  label: string;
  visible: boolean;
  onToggleVisibility: (id: string) => void;
}

export function SortableItem({ id, label, visible, onToggleVisibility }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-between p-4 mb-3 rounded-xl border bg-white dark:bg-slate-900 shadow-sm transition-colors",
        isDragging ? "opacity-50 ring-2 ring-primary border-primary z-50 shadow-xl" : "border-border hover:border-primary/50",
        !visible && "opacity-60 bg-muted/30"
      )}
    >
      <div className="flex items-center gap-3">
        <div {...attributes} {...listeners} className="cursor-grab hover:bg-muted p-1 rounded-md active:cursor-grabbing">
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>
        <span className={cn("font-medium", !visible && "line-through text-muted-foreground")}>
          {label}
        </span>
      </div>
      
      <button 
        onClick={() => onToggleVisibility(id)}
        className="p-2 hover:bg-muted rounded-full transition-colors"
        title={visible ? "Hide block" : "Show block"}
      >
        {visible ? (
          <Eye className="h-5 w-5 text-primary" />
        ) : (
          <EyeOff className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}
