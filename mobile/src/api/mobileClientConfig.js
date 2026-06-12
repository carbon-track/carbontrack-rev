const MOBILE_CLIENT_TYPE = 'mobile';
const MOBILE_CLIENT_TOKEN = (process.env.EXPO_PUBLIC_MOBILE_CLIENT_TOKEN || '').trim();

export const mobileClientHeaders = {
  'X-Client-Platform': MOBILE_CLIENT_TYPE,
  ...(MOBILE_CLIENT_TOKEN ? { 'X-Mobile-Client-Token': MOBILE_CLIENT_TOKEN } : {}),
};

export const requireMobileClientToken = () => {
  if (!MOBILE_CLIENT_TOKEN) {
    const error = new Error('Mobile client token is not configured.');
    error.code = 'MOBILE_CLIENT_TOKEN_MISSING';
    throw error;
  }

  return MOBILE_CLIENT_TOKEN;
};

export const mobileClientType = MOBILE_CLIENT_TYPE;
