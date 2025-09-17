import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'react-hot-toast';
import { profileAPI } from '../../lib/api';

const profileSchema = (t) => z.object({
  username: z.string().min(1, t('validation.required')).max(50, t('validation.maxLength', { max: 50 })),
  email: z.string().email(t('validation.email')),
  real_name: z.string().max(100, t('validation.maxLength', { max: 100 })).optional(),
  school: z.string().max(100, t('validation.maxLength', { max: 100 })).optional(),
  class_name: z.string().max(50, t('validation.maxLength', { max: 50 })).optional(),
});

export function ProfileForm({ user, onUpdateSuccess }) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: zodResolver(profileSchema(t)),
    defaultValues: {
      username: user?.username || '',
      email: user?.email || '',
      real_name: user?.real_name || '',
      school: user?.school || '',
      class_name: user?.class_name || '',
    },
  });

  useEffect(() => {
    reset({
      username: user?.username || '',
      email: user?.email || '',
      real_name: user?.real_name || '',
      school: user?.school || '',
      class_name: user?.class_name || '',
    });
  }, [user, reset]);

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await profileAPI.updateProfile(data);
      toast.success(t('success.update'));
      onUpdateSuccess();
    } catch (err) {
      toast.error(t('errors.updateFailed'));
      console.error('Profile update failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-gray-700">
          {t('profile.username')}
        </label>
        <Input
          id="username"
          {...register('username')}
          className="mt-1 block w-full"
          disabled={isSubmitting}
        />
        {errors.username && <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          {t('profile.email')}
        </label>
        <Input
          id="email"
          type="email"
          {...register('email')}
          className="mt-1 block w-full"
          disabled={true} // Email usually not editable directly
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
      </div>

      <div>
        <label htmlFor="real_name" className="block text-sm font-medium text-gray-700">
          {t('profile.realName')}
        </label>
        <Input
          id="real_name"
          {...register('real_name')}
          className="mt-1 block w-full"
          disabled={isSubmitting}
        />
        {errors.real_name && <p className="mt-1 text-sm text-red-600">{errors.real_name.message}</p>}
      </div>

      <div>
        <label htmlFor="school" className="block text-sm font-medium text-gray-700">
          {t('profile.school')}
        </label>
        <Input
          id="school"
          {...register('school')}
          className="mt-1 block w-full"
          disabled={isSubmitting}
        />
        {errors.school && <p className="mt-1 text-sm text-red-600">{errors.school.message}</p>}
      </div>

      <div>
        <label htmlFor="class_name" className="block text-sm font-medium text-gray-700">
          {t('profile.className')}
        </label>
        <Input
          id="class_name"
          {...register('class_name')}
          className="mt-1 block w-full"
          disabled={isSubmitting}
        />
        {errors.class_name && <p className="mt-1 text-sm text-red-600">{errors.class_name.message}</p>}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('common.saving') : t('common.save')}
      </Button>
    </form>
  );
}

