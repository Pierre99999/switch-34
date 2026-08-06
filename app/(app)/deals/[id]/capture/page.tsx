import { redirect } from 'next/navigation'

// The deal is one screen now. Kept so old links and bookmarks resolve.
export default async function Moved({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/lab/deals/${id}`)
}
