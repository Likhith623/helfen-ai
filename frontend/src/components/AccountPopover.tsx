'use client'

import React, { useEffect, useRef } from 'react'
import { LogOut, User, Sparkles, Check } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import toast from 'react-hot-toast'

interface AccountPopoverProps {
  isOpen: boolean
  onClose: () => void
  anchorRef?: React.RefObject<HTMLElement | null>
}

export function AccountPopover({ isOpen, onClose }: AccountPopoverProps) {
  const { currentUser, userProfile, signOut } = useAppStore()
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleMouseDown)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen || !currentUser) return null

  const displayName = userProfile?.full_name || currentUser.email?.split('@')[0] || 'User'
  const displayEmail = currentUser.email || userProfile?.email || 'No email'
  const initial = displayName.charAt(0).toUpperCase()

  const handleSignOut = async () => {
    onClose()
    await signOut()
    toast('Signed out', {
      icon: '👋',
      style: {
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border)'
      }
    })
  }

  return (
    <div ref={popoverRef} className="account-popover fade-in">
      {/* User Header */}
      <div className="account-popover-header">
        <div className="account-popover-avatar">{initial}</div>
        <div className="account-popover-user-info">
          <div className="account-popover-name">{displayName}</div>
          <div className="account-popover-email">{displayEmail}</div>
        </div>
      </div>

      <div className="account-popover-divider" />

      {/* Account Plan / Status */}
      <div className="account-popover-status">
        <div className="account-status-badge">
          <Sparkles size={12} color="var(--blue)" />
          <span>Helfen AI Pro</span>
        </div>
        <div className="account-status-tag">
          <Check size={11} /> Active
        </div>
      </div>

      <div className="account-popover-divider" />

      {/* Actions */}
      <div className="account-popover-actions">
        <button className="account-action-item" onClick={onClose}>
          <User size={15} />
          <span>Profile Settings</span>
        </button>

        <button className="account-action-item danger" onClick={handleSignOut}>
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )
}
