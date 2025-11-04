export type BlockType = 'heading1' | 'heading2' | 'heading3' | 'paragraph' | 'bulletList' | 'numberedList' | 'todo' | 'quote';

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean; // For todo blocks
  order: number;
}

export interface Page {
  id: string;
  title: string;
  icon?: string;
  blocks: Block[];
  createdAt: number;
  updatedAt: number;
}
