import React, { useState } from 'react';
import ActivityLibrary from '../../components/admin/ActivityLibrary';
import { ActivityReview } from '../../components/admin/ActivityReview';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs';
import { useTranslation } from '../../hooks/useTranslation';

export default function AdminActivitiesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('library');

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      <TabsList>
        <TabsTrigger value="library">{t('admin.activities.tab.library', 'Activity Library')}</TabsTrigger>
        <TabsTrigger value="review">{t('admin.activities.tab.review', 'Record Review')}</TabsTrigger>
      </TabsList>
      <TabsContent value="library">
        <ActivityLibrary />
      </TabsContent>
      <TabsContent value="review">
        <ActivityReview />
      </TabsContent>
    </Tabs>
  );
}
