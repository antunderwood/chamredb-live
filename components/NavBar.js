import React from 'react';
import { Fragment } from 'react';
import { Disclosure, Menu, Transition } from '@headlessui/react';
import Link  from 'next/link'
import { useRouter } from 'next/router'
import { MoonIcon, MenuIcon, XIcon , MenuAlt3Icon} from '@heroicons/react/outline';
import { useTheme } from "next-themes";

const navigation = [
  { name: 'Query', href: '/', newWindow: false },
  { name: 'About', href: '/about', newWindow: false  },
  { name: 'Code', href: 'https://gitlab.com/antunderwood/chamredb', newWindow: true },
];

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function Navbar() {
  const [isDark, setisDark] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const { theme, setTheme } = useTheme();
  const router = useRouter()

  // When mounted on client, now we can show the UI
  React.useEffect(() => {
    setisDark(localStorage.getItem('theme') && localStorage.getItem('theme') === 'dark');
    setMounted(true)
  }, []);

  function moonClick() {
    setisDark(!isDark);
    isDark ? setTheme('light') : setTheme('dark');
  }
  if (!mounted) return null

  return (
    <Disclosure as="nav" className="bg-cgps-dpurple dark:bg-cgps-lpurple">
      {({ open }) => (
        <>
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
            <div className="relative flex items-center justify-between h-16">
              <div className="absolute inset-y-0 left-0 flex items-center sm:hidden">
                {/* Mobile menu button*/}
                <Disclosure.Button className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white">
                  <span className="sr-only">Open main menu</span>
                  {open ? (
                    <XIcon className="block h-6 w-6" aria-hidden="true" />
                  ) : (
                    <MenuIcon className="block h-6 w-6" aria-hidden="true" />
                  )}
                </Disclosure.Button>
              </div>
              <div className="flex-1 flex items-center justify-center sm:items-stretch sm:justify-start">
                <div className="flex-shrink-0 flex items-center text-4xl text-white">
                <Link href="/">
                  chAMR😍Db
                </Link>
                </div>
                <div className="hidden sm:block sm:ml-6">
                  <div className="flex space-x-4">
                    {navigation.map((item) => (
                      <Link
                        href={item.href}
                        key={item.name}
                      >
                        <a
                          className={classNames(
                            router.pathname === item.href  ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white',
                            'px-3 py-2 rounded-md text-sm font-medium'
                          )}
                          aria-current={ router.pathname === item.href ? 'page' : undefined}
                          target={item.newWindow ? '_blank' : undefined}
                        >
                          {item.name}
                        </a>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
                <button
                  type="button"
                  className={`bg-gray-700 p-1 rounded-full ${isDark ? 'text-white ring-white ring-2 ring-offset-2 hover:text-gray-400 hover:outline-none hover:ring-gray-400 hover:ring-offset-gray-400' : 'text-gray-400 hover:text-white '}`}
                >
                  <MoonIcon
                    className="h-6 w-6"
                    aria-hidden="true"
                    onClick={() => moonClick()}
                  />
                </button>
                {/* Profile dropdown */}
                {/* <Menu as="div" className="ml-3 relative">
                  <div>
                    <Menu.Button className="text-white">
                      <span className="sr-only">Open menu</span>
                      <MenuAlt3Icon className="h-6 w-6"/>
                    </Menu.Button>
                  </div>
                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  >
                    <Menu.Items className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
                      <Menu.Item>
                        {({ active }) => (
                          <a
                            href="#"
                            className={classNames(active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700')}
                          >
                            Your Profile
                          </a>
                        )}
                      </Menu.Item>
                      <Menu.Item>
                        {({ active }) => (
                          <a
                            href="#"
                            className={classNames(active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700')}
                          >
                            Settings
                          </a>
                        )}
                      </Menu.Item>
                      <Menu.Item>
                        {({ active }) => (
                          <a
                            href="#"
                            className={classNames(active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700')}
                          >
                            Sign out
                          </a>
                        )}
                      </Menu.Item>
                    </Menu.Items>
                  </Transition>
                </Menu> */}
              </div>
            </div>
          </div>

          <Disclosure.Panel className="sm:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigation.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className={classNames(
                    item.current ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white',
                    'block px-3 py-2 rounded-md text-base font-medium'
                  )}
                  aria-current={item.current ? 'page' : undefined}
                >
                  {item.name}
                </a>
              ))}
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  )
}
