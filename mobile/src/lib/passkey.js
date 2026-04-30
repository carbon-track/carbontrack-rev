export async function authenticateWithPasskey(publicKey) {
  let passkeys;
  try {
    passkeys = await import('react-native-passkeys');
  } catch {
    throw new Error('PASSKEY_UNAVAILABLE');
  }

  if (typeof passkeys.isSupported === 'function' && !passkeys.isSupported()) {
    throw new Error('PASSKEY_UNAVAILABLE');
  }

  const credential = await passkeys.get(publicKey);
  if (!credential) {
    throw new Error('PASSKEY_CANCELLED');
  }

  return credential;
}
