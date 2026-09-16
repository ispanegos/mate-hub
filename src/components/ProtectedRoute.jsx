import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import LoadingScreen from './LoadingScreen'

export default function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace />

  return <Outlet />
}
