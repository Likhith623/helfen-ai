import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Helfen AI — Smart Contextual Chat',
  description: 'AI chat with inline contextual learning. Select any text to ask questions right there.',
  keywords: ['AI', 'chat', 'learning', 'contextual', 'helfen'],
  authors: [{ name: 'Helfen AI' }],
  openGraph: {
    title: 'Helfen AI',
    description: 'AI chat with inline contextual learning',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-inter antialiased`}>
        <ThemeProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              className: 'toast-custom',
              duration: 3000,
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
