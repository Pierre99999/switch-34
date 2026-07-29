'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/types'

type RoleCtx = {
  role: UserRole
  fullName: string | null
  organizationId: string | null
  onboardingCompleted: boolean
  loading: boolean
  refresh: () => Promise<void>
}

const RoleContext = createContext<RoleCtx>({
  role: 'sales', fullName: null, organizationId: null, onboardingCompleted: false, loading: true,
  refresh: async () => {},
})

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>('sales')
  const [fullName, setFullName] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  // The provider mounts in the root layout, possibly BEFORE the vendors row
  // exists (signup/onboarding). Track whether we actually found it so we can
  // retry on navigation instead of keeping the stale default role.
  const hasVendorRow = useRef(false)
  const pathname = usePathname()

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { hasVendorRow.current = false; setLoading(false); return }
    const { data } = await supabase
      .from('vendors')
      .select('role, full_name, organization_id, onboarding_completed')
      .eq('user_id', user.id)
      .maybeSingle()
    if (data) {
      hasVendorRow.current = true
      setRole((data.role as UserRole) ?? 'director')
      setFullName(data.full_name)
      setOrganizationId(data.organization_id)
      setOnboardingCompleted(data.onboarding_completed ?? false)
    }
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // Until the vendor row has been seen once, re-check on every client-side
  // navigation — this covers the fresh-signup flow where the row is created
  // during onboarding after the provider mounted.
  useEffect(() => {
    if (!hasVendorRow.current) refresh()
  }, [pathname, refresh])

  return (
    <RoleContext.Provider value={{ role, fullName, organizationId, onboardingCompleted, loading, refresh }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() { return useContext(RoleContext) }
