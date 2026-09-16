import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import LoadingScreen from './LoadingScreen'

export default function PublicOnlyRoute() {
  const { session, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (session) return <Navigate to="/" replace />

  return <Outlet />
}
