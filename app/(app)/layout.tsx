import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NavBar from '@/components/ui/NavBar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check vendor profile exists
  const { data: vendor } = await supabase
    .from('vendors')
    .select('id')
    .eq('user_id', user.id)
    .single()

  // Redirect to onboarding if no vendor profile (except if already there)
  if (!vendor) redirect('/onboarding')

  return (
    <div className="min-h-screen bg-white">
      <NavBar />
      <main>{children}</main>
    </div>
  )
}
