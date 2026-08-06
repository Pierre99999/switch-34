import LabSidebar from '@/components/lab/LabSidebar'
import TeamView from '@/components/team/TeamView'

// Same team screen as the live app, in the lab's frame. Directors only — the
// menu entry is hidden for a rep, and this page is theirs to reach anyway.
export default function LabTeam() {
  return (
    <div className="flex">
      <LabSidebar />
      <div className="flex-1 min-w-0 pt-14 lg:pt-0"><TeamView /></div>
    </div>
  )
}
