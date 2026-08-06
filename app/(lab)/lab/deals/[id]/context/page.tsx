'use client'

import LabSidebar from '@/components/lab/LabSidebar'
import ContextView from '@/components/deal/ContextView'

// The prospect context editor — the one screen of the old interface the deal
// page does not replace: the knowledge panel shows this material, this is
// where it is corrected.
export default function LabContext() {
  return (
    <div className="flex">
      <LabSidebar />
      <div className="flex-1 min-w-0 pt-14 lg:pt-0"><ContextView /></div>
    </div>
  )
}
