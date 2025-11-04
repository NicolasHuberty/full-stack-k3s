'use client';

import { Page, Block, BlockType } from '@/types';
import EditorBlock from './EditorBlock';
import { useState } from 'react';

interface EditorProps {
  page: Page;
  pages: Page[];
  onUpdatePage: (page: Page) => void;
  onPageClick: (pageId: string) => void;
}

export default function Editor({ page, pages, onUpdatePage, onPageClick }: EditorProps) {
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const updateBlock = (id: string, content: string, checked?: boolean) => {
    const updatedBlocks = page.blocks.map(block =>
      block.id === id ? { ...block, content, checked } : block
    );
    onUpdatePage({ ...page, blocks: updatedBlocks, updatedAt: Date.now() });
  };

  const deleteBlock = (id: string) => {
    if (page.blocks.length === 1) return; // Keep at least one block
    const updatedBlocks = page.blocks.filter(block => block.id !== id);
    onUpdatePage({ ...page, blocks: updatedBlocks, updatedAt: Date.now() });
  };

  const changeBlockType = (id: string, type: BlockType) => {
    const updatedBlocks = page.blocks.map(block =>
      block.id === id ? { ...block, type, content: '' } : block
    );
    onUpdatePage({ ...page, blocks: updatedBlocks, updatedAt: Date.now() });
  };

  const addNewBlock = (afterId: string) => {
    const afterIndex = page.blocks.findIndex(block => block.id === afterId);
    const newBlock: Block = {
      id: generateId(),
      type: 'paragraph',
      content: '',
      order: afterIndex + 2,
    };

    const updatedBlocks = [
      ...page.blocks.slice(0, afterIndex + 1),
      newBlock,
      ...page.blocks.slice(afterIndex + 1),
    ].map((block, index) => ({ ...block, order: index + 1 }));

    onUpdatePage({ ...page, blocks: updatedBlocks, updatedAt: Date.now() });
    setFocusedBlockId(newBlock.id);
  };

  const updateTitle = (e: React.FormEvent<HTMLDivElement>) => {
    const title = e.currentTarget.textContent || 'Untitled';
    onUpdatePage({ ...page, title, updatedAt: Date.now() });
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-16 py-12">
      {/* Page Title */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          {page.icon && <span className="text-6xl">{page.icon}</span>}
        </div>
        <div
          contentEditable
          suppressContentEditableWarning
          onInput={updateTitle}
          className="text-5xl font-bold outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
          data-placeholder="Untitled"
        >
          {page.title}
        </div>
      </div>

      {/* Blocks */}
      <div className="space-y-1">
        {page.blocks.map((block) => (
          <EditorBlock
            key={block.id}
            block={block}
            pages={pages}
            onUpdate={updateBlock}
            onDelete={deleteBlock}
            onTypeChange={changeBlockType}
            onNewBlock={addNewBlock}
            onFocus={setFocusedBlockId}
            onPageClick={onPageClick}
            autoFocus={block.id === focusedBlockId}
          />
        ))}
      </div>
    </div>
  );
}
