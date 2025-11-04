'use client';

import { Block, BlockType, Page } from '@/types';
import { Trash2, GripVertical, Check } from 'lucide-react';
import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import PageLinkMenu from './PageLinkMenu';

interface EditorBlockProps {
  block: Block;
  pages: Page[];
  onUpdate: (id: string, content: string, checked?: boolean) => void;
  onDelete: (id: string) => void;
  onTypeChange: (id: string, type: BlockType) => void;
  onNewBlock: (afterId: string) => void;
  onFocus: (id: string) => void;
  onPageClick: (pageId: string) => void;
  autoFocus?: boolean;
}

export default function EditorBlock({
  block,
  pages,
  onUpdate,
  onDelete,
  onTypeChange,
  onNewBlock,
  onFocus,
  onPageClick,
  autoFocus
}: EditorBlockProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPageLinkMenu, setShowPageLinkMenu] = useState(false);
  const [linkMenuPosition, setLinkMenuPosition] = useState({ top: 0, left: 0 });
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const textRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) {
      setIsEditing(true);
    }
  }, [autoFocus]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
      textareaRef.current.selectionEnd = textareaRef.current.value.length;
    }
  }, [isEditing]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;

    // Check for block type commands at the start
    if (content.startsWith('/')) {
      const command = content.toLowerCase().slice(1);
      const commands: Record<string, BlockType> = {
        'h1': 'heading1',
        'h2': 'heading2',
        'h3': 'heading3',
        'p': 'paragraph',
        'bullet': 'bulletList',
        'number': 'numberedList',
        'todo': 'todo',
        'quote': 'quote',
      };

      if (commands[command]) {
        onTypeChange(block.id, commands[command]);
        e.target.value = '';
        return;
      }
    }

    // Check for [[ to show page link menu
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = content.slice(0, cursorPos);
    const lastDoubleBracket = textBeforeCursor.lastIndexOf('[[');

    if (lastDoubleBracket !== -1) {
      const textAfterBracket = textBeforeCursor.slice(lastDoubleBracket + 2);
      if (!textAfterBracket.includes(']]')) {
        setLinkSearchQuery(textAfterBracket);

        // Calculate position for menu
        const textarea = e.target;
        const lines = textBeforeCursor.split('\n');
        const currentLine = lines.length - 1;
        const lineHeight = 24; // approximate line height
        const top = textarea.offsetTop + (currentLine * lineHeight) + lineHeight + 5;
        const left = textarea.offsetLeft + 20;

        setLinkMenuPosition({ top, left });
        setShowPageLinkMenu(true);
      } else {
        setShowPageLinkMenu(false);
      }
    } else {
      setShowPageLinkMenu(false);
    }

    onUpdate(block.id, content, block.checked);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !showPageLinkMenu) {
      e.preventDefault();
      setIsEditing(false);
      onNewBlock(block.id);
    } else if (e.key === 'Backspace' && !block.content) {
      e.preventDefault();
      onDelete(block.id);
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setShowPageLinkMenu(false);
    }
  };

  const handlePageSelect = (page: Page) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const content = textarea.value;
    const textBeforeCursor = content.slice(0, cursorPos);
    const textAfterCursor = content.slice(cursorPos);

    const lastDoubleBracket = textBeforeCursor.lastIndexOf('[[');
    if (lastDoubleBracket !== -1) {
      const before = content.slice(0, lastDoubleBracket);
      const newContent = `${before}[[${page.title}]]${textAfterCursor}`;

      onUpdate(block.id, newContent, block.checked);
      setShowPageLinkMenu(false);

      // Set cursor position after the inserted link
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = lastDoubleBracket + `[[${page.title}]]`.length;
          textareaRef.current.selectionStart = newCursorPos;
          textareaRef.current.selectionEnd = newCursorPos;
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

  const toggleCheck = () => {
    onUpdate(block.id, block.content, !block.checked);
  };

  const getBlockStyles = () => {
    switch (block.type) {
      case 'heading1':
        return 'text-4xl font-bold';
      case 'heading2':
        return 'text-3xl font-bold';
      case 'heading3':
        return 'text-2xl font-bold';
      case 'quote':
        return 'border-l-4 border-gray-300 pl-4 italic text-gray-700';
      default:
        return '';
    }
  };

  const getPlaceholder = () => {
    switch (block.type) {
      case 'heading1':
        return 'Heading 1';
      case 'heading2':
        return 'Heading 2';
      case 'heading3':
        return 'Heading 3';
      case 'todo':
        return 'To-do';
      case 'quote':
        return 'Quote';
      case 'bulletList':
      case 'numberedList':
        return 'List';
      default:
        return "Type '/' for commands, '[[' to link pages, or use **bold**, *italic*, `code`";
    }
  };

  const renderViewMode = () => {
    const baseClasses = `cursor-text min-h-[24px] ${getBlockStyles()}`;

    if (block.type === 'bulletList') {
      return (
        <div className="flex gap-2 items-start" onClick={() => setIsEditing(true)}>
          <span className="text-xl leading-7 select-none">•</span>
          <div className={baseClasses}>
            {block.content ? (
              <MarkdownRenderer content={block.content} pages={pages} onPageClick={onPageClick} />
            ) : (
              <span className="text-gray-400">{getPlaceholder()}</span>
            )}
          </div>
        </div>
      );
    }

    if (block.type === 'numberedList') {
      return (
        <div className="flex gap-2 items-start" onClick={() => setIsEditing(true)}>
          <span className="text-sm leading-7 select-none">{block.order}.</span>
          <div className={baseClasses}>
            {block.content ? (
              <MarkdownRenderer content={block.content} pages={pages} onPageClick={onPageClick} />
            ) : (
              <span className="text-gray-400">{getPlaceholder()}</span>
            )}
          </div>
        </div>
      );
    }

    if (block.type === 'todo') {
      return (
        <div className="flex gap-2 items-start">
          <button
            onClick={toggleCheck}
            className="mt-1 w-5 h-5 rounded border-2 border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            {block.checked && <Check size={14} className="text-blue-600" />}
          </button>
          <div className={`${baseClasses} ${block.checked ? 'line-through text-gray-500' : ''}`} onClick={() => setIsEditing(true)}>
            {block.content ? (
              <MarkdownRenderer content={block.content} pages={pages} onPageClick={onPageClick} />
            ) : (
              <span className="text-gray-400">{getPlaceholder()}</span>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className={baseClasses} onClick={() => setIsEditing(true)}>
        {block.content ? (
          <MarkdownRenderer content={block.content} pages={pages} onPageClick={onPageClick} />
        ) : (
          <span className="text-gray-400">{getPlaceholder()}</span>
        )}
      </div>
    );
  };

  const renderEditMode = () => {
    const baseClasses = `outline-none w-full resize-none bg-transparent ${getBlockStyles()} font-sans`;

    const commonTextareaProps = {
      ref: textareaRef,
      value: block.content,
      onChange: handleInput,
      onKeyDown: handleKeyDown,
      onBlur: () => {
        if (!showPageLinkMenu) {
          setIsEditing(false);
        }
      },
      onFocus: () => onFocus(block.id),
      placeholder: getPlaceholder(),
      className: `${baseClasses} placeholder:text-gray-400`,
      rows: 1,
      style: { minHeight: '24px' }
    };

    if (block.type === 'bulletList') {
      return (
        <div className="flex gap-2 items-start">
          <span className="text-xl leading-7 select-none">•</span>
          <textarea {...commonTextareaProps} />
        </div>
      );
    }

    if (block.type === 'numberedList') {
      return (
        <div className="flex gap-2 items-start">
          <span className="text-sm leading-7 select-none">{block.order}.</span>
          <textarea {...commonTextareaProps} />
        </div>
      );
    }

    if (block.type === 'todo') {
      return (
        <div className="flex gap-2 items-start">
          <button
            onClick={toggleCheck}
            className="mt-1 w-5 h-5 rounded border-2 border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            {block.checked && <Check size={14} className="text-blue-600" />}
          </button>
          <textarea {...commonTextareaProps} className={`${commonTextareaProps.className} ${block.checked ? 'line-through text-gray-500' : ''}`} />
        </div>
      );
    }

    return <textarea {...commonTextareaProps} />;
  };

  return (
    <div
      className="group relative py-1 px-2 hover:bg-gray-50 rounded transition-colors"
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
      <div className="flex gap-1 items-start">
        <div className={`flex gap-1 items-center transition-opacity ${showMenu ? 'opacity-100' : 'opacity-0'}`}>
          <button className="p-1 hover:bg-gray-200 rounded">
            <GripVertical size={16} className="text-gray-400" />
          </button>
          <button
            onClick={() => onDelete(block.id)}
            className="p-1 hover:bg-gray-200 rounded"
          >
            <Trash2 size={16} className="text-gray-400 hover:text-red-600" />
          </button>
        </div>
        <div className="flex-1 min-w-0 relative">
          {isEditing ? renderEditMode() : renderViewMode()}

          {showPageLinkMenu && (
            <PageLinkMenu
              pages={pages}
              onSelectPage={handlePageSelect}
              onClose={() => setShowPageLinkMenu(false)}
              position={linkMenuPosition}
              searchQuery={linkSearchQuery}
            />
          )}
        </div>
      </div>
    </div>
  );
}
