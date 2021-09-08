import Head from 'next/head'
import Image from 'next/image'
import QueryForm from '../components/QueryForm'
import styles from '../styles/Home.module.css'

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>chAMR😍Db</title>
      </Head>

      <main className={styles.main}>
        <h1>chAMR😍Db</h1>
        <QueryForm />
      </main>

      <footer className={styles.footer}>
        <a
          href="https://pathogensurveillance.net"
        >
          Developed by {' '}
          CGPS
        </a>
      </footer>
    </div>
  )
}
