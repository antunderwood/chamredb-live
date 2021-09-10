import '../styles/globals.css'
import { ThemeProvider } from "next-themes";
import SiteLayout from '../components/SiteLayout'
function MyApp({ Component, pageProps }) {
  return (
    <ThemeProvider attribute="class"  defaultTheme="light">
      <SiteLayout>
        <Component {...pageProps} />
      </SiteLayout>
    </ThemeProvider>
  )
}

export default MyApp
