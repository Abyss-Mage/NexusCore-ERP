"use client";

import { useEffect, useState } from 'react';

export function useRole() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Helper to safely parse JSON
    const getRoleFromStorage = () => {
      if (typeof window === 'undefined') return null;
      
      try {
        const userStr = localStorage.getItem('user');
        if (!userStr) return null;
        
        const user = JSON.parse(userStr);
        return user.role || null;
      } catch (e) {
        console.error("Error parsing user role from storage", e);
        return null;
      }
    };

    const currentRole = getRoleFromStorage();
    setRole(currentRole);
    setLoading(false);
  }, []);

  const isSudo = role === 'SUDO_ADMIN';
  const isAdmin = role === 'ADMIN' || isSudo;
  const isAccountant = role === 'ACCOUNTANT';
  const isOperator = role === 'OPERATOR';
  const isStaff = role === 'STAFF';
  const isViewer = role === 'VIEWER';

  return {
    role,
    loading,
    // Role Hierarchy Flags
    isSudo,
    isAdmin,
    isAccountant,
    isOperator,
    isStaff,
    isViewer,
    isUser: role === 'USER' || role === 'VIEWER',

    // Capability Matrix
    canAccess3D: isAdmin || isOperator,
    canAccessSoftware: isAdmin || isStaff,
    canAccessFinance: isAdmin || isAccountant,
    canAccessVault: isAdmin,
    canAccessReports: isAdmin || isAccountant,
    canManageUsers: isAdmin,
    canManageSettings: isAdmin,
  };
}