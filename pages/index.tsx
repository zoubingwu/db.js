import path from 'path';
import { GetStaticProps } from 'next';

import markdown from '../utils/markdown';
import readDocs from '../utils/sider';
import Post from '../components/Post';

export const getStaticProps: GetStaticProps = async () => {
  const navs = await readDocs();
  const prev = null;
  const next = navs[1];
  const content = await markdown(path.resolve(process.cwd(), 'docs', `1.md`));
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
