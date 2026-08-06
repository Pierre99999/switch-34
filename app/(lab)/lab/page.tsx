'use client'

import LabSidebar from '@/components/lab/LabSidebar'
import PipelineView from '@/components/pipeline/PipelineView'

// The same pipeline as the live app — it was already right. What differs: a
// deal opens the one-screen view, and the list stops repeating the four gate
// scores, which that screen shows in full. The next step is the only column
// that has to be here.
export default function LabPipeline() {
  return (
    <div className="flex">
      <LabSidebar />
      <div className="flex-1 min-w-0 pt-14 lg:pt-0">
        <PipelineView dealHref={id => `/lab/deals/${id}`} stepHref={id => `/lab/deals/${id}`} showScores={false} />
      </div>
    </div>
  )
}
