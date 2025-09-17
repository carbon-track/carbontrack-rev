import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { schoolAPI, profileAPI } from '../lib/api';
import { userManager } from '../lib/auth';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/Card';
import { Alert, AlertDescription } from '../components/ui/Alert';
import { useTranslation } from '../hooks/useTranslation';

const debounce = (fn, delay = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = userManager.getUser();
  const [schools, setSchools] = useState([]);
  const [classes, setClasses] = useState([]); // 保留变量但不再展示班级 UI
  const [schoolQuery, setSchoolQuery] = useState('');
  const [classQuery, setClassQuery] = useState(''); // class 相关已废弃
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // 如果用户已完善信息，直接跳走
    if (user?.school_id) {
      navigate('/dashboard', { replace: true });
      return;
    }
    // 初始加载一批学校
    loadSchools('');
  }, []);

  const loadSchools = async (search) => {
    try {
      const res = await schoolAPI.getSchools({ search, limit: 20, page: 1 });
      const list = res.data?.data?.schools || [];
      setSchools(list);
    } catch (e) {
      console.error('Load schools failed:', e);
    }
  };

  const debouncedLoadSchools = useMemo(() => debounce(loadSchools, 300), []);

  useEffect(() => {
    debouncedLoadSchools(schoolQuery.trim());
  }, [schoolQuery]);

  useEffect(() => {
    if (!selectedSchoolId) {
      setClasses([]);
      return;
    }
    loadClasses(selectedSchoolId, classQuery.trim());
  }, [selectedSchoolId]);

  const loadClasses = async (sid, search = '') => {
    try {
      const res = await schoolAPI.getClasses(sid, { search, limit: 20, page: 1 });
      const list = res.data?.data?.classes || [];
      setClasses(list);
    } catch (e) {
      console.error('Load classes failed:', e);
    }
  };

  const debouncedLoadClasses = useMemo(() => debounce((q) => {
    if (selectedSchoolId) {
      loadClasses(selectedSchoolId, q);
    }
  }, 300), [selectedSchoolId]);

  useEffect(() => {
    debouncedLoadClasses(classQuery.trim());
  }, [classQuery]);

  const ensureSchool = async (nameOrId) => {
    if (!nameOrId) return null;
    if (/^\d+$/.test(String(nameOrId))) return parseInt(String(nameOrId), 10);
    // 文本名称则创建或获取
    const res = await schoolAPI.createOrFetchSchool({ name: nameOrId });
    return res.data?.data?.school?.id || null;
  };

  const ensureClass = async (sid, name) => {
    if (!sid || !name) return null;
    // 如果已存在名称匹配，直接返回
    const exists = classes.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (exists) return exists.id;
    const res = await schoolAPI.createClass(sid, { name });
    return res.data?.data?.class?.id || null;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      // 1) 学校：优先用选择的ID；若用户输入自定义文本，则创建/获取
      let schoolId = selectedSchoolId;
      if (!schoolId && schoolQuery) {
        schoolId = await ensureSchool(schoolQuery);
      }

      // 2) 班级：如果有输入，创建或获取
      // class_name 已废弃，不再处理

      // 3) 更新用户资料
      const payload = {};
      if (schoolId) payload.school_id = parseInt(schoolId, 10);
  // 不再发送 class_name

      if (Object.keys(payload).length === 0) {
        setError(t('onboarding.leastOneField'));
        setIsSubmitting(false);
        return;
      }

      const res = await profileAPI.updateProfile(payload);
      if (res.data?.success) {
        // 更新本地用户缓存（优先使用后端返回的完整用户数据）
        const newUser = res.data?.data ? res.data.data : { ...(user || {}), ...payload };
        userManager.setUser(newUser);
  try { sessionStorage.removeItem('onboarding_skipped'); } catch { /* no-op */ }
        setSuccess(t('onboarding.saved'));
        setTimeout(() => navigate('/dashboard', { replace: true }), 800);
      } else {
        setError(res.data?.message || t('common.error'));
      }
    } catch (e) {
      setError(e?.message || t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('onboarding.title')}</CardTitle>
            <CardDescription>{t('onboarding.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert variant="success" className="mb-4">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label htmlFor="schoolSearch" className="block text-sm font-medium text-gray-700 mb-1">{t('auth.school')}</label>
                <Input
                  id="schoolSearch"
                  placeholder={t('onboarding.schoolPlaceholder')}
                  value={schoolQuery}
                  onChange={(e) => setSchoolQuery(e.target.value)}
                />
                <div className="mt-2 max-h-40 overflow-auto border rounded">
                  {schools.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${String(selectedSchoolId)===String(s.id)?'bg-green-50':''}`}
                      onClick={() => setSelectedSchoolId(String(s.id))}
                    >
                      {s.name}
                    </button>
                  ))}
                  {schools.length === 0 && (
                    <div className="px-3 py-2 text-gray-500">{t('onboarding.noSchoolMatches')}</div>
                  )}
                </div>
              </div>

              <div>
                {/* class_name UI 已移除 */}
              </div>

              <div className="flex gap-3">
                <Button type="submit" className="flex-1" loading={isSubmitting} disabled={isSubmitting}>
                  {t('onboarding.saveAndContinue')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => {
                    try { sessionStorage.setItem('onboarding_skipped', '1'); } catch { /* no-op */ }
                    navigate('/dashboard');
                  }}
                >
                  {t('onboarding.skipForNow')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
