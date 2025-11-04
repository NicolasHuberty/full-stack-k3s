'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Editor from '@/components/Editor';
import { Page } from '@/types';
import { getPages, savePage, deletePage, createEmptyPage } from '@/lib/storage';

export default function Home() {
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadedPages = getPages();
    setPages(loadedPages);
    if (loadedPages.length > 0) {
      setCurrentPageId(loadedPages[0].id);
    }
    setIsLoading(false);
  }, []);

  const handleCreatePage = () => {
    const newPage = createEmptyPage();
    savePage(newPage);
    setPages([newPage, ...pages]);
    setCurrentPageId(newPage.id);
  };

  const handleDeletePage = (pageId: string) => {
    if (pages.length === 1) return; // Keep at least one page

    deletePage(pageId);
    const updatedPages = pages.filter(p => p.id !== pageId);
    setPages(updatedPages);

    if (currentPageId === pageId && updatedPages.length > 0) {
      setCurrentPageId(updatedPages[0].id);
    }
  };

  const handleUpdatePage = (updatedPage: Page) => {
    savePage(updatedPage);
    setPages(pages.map(p => p.id === updatedPage.id ? updatedPage : p));
  };

  const currentPage = pages.find(p => p.id === currentPageId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar
        pages={pages}
        currentPageId={currentPageId}
        onSelectPage={setCurrentPageId}
        onCreatePage={handleCreatePage}
        onDeletePage={handleDeletePage}
      />
      <div className="flex-1 overflow-y-auto">
        {currentPage ? (
          <Editor
            page={currentPage}
            pages={pages}
            onUpdatePage={handleUpdatePage}
            onPageClick={setCurrentPageId}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-gray-500 mb-4">No page selected</p>
              <button
                onClick={handleCreatePage}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create a Page
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
