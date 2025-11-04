'use client';

import { Page } from '@/types';
import { Plus, FileText, Trash2, Search, Menu, X } from 'lucide-react';
import { useState } from 'react';

interface SidebarProps {
  pages: Page[];
  currentPageId: string | null;
  onSelectPage: (pageId: string) => void;
  onCreatePage: () => void;
  onDeletePage: (pageId: string) => void;
}

export default function Sidebar({
  pages,
  currentPageId,
  onSelectPage,
  onCreatePage,
  onDeletePage,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(true);

  const filteredPages = pages.filter(page =>
    page.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 p-2 hover:bg-gray-100 rounded-lg transition-colors z-50"
      >
        <Menu size={20} />
      </button>
    );
  }

  return (
    <div className="w-64 h-screen bg-gray-50 border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold">Notion</h1>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-gray-200 rounded"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-md text-sm outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Pages List */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-0.5">
          {filteredPages.map((page) => (
            <div
              key={page.id}
              className={`group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                currentPageId === page.id
                  ? 'bg-gray-200'
                  : 'hover:bg-gray-100'
              }`}
              onClick={() => onSelectPage(page.id)}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText size={16} className="text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {page.icon && <span className="mr-1">{page.icon}</span>}
                    {page.title}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(page.updatedAt)}
                  </div>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePage(page.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-300 rounded transition-opacity"
              >
                <Trash2 size={14} className="text-gray-500 hover:text-red-600" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* New Page Button */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={onCreatePage}
          className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          New Page
        </button>
      </div>
    </div>
  );
}
