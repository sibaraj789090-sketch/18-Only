import React from 'react';
import { Home, Compass, Search, FolderArchive } from 'lucide-react';

export type TabType = 'home' | 'explore' | 'search' | 'library';

interface BottomNavProps {
  currentTab: TabType;
  onChangeTab: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onChangeTab }) => {
  const tabs = [
    { id: 'home' as TabType, label: 'Home', icon: Home },
    { id: 'explore' as TabType, label: 'Explore', icon: Compass },
    { id: 'search' as TabType, label: 'Search', icon: Search },
    { id: 'library' as TabType, label: 'Library', icon: FolderArchive },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#06090e]/95 backdrop-blur-md border-t border-slate-900/90 pb-[env(safe-area-inset-bottom)] transition-all">
      <div className="grid grid-cols-4 items-center h-14 max-w-lg mx-auto px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className="flex flex-col items-center justify-center h-full min-h-[44px] transition-colors relative group"
              aria-label={tab.label}
            >
              <div
                className={`p-1 transition-transform group-active:scale-90 ${
                  isActive ? 'text-red-500' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </div>
              <span
                className={`text-[10px] tracking-tight font-medium transition-colors ${
                  isActive ? 'text-white font-semibold' : 'text-slate-400'
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-1 h-1 bg-red-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
