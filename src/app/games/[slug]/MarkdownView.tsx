"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

/** Renders a Markdown string as sanitized HTML (GFM: tables, strikethrough…). */
export function MarkdownView({ md }: { md: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
      {md}
    </Markdown>
  );
}
