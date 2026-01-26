import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '@/lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      try {
        const { data } = await authApi.me()
        setUser(data)
      } catch (error) {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
      }
    }
    setLoading(false)
  }

  const login = async (email, password) => {
    const { data } = await authApi.login({ email, password })
    localStorage.setItem('accessToken', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    setUser(data.user)
    return data.user
  }

  const register = async (email, password, name) => {
    const { data } = await authApi.register({ email, password, name })
    localStorage.setItem('accessToken', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    setUser(data.user)
    return data.user
  }

  const logout = () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setUser(null)
  }

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    refreshUser: checkAuth,
    isAuthenticated: !!user,
    isAdmin: user?.role === 1,
    isSupervisor: user?.role === 2,
    isWorker: user?.role === 3,
    canManageUsers: user?.role === 1 || user?.role === 2,
    canManageSites: user?.role === 1,
    hasOrganization: !!user?.organization,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
