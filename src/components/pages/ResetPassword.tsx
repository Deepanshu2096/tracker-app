import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES_FRONTEND } from '@/constant'
import ResetPasswordForm from './components/ResetPasswordForm'

export default function ResetPassword() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) return
  }, [loading, user])

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      <div className="hidden lg:flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900 text-white px-10">
        <div className="space-y-6 max-w-md">
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-semibold tracking-wide p-2 px-4 border rounded-xl">Anvesana 2.0</h1>
          </div>
          <h2 className="text-4xl font-bold leading-tight">Manage your team, effortlessly.</h2>
          <p className="text-lg text-slate-200">Anvesana 2.0 is your comprehensive team management platform built for efficiency, collaboration, and organizations that move fast.</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <ResetPasswordForm />
        </div>
      </div>
    </div>
  )
}


