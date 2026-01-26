import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { Toaster } from '@/components/ui/toaster'
import { Layout } from '@/components/layout/Layout'

// Pages
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Sites from '@/pages/Sites'
import SiteDetail from '@/pages/SiteDetail'
import Expenses from '@/pages/Expenses'
import Users from '@/pages/Users'
import Reports from '@/pages/Reports'
import Categories from './pages/Categories'
import Investments from '@/pages/Investments'
import FundAllocations from '@/pages/FundAllocations'
import Bills from '@/pages/Bills'
import Attendance from '@/pages/Attendance'
import WorkerLedger from '@/pages/WorkerLedger'
import Organization from '@/pages/Organization'

// Protected route wrapper for role-based access
function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />
  }

  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />

      {/* Protected routes */}
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sites" element={<Sites />} />
        <Route path="/sites/:id" element={<SiteDetail />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={[1, 2]}>
              <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={[1, 2]}>
              <Reports />
            </ProtectedRoute>
          }
        />
          <Route path="/categories"
          element={
            <ProtectedRoute allowedRoles={[1, 2]}>
              <Categories />
            </ProtectedRoute>
          }
          />
        <Route
          path="/investments"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <Investments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/funds"
          element={
            <ProtectedRoute allowedRoles={[1, 2]}>
              <FundAllocations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bills"
          element={
            <ProtectedRoute allowedRoles={[1, 2]}>
              <Bills />
            </ProtectedRoute>
          }
        />
        <Route
          path="/attendance"
          element={
            <ProtectedRoute allowedRoles={[1, 2]}>
              <Attendance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ledger"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3]}>
              <WorkerLedger />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organization"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <Organization />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
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
