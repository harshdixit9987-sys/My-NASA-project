import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { CheckCircle2, ChevronDown, CircleAlert, LogOut, Mail, ShieldCheck, UserRound, X } from 'lucide-react'
import { firebaseAuth, isFirebaseConfigured } from '../firebase'

type AuthMode = 'signin' | 'signup'

const authErrorMessages: Record<string, string> = {
  'auth/email-already-in-use': 'This email already has an account. Sign in instead.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Choose a password with at least 6 characters.',
  'auth/user-not-found': 'No account was found for this email.',
  'auth/wrong-password': 'The password is incorrect. Try again or reset it.',
  'auth/invalid-credential': 'The email or password is incorrect.',
  'auth/popup-closed-by-user': 'Google sign-in was closed before completion.',
  'auth/popup-blocked': 'Your browser blocked the Google sign-in popup.',
  'auth/unauthorized-domain': 'This website domain is not authorized in Firebase Authentication.',
  'auth/operation-not-allowed': 'Enable this sign-in method in Firebase Authentication settings.',
  'auth/too-many-requests': 'Too many attempts. Wait a little and try again.',
  'auth/network-request-failed': 'Network error. Check your internet connection and try again.',
  'auth/user-disabled': 'This account has been disabled.',
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : ''
    return authErrorMessages[code] ?? `Authentication failed: ${error.message}`
  }
  return 'Authentication failed. Please try again.'
}

function getInitials(user: User): string {
  const name = user.displayName?.trim()
  if (name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
  }
  return user.email?.trim()[0]?.toUpperCase() ?? 'A'
}

