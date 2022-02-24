import React, { useContext } from 'react';
import SiderNav from './SiderNav';
import { ThemeContext } from './Context';
import clsx from 'clsx';
import Header from './Header';

const Layout: React.FC<{ navs: any }> = ({ navs, children }) => {
  const { darkMode } = useContext(ThemeContext);

  return (
    <div
      className={clsx(
        'transition',
        darkMode ? 'dark-theme' : 'light-theme',
        darkMode ? 'bg-[#30404D] text-white' : 'bg-light-100 text-dark-gray1'
      )}
    >
      <div className="flex flex-row max-w-1100px min-h-100vh m-auto <sm:flex-col">
        <Header className="hidden p-20px pb-0 <md:block" />
        <SiderNav navs={navs} />

        {children}
      </div>
    </div>
  );
};

export default Layout;
