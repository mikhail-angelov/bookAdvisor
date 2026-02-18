import { create } from 'zustand';


export interface User {
  id: string;
  email: string;
  username: string;
}

interface AppState {
  // User
  user: User | null;
  setUser: (user: User | null) => void;
  
}

export const useAppStore = create<AppState>((set) => ({
  // User
  user: null,
  setUser: (user) => set({ user }),
  
}));
