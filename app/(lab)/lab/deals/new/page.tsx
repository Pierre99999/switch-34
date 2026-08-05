import LabSidebar from '@/components/lab/LabSidebar'
import NewDealView from '@/components/deals/NewDealView'

// Same creation flow as the live app, inside the lab's frame — and the new
// deal opens on the lab's single screen rather than the context page.
export default function LabNewDeal() {
  return (
    <div className="flex">
      <LabSidebar />
      <div className="flex-1 min-w-0">
        <NewDealView createdHref={id => `/lab/deals/${id}`} />
      </div>
    </div>
  )
}
