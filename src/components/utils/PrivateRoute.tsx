import { useEffect } from 'react'
import { useNavigate, Outlet } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { ROUTES_FRONTEND } from '../../constant'
import { SESSION_EXPIRED_FLAG } from '../../hooks/useAuth'

export function PrivateRoute() {
    const { user, loading } = useAuth()
    const navigate = useNavigate()
    
    useEffect(() => {
        if (!loading && !user) {
            const expired = sessionStorage.getItem(SESSION_EXPIRED_FLAG)
            if (expired) {
                sessionStorage.removeItem(SESSION_EXPIRED_FLAG)
                navigate(`${ROUTES_FRONTEND.LOGIN}?expired=1`, { replace: true })
            } else {
                navigate(ROUTES_FRONTEND.LOGIN)
            }
        }
    }, [user, loading, navigate])
    
    // Show loading state while checking authentication
    if (loading) {
        return <div>Loading...</div>
    }
    
    // If not authenticated, don't render anything (will redirect)
    if (!user) {
        return null
    }
    
    // If authenticated, allow access to private routes
    return <Outlet />
}