import React from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useTranslation } from '../hooks/useTranslation';
import { userAPI } from '../lib/api';
import { ProfileForm } from '../components/profile/ProfileForm';
import { AvatarSelector } from '../components/profile/AvatarSelector';
import { PasswordChangeForm } from '../components/profile/PasswordChangeForm';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/Alert';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: userData, isLoading, error } = useQuery(
    'currentUser',
    () => userAPI.getCurrentUser(),
    { staleTime: Infinity } // User data is relatively static, can be cached longer
  );

  const responsePayload = userData?.data ?? null;
  const user = responsePayload?.data ?? responsePayload ?? null;

  const handleProfileUpdateSuccess = () => {
    queryClient.invalidateQueries('currentUser'); // Invalidate to refetch updated user data
  };

  const handleAvatarChange = () => {
    // Optionally update local state or re-fetch user data if needed
    queryClient.invalidateQueries('currentUser');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{t('profile.loadError')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('common.notice', '提示')}</AlertTitle>
          <AlertDescription>{t('profile.noUserData', '暂未获取到个人资料，请稍后重试。')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold tracking-tight mb-8">{t('profile.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('profile.basicInfo')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm user={user} onUpdateSuccess={handleProfileUpdateSuccess} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('profile.avatar')}</CardTitle>
          </CardHeader>
          <CardContent>
            <AvatarSelector currentAvatarId={user?.avatar_id} onAvatarChange={handleAvatarChange} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('profile.changePassword')}</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordChangeForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

