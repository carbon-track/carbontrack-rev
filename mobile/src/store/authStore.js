import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'carbontrack.auth.token';
const USER_KEY = 'carbontrack.auth.user';
const EMAIL_VERIFICATION_REQUIRED_KEY = 'carbontrack.auth.emailVerificationRequired';
const VERIFICATION_EMAIL_KEY = 'carbontrack.auth.verificationEmail';

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
  requiresEmailVerification: false,
  verificationEmail: null,

  hydrate: async () => {
    try {
      const [token, userJson, emailVerificationRequired, verificationEmail] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(USER_KEY),
        SecureStore.getItemAsync(EMAIL_VERIFICATION_REQUIRED_KEY),
        SecureStore.getItemAsync(VERIFICATION_EMAIL_KEY),
      ]);
      const user = userJson ? JSON.parse(userJson) : null;
      const requiresEmailVerification = token && user && emailVerificationRequired === 'true';
      set({
        token,
        user,
        isHydrated: true,
        isAuthenticated: Boolean(token && user),
        requiresEmailVerification,
        verificationEmail: requiresEmailVerification ? verificationEmail || user?.email || null : null,
      });
    } catch {
      set({
        token: null,
        user: null,
        isHydrated: true,
        isAuthenticated: false,
        requiresEmailVerification: false,
        verificationEmail: null,
      });
    }
  },

  setSession: async ({ token, user, email_verification_required: emailVerificationRequired }) => {
    const requiresEmailVerification = Boolean(emailVerificationRequired);
    const verificationEmail = requiresEmailVerification ? user?.email || null : null;
    await Promise.all([
      writeSecureItem(TOKEN_KEY, token),
      writeSecureItem(USER_KEY, user ? JSON.stringify(user) : null),
      writeSecureItem(EMAIL_VERIFICATION_REQUIRED_KEY, requiresEmailVerification ? 'true' : null),
      writeSecureItem(VERIFICATION_EMAIL_KEY, verificationEmail),
    ]);
    set({
      token,
      user,
      isAuthenticated: Boolean(token && user),
      requiresEmailVerification,
      verificationEmail,
    });
  },

  setToken: async (token) => {
    await writeSecureItem(TOKEN_KEY, token);
    set({ token, isAuthenticated: Boolean(token && get().user) });
  },

  setUser: async (user) => {
    await writeSecureItem(USER_KEY, user ? JSON.stringify(user) : null);
    set({ user, isAuthenticated: Boolean(get().token && user) });
  },

  clearEmailVerificationRequired: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(EMAIL_VERIFICATION_REQUIRED_KEY),
      SecureStore.deleteItemAsync(VERIFICATION_EMAIL_KEY),
    ]);
    set({ requiresEmailVerification: false, verificationEmail: null });
  },

  logout: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
      SecureStore.deleteItemAsync(EMAIL_VERIFICATION_REQUIRED_KEY),
      SecureStore.deleteItemAsync(VERIFICATION_EMAIL_KEY),
    ]);
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      requiresEmailVerification: false,
      verificationEmail: null,
    });
  },
}));

export default useAuthStore;
