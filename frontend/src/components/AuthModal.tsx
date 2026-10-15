'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Mail, Lock, User, Eye, EyeOff, Sparkles,
  ArrowRight, CheckCircle2, AlertCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/store/appStore'
import toast from 'react-hot-toast'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AuthModal() {
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    authModalTab,
    setCurrentUser,
    setUserProfile,
    setConversations
  } = useAppStore()

  const [tab, setTab] = useState<'signin' | 'signup'>(authModalTab || 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const emailInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setTab(authModalTab)
    setErrorMsg(null)
    setSuccessInfo(null)
    if (isAuthModalOpen) {
      setTimeout(() => emailInputRef.current?.focus(), 60)
    }
  }, [authModalTab, isAuthModalOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen) {
        setIsAuthModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isAuthModalOpen, setIsAuthModalOpen])

  if (!mounted || !isAuthModalOpen) return null

  // Validate inputs
  const isEmailValid = EMAIL_REGEX.test(email.trim())
  const isPasswordValid = password.length >= 6
  const doPasswordsMatch = tab === 'signin' || password === confirmPassword

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessInfo(null)

    if (!email.trim()) {
      setErrorMsg('Please enter your email address.')
      return
    }

    if (!isEmailValid) {
      setErrorMsg('Please enter a valid email address (e.g. name@example.com).')
      return
    }

    if (!password) {
      setErrorMsg('Please enter your password.')
      return
    }

    if (!isPasswordValid) {
      setErrorMsg('Password must be at least 6 characters long.')
      return
    }

    if (tab === 'signup' && password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter confirmation password.')
      return
    }

    setLoading(true)

    try {
      if (tab === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        })

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setErrorMsg('Invalid email or password. Please verify and try again.')
          } else if (error.message.includes('Email not confirmed')) {
            setErrorMsg('Email not confirmed yet. Please check your inbox or disable email confirmation in Supabase.')
          } else {
            setErrorMsg(error.message)
          }
          return
        }

        if (data.user) {
          setCurrentUser({ id: data.user.id, email: data.user.email })
          
          // Fetch profile details
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single()
            
          if (profile) {
            setUserProfile(profile as any)
          } else {
            setUserProfile({
              id: data.user.id,
              email: data.user.email || '',
              full_name: data.user.user_metadata?.full_name || null
            })
          }

          // Fetch user's conversations
          const { data: convData } = await supabase
            .from('conversations')
            .select('*')
            .eq('user_id', data.user.id)
            .eq('is_temporary', false)
            .order('updated_at', { ascending: false })
            .limit(100)

          if (convData) {
            setConversations(convData as any)
          }

          toast.success(`Welcome back${profile?.full_name ? `, ${profile.full_name}` : ''}!`, {
            icon: '👋',
            style: {
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)'
            }
          })
          setIsAuthModalOpen(false)
        }
      } else {
        // Sign Up
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim() || undefined
            }
          }
        })

        if (error) {
          if (error.message.includes('already registered')) {
            setErrorMsg('An account with this email already exists. Try signing in.')
          } else {
            setErrorMsg(error.message)
          }
          return
        }

        if (data.user) {
          // If auto-confirmed / session returned
          if (data.session) {
            setCurrentUser({ id: data.user.id, email: data.user.email })
            setUserProfile({
              id: data.user.id,
              email: data.user.email || '',
              full_name: fullName.trim() || null
            })

            toast.success('Account created successfully!', {
              icon: '🎉',
              style: {
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)'
              }
            })
            setIsAuthModalOpen(false)
          } else {
            // Confirmation email sent
            setSuccessInfo(
              'Account created! If email confirmation is enabled in your Supabase project, please check your inbox to confirm your email before signing in.'
            )
          }
        }
      }
    } catch (err: any) {
      console.error('Authentication error:', err)
      setErrorMsg(err.message || 'An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div
      className="auth-modal-backdrop"
      onClick={() => setIsAuthModalOpen(false)}
    >
      <div
        className="auth-modal-container glass-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        {/* Glow ambient background */}
        <div className="auth-modal-glow" />

        {/* Modal Header */}
        <div className="auth-modal-header">
          <div className="auth-modal-brand">
            <div className="auth-modal-brand-icon">
              <Sparkles size={16} color="white" />
            </div>
            <div className="auth-modal-brand-text">
              <h2 id="auth-modal-title" className="auth-modal-title">
                {tab === 'signin' ? 'Sign in to Helfen AI' : 'Create your account'}
              </h2>
              <p className="auth-modal-subtitle">
                {tab === 'signin'
                  ? 'Access your conversations, continuation context, and preferences.'
                  : 'Get started with intelligent contextual AI assistance.'}
              </p>
            </div>
          </div>
          <button
            className="auth-modal-close-btn"
            onClick={() => setIsAuthModalOpen(false)}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="auth-modal-tabs">
          <button
            type="button"
            className={`auth-modal-tab ${tab === 'signin' ? 'active' : ''}`}
            onClick={() => {
              setTab('signin')
              setErrorMsg(null)
              setSuccessInfo(null)
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-modal-tab ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setTab('signup')
              setErrorMsg(null)
              setSuccessInfo(null)
            }}
          >
            Create Account
          </button>
        </div>

        {/* Error / Success messages */}
        {errorMsg && (
          <div className="auth-error-alert fade-in">
            <AlertCircle size={15} className="alert-icon" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successInfo && (
          <div className="auth-success-alert fade-in">
            <CheckCircle2 size={16} className="alert-icon" />
            <span>{successInfo}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {tab === 'signup' && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-fullname">
                Full Name <span className="auth-label-opt">(optional)</span>
              </label>
              <div className="auth-input-wrapper">
                <User size={16} className="auth-input-icon" />
                <input
                  id="auth-fullname"
                  type="text"
                  className="auth-input"
                  placeholder="e.g. Alex Morgan"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-email">
              Email Address
            </label>
            <div
              className={`auth-input-wrapper ${
                email && !isEmailValid ? 'invalid' : ''
              }`}
            >
              <Mail size={16} className="auth-input-icon" />
              <input
                ref={emailInputRef}
                id="auth-email"
                type="email"
                className="auth-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>
            {email && !isEmailValid && (
              <span className="auth-field-hint error">
                Please enter a valid email address
              </span>
            )}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-password">
              Password
            </label>
            <div
              className={`auth-input-wrapper ${
                password && !isPasswordValid ? 'invalid' : ''
              }`}
            >
              <Lock size={16} className="auth-input-icon" />
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder="Enter password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="auth-pwd-toggle"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {password && !isPasswordValid && (
              <span className="auth-field-hint error">
                Password must be at least 6 characters
              </span>
            )}
          </div>

          {tab === 'signup' && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-confirm-password">
                Confirm Password
              </label>
              <div
                className={`auth-input-wrapper ${
                  confirmPassword && !doPasswordsMatch ? 'invalid' : ''
                }`}
              >
                <Lock size={16} className="auth-input-icon" />
                <input
                  id="auth-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>
              {confirmPassword && !doPasswordsMatch && (
                <span className="auth-field-hint error">
                  Passwords do not match
                </span>
              )}
            </div>
          )}

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <div className="auth-spinner" />
            ) : (
              <>
                <span>{tab === 'signin' ? 'Sign In' : 'Create Account'}</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        {/* Footer switcher */}
        <div className="auth-modal-footer">
          {tab === 'signin' ? (
            <p>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                className="auth-switch-link"
                onClick={() => {
                  setTab('signup')
                  setErrorMsg(null)
                  setSuccessInfo(null)
                }}
              >
                Create one now
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                className="auth-switch-link"
                onClick={() => {
                  setTab('signin')
                  setErrorMsg(null)
                  setSuccessInfo(null)
                }}
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
