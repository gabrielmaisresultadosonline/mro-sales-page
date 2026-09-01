// User and SquareCloud API Types
import { ProfileSession } from './instagram';

export interface MROUser {
  username: string;
  email?: string;
  daysRemaining: number; // >365 = lifetime, otherwise actual days
  loginAt: string;
  registeredIGs: RegisteredIG[];
  creativesUnlocked?: boolean; // Only for lifetime users - admin can unlock
  isEmailLocked?: boolean; // True if email has been set and locked
}

export interface RegisteredIG {
  username: string; // always lowercase, no @
  registeredAt: string;
  email: string;
  printSent: boolean;
  syncedFromSquare: boolean;
}

export interface SquareLoginResponse {
  senhaCorrespondente: boolean;
  diasRestantes?: number;
}

export interface SquareVerifyIGResponse {
  success: boolean;
  igInstagram?: string[];
  igTesteUserMro?: string[];
}

export interface SquareAddIGResponse {
  success: boolean;
  message?: string;
}

export interface CloudData {
  profileSessions: ProfileSession[];
  archivedProfiles: ProfileSession[];
}

export interface UserSession {
  user: MROUser | null;
  isAuthenticated: boolean;
  lastSync: string;
  cloudData?: CloudData; // Data loaded from cloud storage
}

export type { UserSession as UserSessionType };

// Normalize Instagram username from URL or handle
export const normalizeInstagramUsername = (input: string): string => {
  let username = input.trim().toLowerCase();
  
  // Remove @ if present
  username = username.replace(/^@/, '');
  
  // Extract from full URL
  // Handles: https://instagram.com/username, https://www.instagram.com/username/, etc.
  const urlMatch = username.match(/(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9._]+)/i);
  if (urlMatch) {
    username = urlMatch[1].toLowerCase();
  }
  
  // Remove trailing slashes or query params
  username = username.split('/')[0].split('?')[0];
  
  return username;
};

// Check if days indicate lifetime access (> 365 days)
export const isLifetimeAccess = (days: number): boolean => {
  return days > 365;
};

// Format days display
export const formatDaysRemaining = (days: number): string => {
  if (isLifetimeAccess(days)) {
    return 'Vitalício';
  }
  if (days <= 30) {
    return `${days} dias`;
  }
  return `${days} dias`;
};

// Check if user can use creatives generator
export const canUseCreatives = (user: MROUser | null): { allowed: boolean; reason?: string } => {
  if (!user) {
    return { allowed: false, reason: 'Usuário não autenticado' };
  }
  
  // Lifetime users need admin unlock
  if (isLifetimeAccess(user.daysRemaining)) {
    if (user.creativesUnlocked) {
      return { allowed: true };
    }
    return { 
      allowed: false, 
      reason: 'Usuários vitalícios precisam de liberação do administrador para usar o gerador de criativos. Entre em contato com o administrador.' 
    };
  }
  
  // Regular users (365 days or less) can use normally
  return { allowed: true };
};
