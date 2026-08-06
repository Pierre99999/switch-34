import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ToastProvider from '@/components/ui/Toast'
import FeedbackWidget from '@/components/ui/FeedbackWidget'

// The interface. It was built beside the previous one, on the same engine and
// the same database — same deals, same rounds, same criteria, same evidence —
// and it is now the only one. What is left of the old route group is what the
// lab does not yet replace: the prospect context editor it links to.
export default async function LabLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: vendor } = await supabase
    .from('vendors').select('id').eq('user_id', user.id).single()
  if (!vendor) redirect('/onboarding')

  return (
    <ToastProvider>
      <div className="min-h-screen bg-neutral-50">{children}</div>
      <FeedbackWidget />
    </ToastProvider>
  )
}
