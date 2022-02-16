import fs from 'fs/promises';
import markdown from 'markdown-it';
import type Token from 'markdown-it/lib/token';
import type { RenderRule } from 'markdown-it/lib/renderer';
import container from 'markdown-it-container';
import { getHighlighter } from 'shiki';

const imageRenderer: RenderRule = (tokens, index) => {
  const token = tokens[index];

  let src = token.attrGet('src');
  if (process.env.NODE_ENV !== 'development') {
    if (!src?.startsWith('http')) {
      src = `https://cdn.jsdelivr.net/gh/zoubingwu/db.js/public/${src}`;
    }
  }

  return `<img src="${src}" alt="${token.attrGet('alt')}"/>`;
};

const createContainerRenderer = (type: string) => {
  return {
    validate(params: string) {
      return params.trim().split(' ')[0] === type;
    },
    render(tokens: Token[], idx: number) {
      const token = tokens[idx];
      let info = token.info.trim().slice(0, type.length).trim();

      if (tokens[idx].nesting === 1) {
        return `<div class="custom-container ${type}"><p class="custom-container-title">${info.toUpperCase()}</p>\n`;
      } else {
        return `</div>\n`;
      }
    },
  };
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

  md.use(container, 'tip', createContainerRenderer('tip'));
  md.use(container, 'warning', createContainerRenderer('warning'));
  md.use(container, 'danger', createContainerRenderer('danger'));

  md.use(container, 'spoiler', {
    validate(params: string) {
      return params.trim().match(/^spoiler\s+(.*)$/);
    },

    render: function (tokens: Token[], idx: number) {
      const m = tokens[idx].info.trim().match(/^spoiler\s+(.*)$/)!;

      if (tokens[idx].nesting === 1) {
        return (
          `<details class="custom-container spoiler"><summary>${md.utils.escapeHtml(m[1])}</summary>\n`
        );
      } else {
        return '</details>\n';
      }
    },
  });

  const content = await fs.readFile(path, 'utf-8');
  return md.render(content);
}
