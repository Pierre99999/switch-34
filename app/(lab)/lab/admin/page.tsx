import LabSidebar from '@/components/lab/LabSidebar'
import AdminView from '@/components/admin/AdminView'

export default function LabAdmin() {
  return (
    <div className="flex">
      <LabSidebar />
      <div className="flex-1 min-w-0 pt-14 lg:pt-0"><AdminView /></div>
    </div>
  )
}
