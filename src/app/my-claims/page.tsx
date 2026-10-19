import React from 'react';
import AppLayout from '@/components/AppLayout';
import MyClaimsContent from './components/MyClaimsContent';

export default function MyClaimsPage() {
  return (
    <AppLayout activePath="/my-claims">
      <MyClaimsContent />
    </AppLayout>
  );
}
