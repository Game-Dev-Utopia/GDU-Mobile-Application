import React from 'react';
import AppLayout from '@/components/AppLayout';
import ActivitiesContent from './components/ActivitiesContent';

export default function ActivitiesPage() {
  return (
    <AppLayout activePath="/activities">
      <ActivitiesContent />
    </AppLayout>
  );
}