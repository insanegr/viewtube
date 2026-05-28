import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, ArrowUpDown } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface SortOption<T> {
  value: T;
  label: string;
}

interface SortMenuProps<T extends string> {
  value: T;
  onChange: (val: T) => void;
  options: SortOption<T>[];
  align?: 'left' | 'right';
  title?: string;
}

export default function SortMenu<T extends string>({
  value,
  onChange,
  options,
  align = 'right',
  title
}: SortMenuProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { language } = useLanguage();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const defaultTitle = language === 'el' ? 'Ταξινόμηση κατά' : 'Sort By';
  const displayTitle = title || defaultTitle;

  return (
    <div ref={menuRef} className="relative inline-block text-left select-none z-30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-700/50 rounded-lg text-[11px] font-semibold text-gray-600 dark:text-zinc-400 hover:text-gray-950 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800/80 hover:border-gray-300 dark:hover:border-zinc-700 transition active:scale-[0.97] focus:outline-none shadow-sm cursor-pointer"
      >
        <ArrowUpDown size={11} className="text-gray-400 dark:text-zinc-500" />
        <span>{displayTitle}</span>
        <ChevronDown size={11} className={`text-gray-400 dark:text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute mt-1.5 w-max min-w-[120px] max-w-sm rounded-xl border border-gray-200/80 dark:border-zinc-700/60 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-xl ring-1 ring-black/5 p-1 animate-in fade-in slide-in-from-top-2 duration-200 ${
            align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'
          }`}
          style={{ contentVisibility: 'auto' }}
        >
          {/* Internal Header Label */}
          <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 border-b border-gray-100 dark:border-zinc-800 mb-1 whitespace-nowrap">
            {displayTitle}
          </div>
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex items-center justify-between w-full gap-8 px-2.5 py-1.5 text-xs font-medium rounded-lg text-left transition duration-150 cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-gray-700 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/80 hover:text-gray-950 dark:hover:text-zinc-200'
                }`}
              >
                <span>{option.label}</span>
                {isSelected && <Check size={12} className="text-blue-600 dark:text-blue-400 stroke-[2.5px] ml-auto" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
