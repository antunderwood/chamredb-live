import Head from 'next/head'
import Navbar from '../components/NavBar'
import Image from 'next/image'
import styles from '../styles/Home.module.css'
import logo from '../public/logo.png'
import classNames from "classnames";

const SiteLayout = ({children}) =>  {
  return (
    <div className={'dark:bg-gray-800 dark:text-white'}>
      <Head>
          <title>chAMR😍Db</title>
      </Head>
      <Navbar />
      <main className='max-w-7xl px-4 mx-auto w-full'>
          {children}
      </main>

      <footer className={styles.footer}>
        <div className="grid grid-cols-1">
          <div>
            <a
              href="https://pathogensurveillance.net"
            >
              Developed by
              <div className={classNames("relative float-right ml-2", styles.footerLogoDiv)} >
                <Image
                  src={logo}
                  alt="Logo"
                  layout="fill"
                  objectFit="contain"
                />
              </div>
            </a>
          </div>
          <div className="text-center">
            <a href="mailto:charmed@support.cgps.group" target="_blank" rel="noreferrer">Create a support ticket</a>
          </div>
        </div>

      </footer>
    </div>
  );
}

export default SiteLayout;