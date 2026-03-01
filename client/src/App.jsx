import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { Toaster } from '@/components/ui/toaster'

// Role-based home pages (Splitwise-style mobile UI)
import Login from '@/pages/Login'
import DeveloperHome from '@/pages/DeveloperHome'
import EngineerHome from '@/pages/EngineerHome'
import SupervisorExpense from '@/pages/SupervisorExpense'

// Loading spinner shared across role guards
function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    </div>
  )
}

// Guard that redirects unauthenticated users to /login
function RoleRoute({ element }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return element
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) return <Spinner />

  // Role-based routing — each role gets a dedicated mobile UI
  if (user?.role === 1) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<RoleRoute element={<DeveloperHome />} />} />
      </Routes>
    )
  }

  if (user?.role === 2) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<RoleRoute element={<EngineerHome />} />} />
      </Routes>
    )
  }

  if (user?.role === 3) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<RoleRoute element={<SupervisorExpense />} />} />
      </Routes>
    )
  }

  // Unauthenticated / unknown role → login
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
