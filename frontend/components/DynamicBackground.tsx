"use client";

import React from "react";

export function DynamicBackground() {
  return (
    <div 
      className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none z-[-1] select-none"
      aria-hidden="true"
    >
      {/* Ultra-high-performance GPU-composited ambient gradient */}
      <div 
        className="absolute inset-0 opacity-40 dark:opacity-25 pointer-events-none"
        style={{
          background: "radial-gradient(circle 800px at 15% 15%, rgba(67, 24, 255, 0.12), transparent 80%), radial-gradient(circle 600px at 85% 85%, rgba(228, 61, 18, 0.08), transparent 80%)",
          transform: "translateZ(0)"
        }}
      />
      <div className="absolute inset-0 bg-background/95 pointer-events-none" />
    </div>
  );
}