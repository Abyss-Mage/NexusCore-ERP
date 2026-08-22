"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-context";
import { Loader2, Save } from "lucide-react";
import api from "@/lib/api";
import { useRole } from "@/hooks/use-role"; // Import to check permissions

export function SoftwareNameSetting() {
    const { toast } = useToast();
    const { isSudo } = useRole();
    const [softwareName, setSoftwareName] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // 1. Fetch current software name on load
    useEffect(() => {
        setLoading(true);
        api.get('/settings/software-name')
            .then(res => {
                setSoftwareName(res.data?.software_name || 'InvoiceCore');
            })
            .catch(e => console.error("Failed to load current software name.", e))
            .finally(() => setLoading(false));
    }, []);

    // 2. Handle update submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Permission check on button click
        if (!isSudo) return toast( "Access DeniedOnly the Owner can edit core settings.", "error" );
        
        setIsSaving(true);
        
        try {
            await api.put('/settings/software-name', { software_name: softwareName });

            toast("Application name updated. Refreshing UI now.", "success");
            // Force a full page refresh to update Sidebar and Navbar globally
            window.location.reload(); 

        } catch (error) {
            toast("Failed to save application name. Check network/server logs.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return <div className="p-4 text-center text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2"/> Loading settings...</div>;
    }

    return (
        <Card className="shadow-horizon border-none bg-card">
            <CardHeader>
                <CardTitle>Application Name</CardTitle>
                <CardDescription>
                    Customize the name displayed in the navigation bar and document footers.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="software-name">Software Name</Label>
                        <Input 
                            id="software-name" 
                            type="text" 
                            value={softwareName}
                            onChange={(e) => setSoftwareName(e.target.value)}
                            placeholder="e.g., Dapper Detailing Pros"
                            disabled={!isSudo} // Disable if not Sudo Admin
                        />
                    </div>
                    {isSudo && (
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="mr-2 h-4 w-4" />
                            )}
                            Save Name
                        </Button>
                    )}
                    {!isSudo && (
                        <p className="text-sm text-amber-500 italic">View Only Mode: Only the System Owner can change this value.</p>
                    )}
                </form>
            </CardContent>
        </Card>
    );
}