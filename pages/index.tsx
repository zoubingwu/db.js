import React from 'react';
import path from 'path';
import { GetStaticProps } from 'next';

import Page from '../components/Page';
import markdown from '../utils/markdown';
import readDocs from '../utils/sider';
import Layout from '../components/Layout';

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {
      content: await markdown(path.resolve(process.cwd(), 'docs', '1.md')),
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
