"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Loader2, ShieldAlert, UserPlus, Shield, Edit2, Check, X } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";
import { useRole } from "@/hooks/use-role";

interface TeamSettingsProps {
  disabled?: boolean;
}

const ROLES = [
  { value: "STAFF", label: "Staff (Software / Projects)", desc: "Software tasks, sprint milestones, time logging" },
  { value: "OPERATOR", label: "Operator (3D Print Farm)", desc: "Kanban jobs, filament spools, printer telemetry & MQTT" },
  { value: "ACCOUNTANT", label: "Accountant (Finance & Tax)", desc: "Invoices, quotations, ledger, GST & tax reports" },
  { value: "ADMIN", label: "Administrator (Operations)", desc: "Full operational control across agency & print farm" },
  { value: "SUDO_ADMIN", label: "Super Admin (Owner)", desc: "Unrestricted platform ownership, user RBAC & server settings" },
  { value: "VIEWER", label: "Viewer (Auditor)", desc: "Read-only access across records without editing rights" },
];

export function TeamSettings({ disabled }: TeamSettingsProps) {
  const { toast } = useToast();
  const { isSudo, isAdmin } = useRole();
  const [users, setUsers] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'STAFF' });
  const [loading, setLoading] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingRole, setEditingRole] = useState<string>('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(Array.isArray(res.data) ? res.data : (res.data.data || []));
    } catch (e) {
      console.error("Failed to load users", e);
    }
  };

  const createUser = async () => {
    if (disabled || !isAdmin) return;
    if (!newUser.email || !newUser.password) {
      return toast("Email and Password are required", "warning");
    }
    
    setLoading(true);
    try { 
      await api.post('/users', newUser); 
      setNewUser({ email: '', password: '', role: 'STAFF' }); 
      loadUsers(); 
      toast("Team member added successfully!", "success");
    } 
    catch(e: any) { 
      toast(e.response?.data?.error || "Failed to create user", "error"); 
    } 
    finally { 
      setLoading(false); 
    }
  };

  const handleUpdateRole = async (userId: number) => {
    if (!editingRole) return;
    try {
      await api.put(`/users/${userId}`, { role: editingRole });
      toast("User role updated", "success");
      setEditingUserId(null);
      loadUsers();
    } catch (e: any) {
      toast(e.response?.data?.error || "Failed to update role", "error");
    }
  };

  const deleteUser = async (id: number) => {
    if (disabled || !isAdmin) return;
    if (!confirm("Are you sure you want to remove this user from the organization?")) return;

    try { 
      await api.delete(`/users/${id}`); 
      loadUsers();
      toast("User deleted successfully", "success");
    } catch(e: any) { 
      toast(e.response?.data?.error || "Delete failed", "error"); 
    }
  };

  const canManage = isAdmin && !disabled;

  const getRoleBadgeVariant = (role: string) => {
    switch(role) {
      case 'SUDO_ADMIN': return 'default';
      case 'ADMIN': return 'secondary';
      case 'ACCOUNTANT': return 'outline';
      case 'OPERATOR': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <Card className="shadow-horizon border-none bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" /> Team &amp; RBAC Access Control
        </CardTitle>
        <CardDescription>
          Assign granular roles to team members, operators, accountants, and administrators.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ADD USER FORM */}
        {canManage ? (
          <div className="bg-muted/30 p-5 rounded-xl border border-border space-y-4">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" /> Invite / Add Team Member
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="space-y-1.5 md:col-span-1">
                <Label className="text-xs">Email Address</Label>
                <Input 
                  placeholder="member@company.com" 
                  value={newUser.email} 
                  onChange={e => setNewUser({...newUser, email: e.target.value})} 
                  className="bg-background text-xs"
                />
              </div>

              <div className="space-y-1.5 md:col-span-1">
                <Label className="text-xs">Temporary Password</Label>
                <Input 
                  type="password" 
                  placeholder="Minimum 8 characters" 
                  value={newUser.password} 
                  onChange={e => setNewUser({...newUser, password: e.target.value})} 
                  className="bg-background text-xs"
                />
              </div>

              <div className="space-y-1.5 md:col-span-1">
                <Label className="text-xs">Assigned Role</Label>
                <Select value={newUser.role} onValueChange={val => setNewUser({...newUser, role: val})}>
                  <SelectTrigger className="bg-background text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => (
                      <SelectItem key={r.value} value={r.value} disabled={r.value === 'SUDO_ADMIN' && !isSudo}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-1">
                <Button onClick={createUser} disabled={loading} className="w-full bg-primary text-primary-foreground text-xs font-semibold">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <><UserPlus className="w-4 h-4 mr-1.5"/> Add Member</>}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 rounded-lg flex items-center gap-3 text-amber-800 dark:text-amber-200 text-sm">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>Only Administrators can manage team roles and permissions.</span>
          </div>
        )}

        {/* USERS TABLE */}
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Team Member</TableHead>
                <TableHead>Role &amp; Permissions</TableHead>
                <TableHead>2FA Security</TableHead>
                <TableHead className="text-right">Member Since</TableHead>
                {canManage && <TableHead className="w-[100px] text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-semibold text-foreground">{u.email}</TableCell>
                  <TableCell>
                    {editingUserId === u.id ? (
                      <div className="flex items-center gap-2">
                        <Select value={editingRole} onValueChange={setEditingRole}>
                          <SelectTrigger className="h-8 text-xs bg-background w-[180px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROLES.map(r => (
                              <SelectItem key={r.value} value={r.value} disabled={r.value === 'SUDO_ADMIN' && !isSudo}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-500" onClick={() => handleUpdateRole(u.id)}>
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingUserId(null)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant={getRoleBadgeVariant(u.role)} className="font-mono text-xs">
                          {u.role.replace('_', ' ')}
                        </Badge>
                        {canManage && u.role !== 'SUDO_ADMIN' && (
                          <button 
                            onClick={() => { setEditingUserId(u.id); setEditingRole(u.role); }}
                            className="text-muted-foreground hover:text-foreground text-xs p-1"
                            title="Edit Role"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.two_factor_enabled 
                      ? <Badge className="bg-emerald-500/15 text-emerald-600 border-none font-semibold text-[11px]">2FA Active</Badge> 
                      : <span className="text-muted-foreground text-xs">Unsecured</span>
                    }
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      {u.role !== 'SUDO_ADMIN' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => deleteUser(u.id)} 
                          className="hover:bg-rose-500/10 hover:text-rose-500 rounded-lg h-8 w-8"
                          title="Remove user"
                        >
                          <Trash2 className="w-4 h-4"/>
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
