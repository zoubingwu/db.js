import fs from 'fs';
import markdown from 'markdown-it';
import { getHighlighter } from 'shiki';

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

  return md.render(fs.readFileSync(path, 'utf-8'));
}
