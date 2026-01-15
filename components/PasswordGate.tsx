'use client'

import { useState, useEffect } from 'react'

const CORRECT_PASSWORD = 'password'
const STORAGE_KEY = 'clickpin_access'

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    setIsAuthenticated(stored === 'granted')
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === CORRECT_PASSWORD) {
      localStorage.setItem(STORAGE_KEY, 'granted')
      setIsAuthenticated(true)
      setError(false)
    } else {
      setError(true)
    }
  }

  // Still checking localStorage
  if (isAuthenticated === null) {
    return null
  }

  if (isAuthenticated) {
    return <>{children}</>
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: '#1a1a1a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '2rem',
        backgroundColor: '#2a2a2a',
        borderRadius: '8px',
        minWidth: '300px',
      }}>
        <h1 style={{
          margin: 0,
          fontSize: '1.25rem',
          color: '#fff',
          textAlign: 'center',
        }}>
          Enter Password
        </h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          style={{
            padding: '0.75rem 1rem',
            fontSize: '1rem',
            border: error ? '2px solid #ef4444' : '2px solid #444',
            borderRadius: '6px',
            backgroundColor: '#1a1a1a',
            color: '#fff',
            outline: 'none',
          }}
        />
        {error && (
          <p style={{ margin: 0, color: '#ef4444', fontSize: '0.875rem', textAlign: 'center' }}>
            Incorrect password
          </p>
        )}
        <button
          type="submit"
          style={{
            padding: '0.75rem 1rem',
            fontSize: '1rem',
            backgroundColor: '#92400e',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Enter
        </button>
      </form>
    </div>
  )
}
