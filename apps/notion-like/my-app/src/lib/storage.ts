import { Page, Block } from '@/types';

const STORAGE_KEY = 'notion-pages';

export const getPages = (): Page[] => {
  if (typeof window === 'undefined') return [];

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    // Create a default page
    const defaultPage = createDefaultPage();
    savePages([defaultPage]);
    return [defaultPage];
  }

  return JSON.parse(stored);
};

export const savePages = (pages: Page[]): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
};

export const createDefaultPage = (): Page => {
  const now = Date.now();
  return {
    id: generateId(),
    title: 'Getting Started',
    icon: '👋',
    blocks: [
      {
        id: generateId(),
        type: 'paragraph',
        content: 'Welcome to your **Notion-like Editor** with full markdown support! Click any text to edit it.',
        order: 1,
      },
      {
        id: generateId(),
        type: 'heading2',
        content: 'Markdown Features',
        order: 2,
      },
      {
        id: generateId(),
        type: 'bulletList',
        content: '**Bold text** - use `**text**`',
        order: 3,
      },
      {
        id: generateId(),
        type: 'bulletList',
        content: '*Italic text* - use `*text*`',
        order: 4,
      },
      {
        id: generateId(),
        type: 'bulletList',
        content: '`Inline code` - use backticks',
        order: 5,
      },
      {
        id: generateId(),
        type: 'bulletList',
        content: '[External links](https://example.com) - use `[text](url)`',
        order: 6,
      },
      {
        id: generateId(),
        type: 'heading2',
        content: 'Page Linking',
        order: 7,
      },
      {
        id: generateId(),
        type: 'paragraph',
        content: 'Type `[[` to link to other pages. Try it: [[',
        order: 8,
      },
      {
        id: generateId(),
        type: 'heading2',
        content: 'Block Types',
        order: 9,
      },
      {
        id: generateId(),
        type: 'paragraph',
        content: 'Type `/` at the start of a block for commands:',
        order: 10,
      },
      {
        id: generateId(),
        type: 'bulletList',
        content: '`/h1`, `/h2`, `/h3` - Headings',
        order: 11,
      },
      {
        id: generateId(),
        type: 'bulletList',
        content: '`/bullet` - Bullet list',
        order: 12,
      },
      {
        id: generateId(),
        type: 'bulletList',
        content: '`/todo` - Checkbox list',
        order: 13,
      },
      {
        id: generateId(),
        type: 'bulletList',
        content: '`/quote` - Quote block',
        order: 14,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
};

export const createEmptyPage = (): Page => {
  const now = Date.now();
  return {
    id: generateId(),
    title: 'Untitled',
    blocks: [
      {
        id: generateId(),
        type: 'paragraph',
        content: '',
        order: 1,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
};

export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};

export const getPage = (pageId: string): Page | undefined => {
  const pages = getPages();
  return pages.find(page => page.id === pageId);
};

export const savePage = (page: Page): void => {
  const pages = getPages();
  const index = pages.findIndex(p => p.id === page.id);

  if (index !== -1) {
    pages[index] = page;
  } else {
    pages.push(page);
  }

  savePages(pages);
};

export const deletePage = (pageId: string): void => {
  const pages = getPages();
  const filtered = pages.filter(page => page.id !== pageId);
  savePages(filtered);
};
