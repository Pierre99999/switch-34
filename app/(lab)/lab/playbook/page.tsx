import LabSidebar from '@/components/lab/LabSidebar'
import PlaybookView from '@/components/playbook/PlaybookView'

// The same playbook screen as the live app, kept inside the lab's frame so the
// left menu does not vanish when you click it.
export default function LabPlaybook() {
  return (
    <div className="flex">
      <LabSidebar />
      <div className="flex-1 min-w-0"><PlaybookView /></div>
    </div>
  )
}
