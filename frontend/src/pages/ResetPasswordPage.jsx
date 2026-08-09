import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useTranslation } from '../hooks/useTranslation';
import { authAPI } from '../lib/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Alert, AlertDescription } from '../components/ui/Alert';

const TogglePasswordButton = ({ visible, label, onClick }) => (
  <button
    type="button"
    aria-label={label}
    aria-pressed={visible}
    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center"
    onClick={onClick}
  >
    {visible ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
  </button>
);

export default function ResetPasswordPage() {
  const { t } = useTranslation(['activities', 'auth', 'errors']);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const fromEmail = searchParams.get('email') || '';

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultValues = useMemo(() => ({
    password: '',
    confirmPassword: ''
  }), []);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm({
    defaultValues
  });

  const passwordValue = watch('password');

  const handleReset = async (values) => {
    if (!token) {
      setStatus({ variant: 'destructive', message: t('auth.resetPassword.tokenMissing') });
      return;
    }

    setIsSubmitting(true);
    setStatus(null);

    try {
      const response = await authAPI.resetPassword(token, values.password, values.confirmPassword);
      if (response.success) {
        toast.success(t('auth.resetPassword.success'));
        setStatus({ variant: 'success', message: t('auth.resetPassword.success') });
        setTimeout(() => navigate('/auth/login'), 2000);
      } else {
        const message = response.message || t('auth.resetPassword.failed');
        setStatus({ variant: 'destructive', message });
        toast.error(message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || error.message || t('auth.resetPassword.failed');
      setStatus({ variant: 'destructive', message });
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="w-full max-w-md space-y-6 sm:space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100">
            <Lock className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-foreground">
            {t('auth.resetPassword.newTitle')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('auth.resetPassword.newSubtitle', { email: fromEmail || t('auth.verification.yourEmail') })}
          </p>
        </div>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>{t('auth.resetPassword.newTitle')}</CardTitle>
            <CardDescription>
              {t('auth.resetPassword.instructions')}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
            {!token && (
              <Alert variant="warning" className="mb-4">
                <AlertDescription>{t('auth.resetPassword.tokenMissing')}</AlertDescription>
              </Alert>
            )}

            {status?.message && (
              <Alert variant={status.variant || 'info'} className="mb-4">
                <AlertDescription>{status.message}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit(handleReset)} className="space-y-6">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                  {t('auth.resetPassword.newPasswordLabel')}
                </label>
                <div className="mt-1">
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder={t('auth.passwordPlaceholder')}
                      disabled={isSubmitting}
                      error={errors.password}
                      className="pr-10"
                      {...register('password', {
                        required: t('auth.passwordRequired'),
                        minLength: { value: 8, message: t('auth.passwordMinLength') }
                      })}
                    />
                    <TogglePasswordButton
                      visible={showPassword}
                      label={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')}
                      onClick={() => setShowPassword((prev) => !prev)}
                    />
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
                  {t('auth.resetPassword.confirmPasswordLabel')}
                </label>
                <div className="mt-1">
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder={t('auth.confirmPasswordPlaceholder')}
                      disabled={isSubmitting}
                      error={errors.confirmPassword}
                      className="pr-10"
                      {...register('confirmPassword', {
                        required: t('auth.resetPassword.confirmPasswordRequired'),
                        validate: (value) => value === passwordValue || t('auth.resetPassword.passwordMismatch')
                      })}
                    />
                    <TogglePasswordButton
                      visible={showConfirmPassword}
                      label={t(showConfirmPassword ? 'auth.hidePassword' : 'auth.showPassword')}
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting || !token}>
                {isSubmitting ? t('auth.resetPassword.submitting') : t('auth.resetPassword.submit')}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link to="/auth/login" className="text-sm font-medium text-green-600 hover:text-green-500">
                {t('auth.backToLogin')}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
