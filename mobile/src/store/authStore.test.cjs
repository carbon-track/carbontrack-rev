const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const loadAuthStore = () => {
  const sourcePath = path.join(__dirname, 'authStore.js');
  const source = fs.readFileSync(sourcePath, 'utf8')
    .replace("import { create } from 'zustand';", '')
    .replace("import * as SecureStore from 'expo-secure-store';", '')
    .replace('export default useAuthStore;', 'module.exports = useAuthStore;');

  const secureItems = new Map();
  const create = (initializer) => {
    let state;
    const listeners = new Set();
    const set = (partial) => {
      state = { ...state, ...(typeof partial === 'function' ? partial(state) : partial) };
      listeners.forEach((listener) => listener(state));
    };
    const get = () => state;
    const store = (selector = (value) => value) => selector(state);
    store.getState = get;
    store.setState = set;
    store.subscribe = (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    state = initializer(set, get);
    return store;
  };

  const context = {
    module: { exports: {} },
    exports: {},
    create,
    SecureStore: {
      getItemAsync: async (key) => secureItems.get(key) ?? null,
      setItemAsync: async (key, value) => secureItems.set(key, value),
      deleteItemAsync: async (key) => secureItems.delete(key),
    },
  };
  vm.runInNewContext(source, context, { filename: sourcePath });

  return { useAuthStore: context.module.exports, secureItems };
};

test('setSession persists refresh token and hydrate restores it', async () => {
  const { useAuthStore, secureItems } = loadAuthStore();

  await useAuthStore.getState().setSession({
    token: 'access-token',
    refresh_token: 'refresh-token',
    user: { id: 1, username: 'mobile_user' },
  });

  assert.equal(useAuthStore.getState().refreshToken, 'refresh-token');
  assert.equal(secureItems.get('carbontrack.auth.refreshToken'), 'refresh-token');

  useAuthStore.setState({
    token: null,
    refreshToken: null,
    user: null,
    isAuthenticated: false,
    isHydrated: false,
  });

  await useAuthStore.getState().hydrate();

  assert.equal(useAuthStore.getState().token, 'access-token');
  assert.equal(useAuthStore.getState().refreshToken, 'refresh-token');
  assert.equal(useAuthStore.getState().isAuthenticated, true);
});

test('logout clears refresh token with the rest of the session', async () => {
  const { useAuthStore, secureItems } = loadAuthStore();

  await useAuthStore.getState().setSession({
    token: 'access-token',
    refresh_token: 'refresh-token',
    user: { id: 1, username: 'mobile_user' },
  });
  await useAuthStore.getState().logout();

  assert.equal(useAuthStore.getState().refreshToken, null);
  assert.equal(secureItems.has('carbontrack.auth.refreshToken'), false);
});
