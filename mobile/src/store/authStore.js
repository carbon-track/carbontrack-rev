import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'carbontrack.auth.token';
const USER_KEY = 'carbontrack.auth.user';

const writeSecureItem = async (key, value) => {
  if (value == null) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await SecureStore.setItemAsync(key, value);
};

const useAuthStore = create((set, get) => ({
  token: null,
  user: null,
  isHydrated: false,
  isAuthenticated: false,

  hydrate: async () => {
    try {
      const [token, userJson] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);
      const user = userJson ? JSON.parse(userJson) : null;
      set({
        token,
        user,
        isHydrated: true,
        isAuthenticated: Boolean(token && user),
      });
    } catch {
      set({ token: null, user: null, isHydrated: true, isAuthenticated: false });
    }
  },

  setSession: async ({ token, user }) => {
    await Promise.all([
      writeSecureItem(TOKEN_KEY, token),
      writeSecureItem(USER_KEY, user ? JSON.stringify(user) : null),
    ]);
    set({ token, user, isAuthenticated: Boolean(token && user) });
  },

  setToken: async (token) => {
    await writeSecureItem(TOKEN_KEY, token);
    set({ token, isAuthenticated: Boolean(token && get().user) });
  },

  setUser: async (user) => {
    await writeSecureItem(USER_KEY, user ? JSON.stringify(user) : null);
    set({ user, isAuthenticated: Boolean(get().token && user) });
  },

  logout: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
    set({ token: null, user: null, isAuthenticated: false });
  },
}));

export default useAuthStore;
