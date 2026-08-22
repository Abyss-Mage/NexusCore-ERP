"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import { Maximize2 } from "lucide-react";

interface ChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode; // For filters like Year Select
  className?: string;
}

export function ChartCard({ title, description, children, action, className }: ChartCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`glass-panel p-6 rounded-xl flex flex-col ${className}`}>
      <div className="flex flex-row items-center justify-between pb-4 space-y-0 shrink-0">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-on-surface">{title}</h3>
          {description && <p className="text-sm text-on-surface-variant">{description}</p>}
        </div>

        <div className="flex items-center gap-2">
          {/* Custom Action (e.g. Filter) */}
          {action && <div>{action}</div>}

          {/* Full Screen Trigger */}
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-on-surface-variant hover:text-primary hover:bg-white/5"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            
            <DialogContent className="sm:max-w-[95vw] w-[95vw] h-[90vh] flex flex-col p-6 sm:p-8 bg-surface-container border-white/10 text-on-surface">
              <DialogHeader className="mb-4 shrink-0 flex flex-row items-center justify-between space-y-0">
                <div className="space-y-1">
                  <DialogTitle className="text-2xl font-bold">{title}</DialogTitle>
                  {description && (
                    <DialogDescription className="text-on-surface-variant">{description}</DialogDescription>
                  )}
                </div>
              </DialogHeader>

              <div className="flex-1 w-full h-full min-h-0 relative" key="fullscreen-mode">
                {children}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="h-[300px] min-h-[300px] w-full relative">
        {children}
      </div>
    </div>
  );
}