"use client";

import React, { useEffect, useState } from "react";

const COLORS = [
  "#E43D12", // Deep Orange
  "#D6536D", // Rose
  "#FFA2B6", // Pink
  "#EFB11D", // Mustard
  "#4318FF", // Horizon Blue (Added for contrast)
];

export function DynamicBackground() {
  const [orbs, setOrbs] = useState<any[]>([]);

  useEffect(() => {
    // Generate 5 random orbs only on the client side
    const newOrbs = Array.from({ length: 5 }).map((_, i) => ({
      id: i,
      color: COLORS[i % COLORS.length],
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      size: `${Math.random() * 30 + 20}vw`, // Random size between 20vw and 50vw
      duration: `${Math.random() * 20 + 20}s`, // Random speed between 20s and 40s
      delay: `${Math.random() * -20}s`,
    }));
    setOrbs(newOrbs);
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none z-[-1]">
      <div className="absolute inset-0 bg-background/80 dark:bg-background/90 backdrop-blur-[80px] z-[1]" />

      {/* Floating Orbs */}
      {orbs.map((orb) => (
        <div
          key={orb.id}
          className="absolute rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[80px] opacity-40 dark:opacity-20 animate-float"
          style={{
            backgroundColor: orb.color,
            top: orb.top,
            left: orb.left,
            width: orb.size,
            height: orb.size,
            animationDuration: orb.duration,
            animationDelay: orb.delay,
          }}
        />
      ))}
    </div>
  );
}