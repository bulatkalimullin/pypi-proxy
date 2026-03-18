import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";

interface Props {
  content: string;
}

export function MarkdownView({ content }: Props) {
  return (
    <div className="md-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw]}
        components={{
          h1: ({ children }) => <h1 className="text-xl font-bold mt-6 mb-3 text-foreground border-b border-border pb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-semibold mt-5 mb-2 text-foreground">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold mt-4 mb-1.5 text-foreground">{children}</h3>,
          h4: ({ children }) => <h4 className="text-sm font-semibold mt-3 mb-1 text-foreground">{children}</h4>,
          p: ({ children }) => <p className="text-sm text-muted-foreground leading-relaxed my-3">{children}</p>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="list-disc list-inside my-3 space-y-1 text-sm text-muted-foreground">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside my-3 space-y-1 text-sm text-muted-foreground">{children}</ol>,
          li: ({ children }) => <li className="text-sm text-muted-foreground leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/40 pl-4 my-4 text-sm text-muted-foreground italic">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <code className={`${className ?? ""} text-xs`} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="rounded-xl border border-border bg-muted/40 overflow-x-auto p-4 my-4 text-xs">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="w-full text-sm border-collapse border border-border rounded-lg overflow-hidden">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/60 text-muted-foreground">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
          tr: ({ children }) => <tr className="hover:bg-muted/30 transition-colors">{children}</tr>,
          th: ({ children }) => <th className="px-4 py-2.5 text-left font-medium text-xs border-b border-border">{children}</th>,
          td: ({ children }) => <td className="px-4 py-2.5 text-xs text-muted-foreground">{children}</td>,
          hr: () => <hr className="my-5 border-border" />,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
