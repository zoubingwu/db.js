import React from 'react';
import path from 'path';
import fs from 'fs';
import { GetStaticProps } from 'next';

import Page from '../components/Page';
import markdown from '../utils/markdown';
import Layout from '../components/Layout';
import readDocs from '../utils/sider';

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
  return {
    props: {
      content: await markdown(
        path.resolve(process.cwd(), 'docs', `${context.params?.post}.md`)
      ),
      navs: await readDocs(),
    },
  };
};

export default function (props: any) {
  return (
    <Layout navs={props.navs}>
      <Page content={props.content} />
    </Layout>
  );
}
