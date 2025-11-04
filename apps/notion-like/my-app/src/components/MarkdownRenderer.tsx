'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Page } from '@/types';

interface MarkdownRendererProps {
  content: string;
  pages?: Page[];
  onPageClick?: (pageId: string) => void;
}

export default function MarkdownRenderer({ content, pages = [], onPageClick }: MarkdownRendererProps) {
  // Parse internal page links [[Page Name]]
  const parsePageLinks = (text: string) => {
    const pageLinkRegex = /\[\[(.*?)\]\]/g;
    let result = text;
    let match;

    while ((match = pageLinkRegex.exec(text)) !== null) {
      const pageName = match[1];
      const page = pages.find(p => p.title.toLowerCase() === pageName.toLowerCase());

      if (page) {
        const replacement = `[${pageName}](#page-${page.id})`;
        result = result.replace(match[0], replacement);
      }
    }

    return result;
  };

  const processedContent = parsePageLinks(content);

  return (
    <div className="markdown-content prose prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, href, children, ...props }) => {
            // Handle internal page links
            if (href?.startsWith('#page-')) {
              const pageId = href.replace('#page-', '');
              return (
                <a
                  href={href}
                  onClick={(e) => {
                    e.preventDefault();
                    onPageClick?.(pageId);
                  }}
                  className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                  {...props}
                >
                  {children}
                </a>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline" {...props}>
                {children}
              </a>
            );
          },
          p: ({ node, children, ...props }) => (
            <p className="my-1" {...props}>
              {children}
            </p>
          ),
          strong: ({ node, children, ...props }) => (
            <strong className="font-bold" {...props}>
              {children}
            </strong>
          ),
          em: ({ node, children, ...props }) => (
            <em className="italic" {...props}>
              {children}
            </em>
          ),
          code: ({ node, inline, children, ...props }) => {
            if (inline) {
              return (
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-pink-600" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className="block bg-gray-100 p-3 rounded my-2 font-mono text-sm overflow-x-auto" {...props}>
                {children}
              </code>
            );
          },
          ul: ({ node, children, ...props }) => (
            <ul className="list-disc pl-6 my-1" {...props}>
              {children}
            </ul>
          ),
          ol: ({ node, children, ...props }) => (
            <ol className="list-decimal pl-6 my-1" {...props}>
              {children}
            </ol>
          ),
          li: ({ node, children, ...props }) => (
            <li className="my-0.5" {...props}>
              {children}
            </li>
          ),
          blockquote: ({ node, children, ...props }) => (
            <blockquote className="border-l-4 border-gray-300 pl-4 italic my-2" {...props}>
              {children}
            </blockquote>
          ),
          h1: ({ node, children, ...props }) => (
            <h1 className="text-2xl font-bold my-2" {...props}>
              {children}
            </h1>
          ),
          h2: ({ node, children, ...props }) => (
            <h2 className="text-xl font-bold my-2" {...props}>
              {children}
            </h2>
          ),
          h3: ({ node, children, ...props }) => (
            <h3 className="text-lg font-bold my-2" {...props}>
              {children}
            </h3>
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
