import Head from 'next/head'
import Image from 'next/image'
import Navbar from '../components/NavBar'
import styles from '../styles/Home.module.css'

export default function About() {
  return (
    <div className={'dark:bg-gray-800 dark:text-white'}>
      <Head>
        <title>chAMR😍Db</title>
      </Head>
      <Navbar />
      <main className='max-w-7xl px-4 mx-auto w-full'>
        <div className='w-full text-center'>
          <h1>chAMR😍Db</h1>
        </div>
        About
      </main>

      <footer className={styles.footer}>
        <a
          href="https://pathogensurveillance.net"
        >
          Developed by CGPS
        </a>
      </footer>
    </div>
  )
}
