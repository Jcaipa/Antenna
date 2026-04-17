import '../styles/globals.css'
import ClientShell from '../components/ClientShell'

export const metadata = {
  title: 'Antenna Intelligence',
  description: 'Market Intelligence Platform · Antpack',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>
        {children}
        <ClientShell />
      </body>
    </html>
  )
}
