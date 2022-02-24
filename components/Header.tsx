import React from 'react';

export default function Header(props: { className?: string }) {
  return (
    <div className={props.className}>
      <h1>Build a Simple Database</h1>
      <p>
        Writing a simple database from scratch with{' '}
        <span className="font-bold">Node.js</span>!
      </p>
    </div>
  );
}
