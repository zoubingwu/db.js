import fs from 'fs';
import path from 'path';
import readline from 'readline';

async function getFirstLine(pathToFile: string) {
  const readable = fs.createReadStream(pathToFile);
  const reader = readline.createInterface({ input: readable });
  const line = await new Promise<string>(resolve => {
    reader.on('line', line => {
      reader.close();
      resolve(line);
    });
  });
  readable.close();
  return line;
}

const readDocs = async () => {
  const docs = fs
    .readdirSync(path.resolve(process.cwd(), 'docs'))
    .filter(p => p.endsWith('.md'))
    .sort(
      (a, b) =>
        parseInt(path.basename(a, '.md')) - parseInt(path.basename(b, '.md'))
    );

  return Promise.all(
    docs.map(p =>
      getFirstLine(path.resolve(process.cwd(), 'docs', p)).then(
        (line: string) => {
          return {
            route: '/' + path.basename(p, '.md'),
            title: line.replace('#', '').trim(),
          };
        }
      )
    )
  );
};

export default readDocs;
