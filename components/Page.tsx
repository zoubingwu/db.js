import React from 'react';

const Page: React.FC<{ content: string }> = ({ content }) => {
  return (
    <main
      className="site-main-content flex-1 p-60px"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};

export default Page;
