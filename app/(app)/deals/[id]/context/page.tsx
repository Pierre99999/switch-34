import { redirect } from 'next/navigation'

// Superseded. Kept so old links and bookmarks resolve.
export default async function Moved({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/lab/deals/${id}/context`)
}
