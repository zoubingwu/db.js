import React from 'react';
import Layout from './Layout';
import Page from './Page';

export default function (props: any) {
  return (
    <Layout navs={props.navs}>
      <div className="p-60px flex-1 <md:p-20px">
        {props.prev && (
          <a className="hidden my-10px <md:block" href={props.prev.route}>
            {'前一篇：' + props.prev.title}
          </a>
        )}
        <Page content={props.content} />
        {props.next && (
          <a className="hidden my-10px <md:block" href={props.next.route}>
            {'下一篇：' + props.next.title}
          </a>
        )}
      </div>
    </Layout>
  );
}
