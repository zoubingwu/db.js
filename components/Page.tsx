import React from 'react';

const Page: React.FC<{ content: string }> = ({ content }) => {
  return (
    <main
      className="flex-1 pt-40px px-40px py-15px"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};

export default Page;
