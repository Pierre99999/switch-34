import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ADMIN_EMAIL } from '@/lib/admin-config'
import AdminView from '@/components/admin/AdminView'

// Gated on the server, before anything renders. AdminView also redirects, but
// that check runs in an effect after the page has already been sent — every
// API behind it refuses a stranger, so nothing leaked, but the shell of an
// admin screen should not appear at all. The lab's copy of this page is
// covered by the (lab) layout, which gates the whole group the same way.
export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if ((user.email ?? '').toLowerCase() !== ADMIN_EMAIL) redirect('/pipeline')

  return <AdminView />
}
