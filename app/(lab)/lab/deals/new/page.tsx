'use client'

import LabSidebar from '@/components/lab/LabSidebar'
import NewDealView from '@/components/deals/NewDealView'

// Same creation flow as the live app, inside the lab's frame — and the new
// deal opens on the lab's single screen rather than the context page.
//
// A client component on purpose: createdHref is a function, and a function
// cannot cross the server/client boundary as a prop. Same reason /lab is one.
export default function LabNewDeal() {
  return (
    <div className="flex">
      <LabSidebar />
      <div className="flex-1 min-w-0 pt-14 lg:pt-0">
        <NewDealView
          createdHref={id => `/lab/deals/${id}?new=1`}
          contextLocation="dans « Contexte prospect », à droite de la page du deal"
        />
      </div>
    </div>
  )
}
