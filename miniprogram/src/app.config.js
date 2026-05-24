export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/record/index',
    'pages/records/index',
    'pages/record-detail/index',
    'pages/store/index',
    'pages/profile/index',
    'pages/login/index',
    'pages/register/index',
    'pages/verify-email/index',
  ],
  window: {
    navigationBarTitleText: 'CarbonTrack',
    navigationBarBackgroundColor: '#0f172a',
    navigationBarTextStyle: 'white',
    backgroundColor: '#f8fafc',
    backgroundTextStyle: 'dark',
  },
  tabBar: {
    color: '#64748b',
    selectedColor: '#0f766e',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页',
      },
      {
        pagePath: 'pages/record/index',
        text: '记录',
      },
      {
        pagePath: 'pages/store/index',
        text: '兑换',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
      },
    ],
  },
});
