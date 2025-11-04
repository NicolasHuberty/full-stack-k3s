'use client';

import { Page } from '@/types';
import { useState, useEffect, useRef } from 'react';
import { FileText, Search } from 'lucide-react';

interface PageLinkMenuProps {
  pages: Page[];
  onSelectPage: (page: Page) => void;
  onClose: () => void;
  position: { top: number; left: number };
  searchQuery?: string;
}

export default function PageLinkMenu({ pages, onSelectPage, onClose, position, searchQuery = '' }: PageLinkMenuProps) {
  const [search, setSearch] = useState(searchQuery);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredPages = pages.filter(page =>
    page.title.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredPages.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredPages[selectedIndex]) {
          onSelectPage(filteredPages[selectedIndex]);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, filteredPages, selectedIndex, onSelectPage]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg w-64 max-h-64 overflow-y-auto"
      style={{ top: position.top, left: position.left }}
    >
      <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search pages..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full pl-7 pr-2 py-1 text-sm border border-gray-300 rounded outline-none focus:border-blue-500"
            autoFocus
          />
        </div>
      </div>

      <div className="p-1">
        {filteredPages.length === 0 ? (
          <div className="px-3 py-2 text-sm text-gray-500">No pages found</div>
        ) : (
          filteredPages.map((page, index) => (
            <div
              key={page.id}
              onClick={() => onSelectPage(page)}
              className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors ${
                index === selectedIndex ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'
              }`}
            >
              {page.icon ? (
                <span className="text-base">{page.icon}</span>
              ) : (
                <FileText size={16} className="text-gray-400" />
              )}
              <span className="text-sm flex-1 truncate">{page.title}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
