import React, { useContext } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { IoMdMoon, IoMdSunny } from 'react-icons/io';
import { ThemeContext } from './Context';
import clsx from 'clsx';
import Header from './Header';

const Nav: React.FC<{ navs: { route: string; title: string }[] }> = ({
  navs,
}) => {
  const { darkMode, setDarkMode } = useContext(ThemeContext);
  const router = useRouter();

  return (
    <div className="relative w-400px flex-grow-0 flex-shrink-0 <md:hidden">
      <div className="site-nav overflow-y-auto fixed ml-[-999px] w-1400px h-100vh pb-30px pl-1000px transition">
        <Header className="flex flex-col pt-60px" />
        <div className="site-nav-divider" />

        <ul className="py-15px list-none">
          {navs.map(d => (
            <li
              key={d.title}
              className={clsx(
                'py-5px',
                ((router.asPath === '/' && d.route === '/1') ||
                  router.asPath === d.route) &&
                  'font-bold'
              )}
            >
              <Link href={d.route}>{d.title}</Link>
            </li>
          ))}
        </ul>

        <small className="flex items-center">
          <span
            className="pl-14px cursor-pointer mr-2 flex items-center relative top-[-1px]"
            onClick={() => {
              setDarkMode(!darkMode);
            }}
          >
            {darkMode ? <IoMdSunny /> : <IoMdMoon />}
          </span>

          <a
            href="https://github.com/zoubingwu/db.js"
            target="_blank"
            className="hover:underline"
          >
            View on GitHub
          </a>
        </small>
      </div>
    </div>
  );
};

export default Nav;
