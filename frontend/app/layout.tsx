import React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { DynamicBackground } from "@/components/DynamicBackground";
import { AppLayout } from "@/components/AppLayout";
import { ToastProvider } from "@/components/ui/toast-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "InvoiceCore",
  description: "Enterprise ERP & Invoicing Platform",
};

import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import "@astryxdesign/theme-neutral/theme.css";

import { BusinessProvider } from "@/contexts/business-context";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
      </head>
      <body className={cn(inter.className, "min-h-screen w-full flex bg-background text-foreground antialiased overflow-hidden")}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} forcedTheme="dark">
          <Theme theme={neutralTheme} style={{ height: "100%", display: "flex", flex: 1, flexDirection: "column" }}>
            <ToastProvider>
              <BusinessProvider>
                {/* Background Orbs persist on Login Page for branding */}
                <DynamicBackground />

                {/* New Client-Side Layout Wrapper */}
                <AppLayout>
                   {children}
                </AppLayout>
              </BusinessProvider>
            </ToastProvider>
          </Theme>
        </ThemeProvider>
      </body>
    </html>
  );
}
