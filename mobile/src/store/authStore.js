import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'carbontrack.auth.token';
const REFRESH_TOKEN_KEY = 'carbontrack.auth.refreshToken';
const USER_KEY = 'carbontrack.auth.user';
const EMAIL_VERIFICATION_REQUIRED_KEY = 'carbontrack.auth.emailVerificationRequired';
const VERIFICATION_EMAIL_KEY = 'carbontrack.auth.verificationEmail';
const SESSION_KEYS = [
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  USER_KEY,
  EMAIL_VERIFICATION_REQUIRED_KEY,
  VERIFICATION_EMAIL_KEY,
];

const writeSecureItem = async (key, value) => {
  if (value == null) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await SecureStore.setItemAsync(key, value);
};

const useAuthStore = create((set, get) => ({
  token: null,
  refreshToken: null,
  user: null,
  isHydrated: false,
  isAuthenticated: false,
  requiresEmailVerification: false,
  verificationEmail: null,

  hydrate: async () => {
    try {
      const [token, refreshToken, userJson, emailVerificationRequired, verificationEmail] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.getItemAsync(USER_KEY),
        SecureStore.getItemAsync(EMAIL_VERIFICATION_REQUIRED_KEY),
        SecureStore.getItemAsync(VERIFICATION_EMAIL_KEY),
      ]);
      const user = userJson ? JSON.parse(userJson) : null;
      const requiresEmailVerification = token && user && emailVerificationRequired === 'true';
      set({
        token,
        refreshToken,
        user,
        isHydrated: true,
        isAuthenticated: Boolean(token && user),
        requiresEmailVerification,
        verificationEmail: requiresEmailVerification ? verificationEmail || user?.email || null : null,
      });
    } catch {
      set({
        token: null,
        refreshToken: null,
        user: null,
        isHydrated: true,
        isAuthenticated: false,
        requiresEmailVerification: false,
        verificationEmail: null,
      });
    }
  },

  setSession: async ({
    token,
    refresh_token: refreshToken,
    user,
    email_verification_required: emailVerificationRequired,
    preserve_email_verification_required: preserveEmailVerificationRequired,
  }) => {
    const hasVerificationFlag = emailVerificationRequired !== undefined && emailVerificationRequired !== null;
    const current = get();
    const requiresEmailVerification = hasVerificationFlag
      ? Boolean(emailVerificationRequired)
      : Boolean(preserveEmailVerificationRequired && current.requiresEmailVerification);
    const verificationEmail = requiresEmailVerification ? user?.email || current.verificationEmail || null : null;
    const nextRefreshToken = refreshToken ?? current.refreshToken ?? null;
    await Promise.all([
      writeSecureItem(TOKEN_KEY, token),
      writeSecureItem(REFRESH_TOKEN_KEY, nextRefreshToken),
      writeSecureItem(USER_KEY, user ? JSON.stringify(user) : null),
      writeSecureItem(EMAIL_VERIFICATION_REQUIRED_KEY, requiresEmailVerification ? 'true' : null),
      writeSecureItem(VERIFICATION_EMAIL_KEY, verificationEmail),
    ]);
    set({
      token,
      refreshToken: nextRefreshToken,
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

  setRefreshToken: async (refreshToken) => {
    await writeSecureItem(REFRESH_TOKEN_KEY, refreshToken);
    set({ refreshToken });
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
    await Promise.all(SESSION_KEYS.map((key) => SecureStore.deleteItemAsync(key)));
    set({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      requiresEmailVerification: false,
      verificationEmail: null,
    });
  },
}));

export default useAuthStore;
