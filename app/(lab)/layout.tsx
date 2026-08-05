import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ADMIN_EMAIL } from '@/lib/admin-config'
import ToastProvider from '@/components/ui/Toast'

// The lab: a second interface built beside the live one, on the same engine
// and the same database. Nothing here changes the method — it is a different
// surface over the same deals, rounds, criteria and evidence.
//
// Gated to the admin address, server-side: testers must keep working on the
// current app without ever landing here by accident.
export default async function LabLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if ((user.email ?? '').toLowerCase() !== ADMIN_EMAIL) redirect('/pipeline')

  return (
    <ToastProvider>
      <div className="min-h-screen bg-neutral-50">{children}</div>
    </ToastProvider>
  )
}
