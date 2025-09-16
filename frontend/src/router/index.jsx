import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout, AuthLayout } from '../components/layout/Layout';
import AdminLayout from '../components/layout/AdminLayout';
import { ProtectedRoute, PublicRoute, AdminRoute } from '../components/auth/ProtectedRoute';

// Lazy loaded pages
const HomePage = React.lazy(() => import('../pages/HomePage'));
const LoginPage = React.lazy(() => import('../pages/LoginPage'));
const RegisterPage = React.lazy(() => import('../pages/RegisterPage'));
const ForgotPasswordPage = React.lazy(() => import('../pages/ForgotPasswordPage'));
const DashboardPage = React.lazy(() => import('../pages/DashboardPage'));
const CalculatePage = React.lazy(() => import('../pages/CalculatePage'));
const ActivitiesPage = React.lazy(() => import('../pages/ActivitiesPage'));
const StorePage = React.lazy(() => import('../pages/StorePage'));
const MessagesPage = React.lazy(() => import('../pages/MessagesPage'));
const ProfilePage = React.lazy(() => import('../pages/ProfilePage'));
const OnboardingPage = React.lazy(() => import('../pages/OnboardingPage'));
// Admin pages
const AdminDashboardPage = React.lazy(() => import('../pages/admin/Dashboard'));
const AdminUsersPage = React.lazy(() => import('../pages/admin/Users'));
const AdminActivitiesPage = React.lazy(() => import('../pages/admin/Activities'));
const AdminProductsPage = React.lazy(() => import('../pages/admin/Products'));
const AdminExchangesPage = React.lazy(() => import('../pages/admin/Exchanges'));
const AdminBroadcastPage = React.lazy(() => import('../pages/admin/Broadcast'));
const AdminSystemLogsPage = React.lazy(() => import('../pages/admin/SystemLogs'));
const NotFoundPage = React.lazy(() => import('../pages/NotFoundPage'));

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500" />
  </div>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <React.Suspense fallback={<LoadingSpinner />}><HomePage /></React.Suspense> },
      { path: 'dashboard', element: <ProtectedRoute requireAuth><React.Suspense fallback={<LoadingSpinner />}><DashboardPage /></React.Suspense></ProtectedRoute> },
      { path: 'calculate', element: <ProtectedRoute requireAuth><React.Suspense fallback={<LoadingSpinner />}><CalculatePage /></React.Suspense></ProtectedRoute> },
      { path: 'activities', element: <ProtectedRoute requireAuth><React.Suspense fallback={<LoadingSpinner />}><ActivitiesPage /></React.Suspense></ProtectedRoute> },
      { path: 'store', element: <ProtectedRoute requireAuth><React.Suspense fallback={<LoadingSpinner />}><StorePage /></React.Suspense></ProtectedRoute> },
      { path: 'messages', element: <ProtectedRoute requireAuth><React.Suspense fallback={<LoadingSpinner />}><MessagesPage /></React.Suspense></ProtectedRoute> },
      { path: 'profile', element: <ProtectedRoute requireAuth><React.Suspense fallback={<LoadingSpinner />}><ProfilePage /></React.Suspense></ProtectedRoute> },
      { path: 'onboarding', element: <ProtectedRoute requireAuth><React.Suspense fallback={<LoadingSpinner />}><OnboardingPage /></React.Suspense></ProtectedRoute> }
    ]
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      { path: 'login', element: <PublicRoute><React.Suspense fallback={<LoadingSpinner />}><LoginPage /></React.Suspense></PublicRoute> },
      { path: 'register', element: <PublicRoute><React.Suspense fallback={<LoadingSpinner />}><RegisterPage /></React.Suspense></PublicRoute> },
      { path: 'forgot-password', element: <PublicRoute><React.Suspense fallback={<LoadingSpinner />}><ForgotPasswordPage /></React.Suspense></PublicRoute> }
    ]
  },
  { path: '/login', element: <Navigate to="/auth/login" replace /> },
  { path: '/register', element: <Navigate to="/auth/register" replace /> },
  { path: '/forgot-password', element: <Navigate to="/auth/forgot-password" replace /> },
  {
    path: '/admin',
    element: <AdminRoute><AdminLayout /></AdminRoute>,
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: 'dashboard', element: <React.Suspense fallback={<LoadingSpinner />}><AdminDashboardPage /></React.Suspense> },
      { path: 'users', element: <React.Suspense fallback={<LoadingSpinner />}><AdminUsersPage /></React.Suspense> },
      { path: 'activities', element: <React.Suspense fallback={<LoadingSpinner />}><AdminActivitiesPage /></React.Suspense> },
      { path: 'products', element: <React.Suspense fallback={<LoadingSpinner />}><AdminProductsPage /></React.Suspense> },
      { path: 'exchanges', element: <React.Suspense fallback={<LoadingSpinner />}><AdminExchangesPage /></React.Suspense> },
      { path: 'broadcast', element: <React.Suspense fallback={<LoadingSpinner />}><AdminBroadcastPage /></React.Suspense> },
      { path: 'system-logs', element: <React.Suspense fallback={<LoadingSpinner />}><AdminSystemLogsPage /></React.Suspense> }
    ]
  },
  {
    path: '*',
    element: <Layout />,
    children: [
      { index: true, element: <React.Suspense fallback={<LoadingSpinner />}><NotFoundPage /></React.Suspense> }
    ]
  }
]);

export default router;
