"use client";

import React, { useEffect, useState } from 'react';
import api from "@/lib/api";
import { Bell, Check, CheckCheck, Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// import { ScrollArea } from "@/components/ui/scroll-area"; // Removed if not used, using div overflow instead
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      const items = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setNotifications(items);
      setUnreadCount(items.filter((n: any) => !n.is_read).length);
    } catch {
      // Silently ignore — auth may not be ready yet
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkRead = async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch(`/notifications/read-all`);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {}
  };

  const getIcon = (type: string) => {
    switch(type) {
        case 'SUCCESS': return <CheckCircle className="w-4 h-4 text-green-500" />;
        case 'WARNING': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
        case 'ERROR': return <XCircle className="w-4 h-4 text-red-500" />;
        default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:bg-muted">
           <Bell className="w-5 h-5" />
           {unreadCount > 0 && (
             <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-background" />
           )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-xl border-border bg-card">
         
         <div className="flex items-center justify-between p-4 border-b border-border">
            <h4 className="font-semibold text-sm">Notifications</h4>
            {unreadCount > 0 && (
                // FIXED: Removed size="xs" and used classes instead
                <Button 
                    variant="ghost" 
                    onClick={handleMarkAllRead} 
                    className="h-6 px-2 text-xs text-primary hover:bg-primary/10"
                >
                    <CheckCheck className="w-3 h-3 mr-1" /> Mark all read
                </Button>
            )}
         </div>

         <div className="max-h-[300px] overflow-y-auto">
            {notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">No notifications yet.</div>
            ) : (
                <div className="flex flex-col">
                    {notifications.map((n) => (
                        <div 
                            key={n.id} 
                            className={cn(
                                "flex gap-3 p-4 border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors cursor-pointer",
                                !n.is_read && "bg-primary/5"
                            )}
                            onClick={() => handleMarkRead(n.id)}
                        >
                            <div className="mt-1">{getIcon(n.type)}</div>
                            <div className="flex-1 space-y-1">
                                <div className="flex justify-between items-start">
                                    <p className={cn("text-sm font-medium", !n.is_read ? "text-foreground" : "text-muted-foreground")}>
                                        {n.title}
                                    </p>
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">{n.message}</p>
                            </div>
                            {!n.is_read && (
                                <div className="self-center">
                                    <div className="w-2 h-2 bg-primary rounded-full" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
         </div>
      </PopoverContent>
    </Popover>
  );
}