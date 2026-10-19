import { useState } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'

const schema = z.object({
  email: z.string().email('Invalid email').nonempty('Email is required'),
})

type FormData = z.infer<typeof schema>

export default function ForgotPasswordForm() {
  const { resetPasswordForEmail } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors, isValid } } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
  })

  const onSubmit = async ({ email }: FormData) => {
    setLoading(true)
    const { error } = await resetPasswordForEmail(email)
    setLoading(false)
    if (error) {
      const message = error?.message?.toLowerCase().includes('not found') || error?.status === 400
        ? 'No account found with that email.'
        : error.message
      toast({ title: 'Error', description: message, variant: 'destructive' })
      return
    }
    toast({ title: 'Email sent', description: 'Check your email for the reset link.' })
  }

  return (
    <Card className="backdrop-blur-md bg-white/60 dark:bg-slate-900/50 shadow-xl border border-border">
      <CardHeader className="text-center space-y-2 pb-4">
        <CardTitle className="text-2xl font-bold tracking-tight">Reset your password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@anvesana.ai" {...register('email')} className={errors.email && 'border-red-500'} />
            {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
          </div>
          <Button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white" disabled={loading || !isValid}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Sending...</> : 'Send reset link'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}


