import { redirect } from 'next/navigation'

// The company profile became the Sales Playbook. Old links and bookmarks
// (including feedback recorded against /profile) still resolve.
export default function ProfileRedirect() {
  redirect('/playbook')
}
