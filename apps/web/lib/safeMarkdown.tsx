import type { Components } from "react-markdown";

/**
 * Markdown overrides for content that comes from a model or from outside tools
 * (agent replies, catch-up items). Images are never loaded: a prompt-injected
 * image URL would let a third party read whatever is packed into its query
 * string. Links are shown but open in a new tab with no opener.
 */
export const untrustedMarkdown: Components = {
  img: ({ alt }) => (alt ? <span className="text-muted-foreground">[image: {alt}]</span> : null),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow">
      {children}
    </a>
  ),
};
