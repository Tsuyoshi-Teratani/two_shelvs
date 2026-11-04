import { create } from 'zustand';
import type { User } from 'firebase/auth';
import { subscribeAuth } from '../firebase';

interface AuthState {
  user: User | null;
  /** 現在ログイン中の店舗オーナーのshopId（= uid）。未ログインならnull */
  shopId: string | null;
  loading: boolean;
  _started: boolean;
  start: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  shopId: null,
  loading: true,
  _started: false,

  // App起動時に一度だけonAuthStateChangedを購読する
  start: () => {
    if (get()._started) return;
    set({ _started: true });
    subscribeAuth((user) => {
      set({ user, shopId: user?.uid ?? null, loading: false });
    });
  },
}));
