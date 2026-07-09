'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/types'

type RoleCtx = { role: UserRole; fullName: string | null; loading: boolean }

const RoleContext = createContext<RoleCtx>({ role: 'sales', fullName: null, loading: true })

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>('sales')
  const [fullName, setFullName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase.from('vendors').select('role, full_name').eq('user_id', user.id).single()
      if (data) {
        setRole((data.role as UserRole) ?? 'director')
        setFullName(data.full_name)
      }
      setLoading(false)
    }
    load()
  }, [])

  return <RoleContext.Provider value={{ role, fullName, loading }}>{children}</RoleContext.Provider>
}

export function useRole() { return useContext(RoleContext) }
