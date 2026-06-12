const appConfig = require('./app.json');

module.exports = () => {
  const profile = (process.env.EAS_BUILD_PROFILE || '').trim();
  const mobileClientToken = (process.env.EXPO_PUBLIC_MOBILE_CLIENT_TOKEN || '').trim();

  if (profile === 'production' && mobileClientToken === '') {
    throw new Error('EXPO_PUBLIC_MOBILE_CLIENT_TOKEN must be configured for production mobile builds.');
  }

  return appConfig.expo;
};
