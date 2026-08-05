'use client'

import LabSidebar from '@/components/lab/LabSidebar'
import PipelineView from '@/components/pipeline/PipelineView'

// The same pipeline as the live app — it was already right. Only the
// destination of a deal differs: here it opens the one-screen deal view.
export default function LabPipeline() {
  return (
    <div className="flex">
      <LabSidebar />
      <div className="flex-1 min-w-0">
        <PipelineView dealHref={id => `/lab/deals/${id}`} />
      </div>
    </div>
  )
}
