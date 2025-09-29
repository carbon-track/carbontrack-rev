import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, 
  X, 
  Home, 
  Calculator, 
  BarChart3, 
  ShoppingBag, 
  Settings, 
  LogOut,
  Bell
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { checkAuthStatus, authAPI } from '../../lib/auth';
import { useUnreadMessagesCount } from '../../hooks/useUnreadMessagesCount';
import LanguageSwitcher from '../LanguageSwitcher';
import { Button } from '../ui/Button';
import R2Image from '../common/R2Image';

export function Navbar() {
  const { t } = useTranslation();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { count: unreadCount, isLoading: unreadLoading } = useUnreadMessagesCount();
  const navigate = useNavigate();

  useEffect(() => {
    const { isAuthenticated: authStatus, user: currentUser } = checkAuthStatus();
    setIsAuthenticated(authStatus);
    setUser(currentUser);

    let cancelled = false;

    if (authStatus) {
      (async () => {
        try {
          const freshUser = await authAPI.getCurrentUser();
          if (!cancelled && freshUser) {
            setUser(freshUser);
          }
        } catch (error) {
          console.error('Failed to refresh current user information', error);
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      setIsAuthenticated(false);
      setUser(null);
    } catch (e) {
      console.error('Logout failed:', e);
    } finally {
      // 统一跳转到登录页
      navigate('/auth/login');
    }
  };

  const toggleMobile = () => {
    setIsOpen(!isOpen);
  };

  const closeMobile = () => {
    setIsOpen(false);
  };

  const isActivePath = (path) => {
    return location.pathname === path;
  };

  const navItems = [
    {
      path: '/',
      label: t('nav.home'),
      icon: Home,
      public: true
    },
    {
      path: '/calculate',
      label: t('nav.calculate'),
      icon: Calculator,
      auth: true
    },
    {
      path: '/dashboard',
      label: t('nav.dashboard'),
      icon: BarChart3,
      auth: true
    },
    {
      path: '/store',
      label: t('nav.products'),
      icon: ShoppingBag,
      auth: true
    }
  ];

  const filteredNavItems = navItems.filter(item => {
    if (item.public) return true;
    if (item.auth) return isAuthenticated;
    return true;
  });

  const userInitial = useMemo(() => {
    if (!user?.username) return 'C';
    const trimmed = String(user.username).trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : 'C';
  }, [user?.username]);

  const renderUserAvatar = (sizeClass = 'h-8 w-8') => {
    const fallback = (
      <div className={`${sizeClass} flex items-center justify-center rounded-full bg-green-100 text-green-600 text-sm font-semibold`}>
        {userInitial}
      </div>
    );

    const avatarPath = user?.avatar_path;
    const avatarUrl = user?.avatar_url;

    if (!avatarPath && !avatarUrl) {
      return fallback;
    }

    const isAbsoluteUrl = typeof avatarUrl === 'string' && /^https?:\/\//i.test(avatarUrl);
    const resolvedFilePath = avatarPath || (!isAbsoluteUrl ? avatarUrl : undefined);

    return (
      <R2Image
        filePath={resolvedFilePath}
        src={isAbsoluteUrl ? avatarUrl : undefined}
        alt={user?.username || 'avatar'}
        className={`${sizeClass} rounded-full border border-gray-200 object-cover`}
        fallback={fallback}
      />
    );
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-green-600">
            <img src="/favicon_64x64.ico" alt="CarbonTrack logo" className="h-8 w-8" />
            <span>CarbonTrack</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors relative ${
                    isActivePath(item.path)
                      ? 'text-green-600 bg-green-50'
                      : 'text-gray-700 hover:text-green-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Desktop User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            <LanguageSwitcher />
            
            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                {/* 站内信图标按钮，仅图标，无文字，点击跳转/messages */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative"
                  aria-label={t('nav.messages')}
                  onClick={() => navigate('/messages')}
                >
                  <Bell className="h-4 w-4" />
                  {!unreadLoading && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Button>
                {/* 用户菜单 */}
                <div className="relative group">
                  <Button variant="ghost" className="flex items-center gap-3">
                    {renderUserAvatar('h-8 w-8')}
                    <span className="hidden lg:inline">{user?.username}</span>
                  </Button>
                  
                  {/* 下拉菜单 */}
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    <div className="py-1">
                      <Link
                        to="/profile"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Settings className="h-4 w-4" />
                        {t('nav.profile')}
                      </Link>
                      
                      {user?.is_admin && (
                        <Link
                          to="/admin"
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Settings className="h-4 w-4" />
                          {t('nav.admin')}
                        </Link>
                      )}
                      
                      <hr className="my-1" />
                      
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <LogOut className="h-4 w-4" />
                        {t('nav.logout')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link to="/auth/login">
                  <Button variant="ghost">{t('nav.login')}</Button>
                </Link>
                <Link to="/auth/register">
                  <Button>{t('nav.register')}</Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button variant="ghost" onClick={toggleMobile}>
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={closeMobile}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-base font-medium transition-colors relative ${
                    isActivePath(item.path)
                      ? 'text-green-600 bg-green-50'
                      : 'text-gray-700 hover:text-green-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          
          {/* Mobile User Section */}
          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="px-3 space-y-3">
              <LanguageSwitcher />
              
              {isAuthenticated ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 px-3 py-2">
                    {renderUserAvatar('h-10 w-10')}
                    <span className="text-base font-medium text-gray-900">
                      {user?.username}
                    </span>
                  </div>
                  
                  <Link
                    to="/messages"
                    onClick={closeMobile}
                    className="flex items-center gap-3 px-3 py-2 text-base font-medium text-gray-700 hover:text-green-600 hover:bg-gray-50 rounded-md relative"
                  >
                    <Bell className="h-5 w-5" />
                    {t('nav.messages')}
                    {!unreadLoading && unreadCount > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                  
                  <Link
                    to="/profile"
                    onClick={closeMobile}
                    className="flex items-center gap-3 px-3 py-2 text-base font-medium text-gray-700 hover:text-green-600 hover:bg-gray-50 rounded-md"
                  >
                    <Settings className="h-5 w-5" />
                    {t('nav.profile')}
                  </Link>
                  
                  {user?.is_admin && (
                    <Link
                      to="/admin"
                      onClick={closeMobile}
                      className="flex items-center gap-3 px-3 py-2 text-base font-medium text-gray-700 hover:text-green-600 hover:bg-gray-50 rounded-md"
                    >
                      <Settings className="h-5 w-5" />
                      {t('nav.admin')}
                    </Link>
                  )}
                  
                  <button
                    onClick={() => {
                      handleLogout();
                      closeMobile();
                    }}
                    className="flex items-center gap-3 w-full px-3 py-2 text-base font-medium text-gray-700 hover:text-green-600 hover:bg-gray-50 rounded-md"
                  >
                    <LogOut className="h-5 w-5" />
                    {t('nav.logout')}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link to="/auth/login" onClick={closeMobile}>
                    <Button variant="ghost" className="w-full justify-start">
                      {t('nav.login')}
                    </Button>
                  </Link>
                  <Link to="/auth/register" onClick={closeMobile}>
                    <Button className="w-full">
                      {t('nav.register')}
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
