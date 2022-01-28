import fs from 'fs';
import markdown from 'markdown-it';
import type { RenderRule } from 'markdown-it/lib/renderer';
import { getHighlighter } from 'shiki';

const imageRenderer: RenderRule = (tokens, index) => {
  const token = tokens[index];

  let src = token.attrGet('src');
  if (process.env.NODE_ENV !== 'development') {
    src = `https://cdn.jsdelivr.net/gh/zoubingwu/db.js/public/${src}`;
  }

  return `<img src="${src}" alt="${token.attrGet('alt')}"/>`;
};

export default async function (path: string): Promise<string> {
  const lightHighlighter = await getHighlighter({
    theme: 'github-light',
  });
  const darkHightlighter = await getHighlighter({
    theme: 'github-dark',
  });

  const md = markdown({
    html: true,
    highlight: (code, lang) => {
      return [lightHighlighter, darkHightlighter]
        .map(hl =>
          hl
            .codeToHtml(code, { lang })
            .replace(`class="shiki"`, `class="shiki ${hl.getTheme().name}"`)
        )
        .join('');
    },
  });

  md.renderer.rules.image = imageRenderer;

  return md.render(fs.readFileSync(path, 'utf-8'));
}
