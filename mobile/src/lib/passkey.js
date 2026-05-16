async function loadPasskeyModule() {
  let passkeys;
  try {
    passkeys = await import('react-native-passkeys');
  } catch {
    throw new Error('PASSKEY_UNAVAILABLE');
  }

  if (typeof passkeys.isSupported === 'function' && !passkeys.isSupported()) {
    throw new Error('PASSKEY_UNAVAILABLE');
  }

  return passkeys;
}

export async function authenticateWithPasskey(publicKey) {
  const passkeys = await loadPasskeyModule();
  const credential = await passkeys.get(publicKey);
  if (!credential) {
    throw new Error('PASSKEY_CANCELLED');
  }

  return credential;
}

export async function registerWithPasskey(publicKey) {
  const passkeys = await loadPasskeyModule();
  const credential = await passkeys.create(publicKey);
  if (!credential) {
    throw new Error('PASSKEY_CANCELLED');
  }

  return credential;
}
