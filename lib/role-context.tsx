'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/types'

type RoleCtx = {
  role: UserRole
  fullName: string | null
  organizationId: string | null
  onboardingCompleted: boolean
  loading: boolean
}

const RoleContext = createContext<RoleCtx>({
  role: 'sales', fullName: null, organizationId: null, onboardingCompleted: false, loading: true,
})

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>('sales')
  const [fullName, setFullName] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('vendors')
        .select('role, full_name, organization_id, onboarding_completed')
        .eq('user_id', user.id)
        .single()
      if (data) {
        setRole((data.role as UserRole) ?? 'director')
        setFullName(data.full_name)
        setOrganizationId(data.organization_id)
        setOnboardingCompleted(data.onboarding_completed ?? false)
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <RoleContext.Provider value={{ role, fullName, organizationId, onboardingCompleted, loading }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() { return useContext(RoleContext) }
