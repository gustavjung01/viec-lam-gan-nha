import { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'guest' | 'candidate' | 'ctv' | 'company' | 'admin';

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  isDevMode: boolean;
  toggleDevMode: () => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>('guest');
  // Dev role switcher chỉ hiển thị khi VITE_ENABLE_DEV_ROLE_SWITCHER=true
  const [isDevMode, setIsDevMode] = useState(
    import.meta.env.VITE_ENABLE_DEV_ROLE_SWITCHER === 'true'
  );

  const toggleDevMode = () => setIsDevMode(prev => !prev);

  return (
    <RoleContext.Provider value={{ role, setRole, isDevMode, toggleDevMode }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within RoleProvider');
  }
  return context;
}

// Role guards
export function isGuest(role: UserRole) {
  return role === 'guest' || role === 'candidate';
}

export function isCTV(role: UserRole) {
  return role === 'ctv';
}

export function isCompany(role: UserRole) {
  return role === 'company';
}

export function isAdmin(role: UserRole) {
  return role === 'admin';
}
