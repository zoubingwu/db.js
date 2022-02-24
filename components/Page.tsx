import React from 'react';

const Page: React.FC<{ content: string }> = ({ content }) => {
  return (
    <main
      className="site-main-content"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};

export default Page;
