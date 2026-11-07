'use client'

import { useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { useAppStore } from '@/store/appStore'

export function AppToaster() {
  const theme = useAppStore((s) => s.theme)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isLight = theme === 'light'
  // When mounted, use real store state; on SSR, default to open
  const isSidebarVisible = mounted ? sidebarOpen : true

  return (
    <Toaster
      position="top-center"
      containerClassName={isSidebarVisible ? 'toaster-sidebar-open' : 'toaster-sidebar-closed'}
      containerStyle={{
        top: 24,
        left: isSidebarVisible ? 268 : 0,
        right: 0,
        transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: 'none',
        zIndex: 99999,
      }}
      toastOptions={{
        className: 'toast-custom',
        duration: 2800,
        style: isLight
          ? {
              background: '#ffffff',
              color: '#1e293b',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              boxShadow: '0 10px 25px -4px rgba(0, 0, 0, 0.1), 0 4px 10px -2px rgba(0, 0, 0, 0.05)',
              borderRadius: '12px',
              padding: '10px 16px',
              fontSize: '13.5px',
              fontWeight: 500,
              pointerEvents: 'auto',
            }
          : {
              background: '#181b22',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.6), 0 4px 12px -2px rgba(0, 0, 0, 0.35)',
              borderRadius: '12px',
              padding: '10px 16px',
              fontSize: '13.5px',
              fontWeight: 500,
              pointerEvents: 'auto',
            },
        success: {
          iconTheme: {
            primary: isLight ? '#10b981' : '#34d399',
            secondary: isLight ? '#ffffff' : '#181b22',
          },
        },
        error: {
          iconTheme: {
            primary: isLight ? '#ef4444' : '#f87171',
            secondary: isLight ? '#ffffff' : '#181b22',
          },
        },
      }}
    />
  )
}

