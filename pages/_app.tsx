import 'windi.css';
import React, { useState } from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';

import { ThemeContext } from '../components/Context';

import '../styles/index.css';

function App({ Component, pageProps }: AppProps) {
  const [darkMode, setDarkMode] = useState(false);

  const setMode = (val: boolean) => {
    setDarkMode(val);
  };

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode: setMode }}>
      <Head>
        <title>Build a simple database with Node.js</title>
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      </Head>
      <Component {...pageProps} />
    </ThemeContext.Provider>
  );
}

export default App;
