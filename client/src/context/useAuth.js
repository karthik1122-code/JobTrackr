import { createContext, useContext } from 'react'

// kept in its own file so AuthContext.jsx only exports a component (keeps fast refresh happy)
export const AuthContext = createContext(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
