import React from 'react';
import { Category } from '../types/database';

interface CategoryBarProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (categoryNameOrId: string) => void;
  isLoading?: boolean;
}

export const CategoryBar: React.FC<CategoryBarProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  isLoading,
}) => {
  return (
    <div className="w-full bg-[#06090e]/95 backdrop-blur-md sticky top-14 z-20 border-b border-slate-900/60 py-2.5 px-3">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
        {isLoading ? (
          // Skeleton placeholders
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-8 w-20 bg-slate-800/60 rounded-lg animate-pulse shrink-0"
              />
            ))}
          </div>
        ) : (
          categories.map((cat) => {
            const isSelected =
              selectedCategory.toLowerCase() === cat.name.toLowerCase() ||
              (cat.id === 'all' && selectedCategory.toLowerCase() === 'all') ||
              selectedCategory === String(cat.id);

            return (
              <button
                key={cat.id || cat.name}
                onClick={() => onSelectCategory(cat.name)}
                className={`whitespace-nowrap shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[36px] flex items-center justify-center ${
                  isSelected
                    ? 'bg-white text-slate-950 shadow-md font-semibold'
                    : 'bg-[#101726] text-slate-300 hover:text-white hover:bg-[#162035] border border-slate-800/80'
                }`}
              >
                {cat.name}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
