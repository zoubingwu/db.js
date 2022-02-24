import path from 'path';
import fs from 'fs';
import { GetStaticProps } from 'next';

import markdown from '../utils/markdown';
import readDocs from '../utils/sider';
import Post from '../components/Post';

export async function getStaticPaths() {
  const paths = fs
    .readdirSync(path.resolve(process.cwd(), 'docs'))
    .filter(p => p.endsWith('.md'))
    .map(p => ({
      params: { post: path.basename(p, '.md') },
    }));

  return {
    paths,
    fallback: false,
  };
}

export const getStaticProps: GetStaticProps = async context => {
  const navs = await readDocs();
  const postId = parseInt(context.params?.post as string);
  const prev = navs[postId - 2] ?? null;
  const next = navs[postId] ?? null;
  const content = await markdown(
    path.resolve(process.cwd(), 'docs', `${context.params?.post}.md`)
  );
  return {
    props: {
      content,
      prev,
      next,
      navs,
    },
  };
};

export default Post;
