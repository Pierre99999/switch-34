'use client'

import LabSidebar from '@/components/lab/LabSidebar'
import MissionControl from '@/components/mission/MissionControl'

// Mission Control — the portfolio read three ways: ask it, act on it, see it.
// The table is still underneath: a map is good for seeing, a table for finding.
export default function LabMissionControl() {
  return (
    <div className="flex">
      <LabSidebar />
      <div className="flex-1 min-w-0 pt-14 lg:pt-0">
        <MissionControl />
      </div>
    </div>
  )
}