function AuthDialog({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!firebaseAuth) {
      setError('Firebase is not configured. Follow the Firebase setup steps in README.md.')
      return
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setBusy(true)
    try {
      if (mode === 'signup') {
        const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password)
        await sendEmailVerification(credential.user)
        setMessage('Your account is ready. Check your inbox for the email verification link.')
      } else {
        const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password)
        if (!credential.user.emailVerified) {
          setMessage('You are signed in, but this email is not verified yet. Resend the verification email from your profile menu.')
        } else {
          onClose()
        }
      }
    } catch (authError) {
      setError(getErrorMessage(authError))
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogleSignIn() {
    if (!firebaseAuth) {
      setError('Firebase is not configured. Follow the Firebase setup steps in README.md.')
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await signInWithPopup(firebaseAuth, new GoogleAuthProvider())
      onClose()
    } catch (authError) {
      setError(getErrorMessage(authError))
    } finally {
      setBusy(false)
    }
  }

  async function handlePasswordReset() {
    if (!firebaseAuth) {
      setError('Firebase is not configured. Follow the Firebase setup steps in README.md.')
      return
    }
    if (!email.trim()) {
      setError('Enter your email address first, then choose Forgot password.')
      return
    }

    setBusy(true)
    setError('')
    setMessage('')
    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim())
      setMessage('If an account exists for this address, a password reset email has been sent.')
    } catch (authError) {
      setError(getErrorMessage(authError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="auth-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <section
        aria-labelledby="auth-dialog-title"
        aria-modal="true"
        className="auth-dialog"
        role="dialog"
      >
        <button
          aria-label="Close sign-in dialog"
          className="auth-close"
          disabled={busy}
          onClick={onClose}
          type="button"
        >
          <X size={18} />
        </button>
        <div className="auth-brand-mark"><ShieldCheck size={21} /></div>
        <h2 id="auth-dialog-title">{mode === 'signup' ? 'Create your SARscope account' : 'Sign in to SARscope'}</h2>
        <p className="auth-description">Save your workspace and access your account securely.</p>

        {!isFirebaseConfigured && (
          <div className="auth-setup-notice">
            <CircleAlert size={16} />
            <span>Add the Firebase web app values to <code>.env.local</code>, then restart the dev server. See README.md.</span>
          </div>
        )}

        <button
          className="google-signin-button"
          disabled={busy || !isFirebaseConfigured}
          onClick={() => void handleGoogleSignIn()}
          type="button"
        >
          <GoogleMark />
          Continue with Google
        </button>

        <div className="auth-divider"><span>or continue with email</span></div>

        <div className="auth-mode-tabs" role="tablist" aria-label="Account action">
          <button
            aria-selected={mode === 'signin'}
            className={mode === 'signin' ? 'auth-tab-active' : ''}
            onClick={() => {
              setMode('signin')
              setError('')
              setMessage('')
            }}
            role="tab"
            type="button"
          >
            Sign in
          </button>
          <button
            aria-selected={mode === 'signup'}
            className={mode === 'signup' ? 'auth-tab-active' : ''}
            onClick={() => {
              setMode('signup')
              setError('')
              setMessage('')
            }}
            role="tab"
            type="button"
          >
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={(event) => void handleEmailSubmit(event)}>
          <label htmlFor="account-email">Email address</label>
          <div className="auth-input-wrap">
            <Mail size={16} />
            <input
              autoComplete="email"
              autoFocus
              id="account-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </div>
          <label htmlFor="account-password">Password</label>
          <input
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            id="account-password"
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 6 characters"
            required
            type="password"
            value={password}
          />
          {mode === 'signup' && (
            <>
              <label htmlFor="account-confirm-password">Confirm password</label>
              <input
                autoComplete="new-password"
                id="account-confirm-password"
                minLength={6}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter your password"
                required
                type="password"
                value={confirmPassword}
              />
            </>
          )}
          {mode === 'signin' && (
            <button
              className="forgot-password-button"
              disabled={busy}
              onClick={() => void handlePasswordReset()}
              type="button"
            >
              Forgot password?
            </button>
          )}
          {error && <p className="auth-feedback auth-feedback-error" role="alert">{error}</p>}
          {message && <p className="auth-feedback auth-feedback-success" role="status">{message}</p>}
          <button
            className="auth-submit-button"
            disabled={busy || !isFirebaseConfigured}
            type="submit"
          >
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <p className="auth-privacy-note">Your password is handled by Firebase Authentication and is never stored by SARscope.</p>
      </section>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" height="18" viewBox="0 0 48 48" width="18">
      <path d="M43.6 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11a9.4 9.4 0 0 1-4.1 6.2v5.2h6.7c3.9-3.6 6-8.9 6-15.4Z" fill="#4285F4" />
      <path d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.2c-1.8 1.2-4 2-6.8 2-5.2 0-9.6-3.5-11.2-8.2H5.9v5.4A20.4 20.4 0 0 0 24 44Z" fill="#34A853" />
      <path d="M12.8 27.7a12.3 12.3 0 0 1 0-7.4v-5.4H5.9a20.3 20.3 0 0 0 0 18.2l6.9-5.4Z" fill="#FBBC05" />
      <path d="M24 12.1c3 0 5.7 1 7.8 3.1l5.9-5.9A19.7 19.7 0 0 0 24 4 20.4 20.4 0 0 0 5.9 14.9l6.9 5.4c1.6-4.7 6-8.2 11.2-8.2Z" fill="#EA4335" />
    </svg>
  )
}

export function AccountMenu() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(Boolean(firebaseAuth))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')

  useEffect(() => {
    if (!firebaseAuth) return
    return onAuthStateChanged(
      firebaseAuth,
      (currentUser) => {
        setUser(currentUser)
        setAuthLoading(false)
      },
      (error) => {
        setActionError(getErrorMessage(error))
        setAuthLoading(false)
      },
    )
  }, [])

  async function handleSignOut() {
    if (!firebaseAuth) {
      setActionError('Firebase is not configured. You are not signed in.')
      return
    }
    setActionBusy(true)
    setActionError('')
    setActionMessage('')
    try {
      await signOut(firebaseAuth)
      setProfileOpen(false)
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setActionBusy(false)
    }
  }

  async function handleResendVerification() {
    if (!firebaseAuth || !user) return
    setActionBusy(true)
    setActionError('')
    setActionMessage('')
    try {
      await sendEmailVerification(user)
      setActionMessage('Verification email sent. Check your inbox.')
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <>
      <div className="account-menu">
        <button
          aria-expanded={profileOpen}
          aria-label={authLoading ? 'Loading account' : user?.email ? `Account: ${user.email}` : 'Sign in or create account'}
          className={`account-trigger ${profileOpen ? 'account-trigger-active' : ''}`}
          disabled={authLoading}
          onClick={() => {
            if (user) {
              setProfileOpen((open) => !open)
              setActionError('')
              setActionMessage('')
            } else {
              setDialogOpen(true)
            }
          }}
          title={user?.email ?? 'Sign in or create account'}
          type="button"
        >
          {user?.photoURL ? (
            <img alt="" className="account-avatar-image" referrerPolicy="no-referrer" src={user.photoURL} />
          ) : user ? (
            <span className="account-avatar-initials">{getInitials(user)}</span>
          ) : (
            <UserRound size={17} />
          )}
          {!user && <span className="account-trigger-label">Sign in</span>}
          {user && <ChevronDown className="account-trigger-chevron" size={13} />}
        </button>
        {profileOpen && user && (
          <div className="account-popover" role="dialog" aria-label="Account profile">
            <div className="account-popover-header">
              <div className="account-popover-avatar">
                {user.photoURL ? (
                  <img alt="" referrerPolicy="no-referrer" src={user.photoURL} />
                ) : (
                  getInitials(user)
                )}
              </div>
              <div className="account-user-copy">
                <strong>{user.displayName || 'SARscope user'}</strong>
                <span>{user.email}</span>
              </div>
            </div>
            <div className={`account-verification ${user.emailVerified ? 'account-verified' : 'account-unverified'}`}>
              {user.emailVerified ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}
              <span>{user.emailVerified ? 'Email verified' : 'Email not verified'}</span>
            </div>
            {!user.emailVerified && (
              <button
                className="account-action-button"
                disabled={actionBusy}
                onClick={() => void handleResendVerification()}
                type="button"
              >
                Resend verification email
              </button>
            )}
            {actionError && <p className="account-feedback account-feedback-error" role="alert">{actionError}</p>}
            {actionMessage && <p className="account-feedback account-feedback-success" role="status">{actionMessage}</p>}
            <button
              className="account-signout-button"
              disabled={actionBusy}
              onClick={() => void handleSignOut()}
              type="button"
            >
              <LogOut size={15} /> {actionBusy ? 'Please wait…' : 'Sign out'}
            </button>
          </div>
        )}
      </div>
      {dialogOpen && <AuthDialog onClose={() => setDialogOpen(false)} />}
    </>
  )
}
