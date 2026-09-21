'use client';

import type { ReactNode } from 'react';
import { ConfirmProvider, ToastProvider } from '@/components/feedback';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
