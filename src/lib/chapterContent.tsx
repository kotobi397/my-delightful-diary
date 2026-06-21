import React from 'react';

// Image marker format used inside chapter content (Wattpad-like inline media):
//   ![](https://...image.jpg)
// Must appear on its own line. The reader splits the content by these markers
// and renders the image between the surrounding text blocks.
const IMG_RE = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g;

export interface ChapterBlock {
  type: 'text' | 'image';
  value: string;
}

export const parseChapterContent = (content: string): ChapterBlock[] => {
  if (!content) return [];
  const blocks: ChapterBlock[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  IMG_RE.lastIndex = 0;
  while ((match = IMG_RE.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index);
    if (before.trim().length > 0) blocks.push({ type: 'text', value: before });
    blocks.push({ type: 'image', value: match[1] });
    lastIndex = match.index + match[0].length;
  }
  const tail = content.slice(lastIndex);
  if (tail.trim().length > 0) blocks.push({ type: 'text', value: tail });
  return blocks;
};

export const ChapterContent: React.FC<{ content: string }> = ({ content }) => {
  const blocks = parseChapterContent(content);
  if (blocks.length === 0) return null;
  return (
    <div className="space-y-4">
      {blocks.map((b, i) =>
        b.type === 'image' ? (
          <figure key={i} className="my-4">
            <img
              src={b.value}
              alt=""
              loading="lazy"
              className="rounded-lg w-full max-h-[600px] object-contain bg-muted mx-auto"
            />
          </figure>
        ) : (
          <p
            key={i}
            className="whitespace-pre-wrap leading-loose text-base font-[Tajawal,sans-serif]"
          >
            {b.value.replace(/^\n+|\n+$/g, '')}
          </p>
        ),
      )}
    </div>
  );
};
