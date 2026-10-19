import React from 'react';
import Sidebar from './Sidebar';
import BottomTabBar from './BottomTabBar';
import ViewAsMenu from './ViewAsMenu';

interface AppLayoutProps {
  children: React.ReactNode;
  activePath: string;
}

export default function AppLayout({ children, activePath }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <Sidebar activePath={activePath} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-0">
        <main className="flex-1 pb-20 lg:pb-0 overflow-y-auto scrollbar-thin">
          <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 py-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <BottomTabBar activePath={activePath} />

      {/* Dev-only View As Menu */}
      <ViewAsMenu />
    </div>
  );
}
