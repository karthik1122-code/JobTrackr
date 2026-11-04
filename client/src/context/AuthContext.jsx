import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tokenStore, setSessionExpiredHandler } from '../api/client'
import { fetchMe, loginUser, registerUser } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(tokenStore.get())
  // true until we know whether the saved token is still valid
  const [checking, setChecking] = useState(Boolean(tokenStore.get()))
  // shown on the login page, e.g. "Your session has expired"
  const [notice, setNotice] = useState('')

  const logout = useCallback(
    (message = '') => {
      tokenStore.clear()
      setToken(null)
      setUser(null)
      setNotice(message)
      // after an expired session, send them back to the same page once they log in again
      const from = message ? window.location.pathname + window.location.search : '/'
      navigate('/login', { replace: true, state: { from } })
    },
    [navigate],
  )

  // the Axios interceptor calls this on any 401 while logged in
  useEffect(() => {
    setSessionExpiredHandler(() => logout('Your session has expired. Please log in again.'))
  }, [logout])

  // on page load: if there's a saved token, ask the API who it belongs to before showing anything
  useEffect(() => {
    if (!tokenStore.get()) return
    fetchMe()
      .then(setUser)
      .catch(() => {
        // a 401 is handled by the interceptor; anything else (server down) also means we can't trust it
        tokenStore.clear()
        setToken(null)
      })
      .finally(() => setChecking(false))
  }, [])

  const saveSession = useCallback((data) => {
    tokenStore.set(data.token)
    setToken(data.token)
    setUser(data.user)
    setNotice('')
  }, [])

  const login = useCallback(async (details) => saveSession(await loginUser(details)), [saveSession])
  const register = useCallback(async (details) => saveSession(await registerUser(details)), [saveSession])

  const value = useMemo(
    () => ({ user, token, checking, notice, login, register, logout: () => logout(''), clearNotice: () => setNotice('') }),
    [user, token, checking, notice, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
