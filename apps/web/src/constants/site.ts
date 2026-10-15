// The current deployment reads Markdown from this repository. Enable these
// capabilities only after connecting the matching persistent backend.
export const SITE_CAPABILITIES = {
  authentication: false,
  likes: false,
  emailSubscription: false,
  livePresence: false,
  recentActivity: false,
  readCounts: false,
  notes: false,
  thinking: false,
  projects: false,
  friends: false,
  says: false,
}

export const isSiteRouteEnabled = (path: string) => {
  const [pathname, search = ''] = path.split('?')
  const section = pathname.split('/')[1]
  const searchParams = new URLSearchParams(search)
  if (
    section === 'timeline' &&
    (searchParams.get('type') === 'note' ||
      searchParams.has('memory') ||
      searchParams.has('bookmark'))
  ) {
    return SITE_CAPABILITIES.notes
  }
  switch (section) {
    case 'notes':
    case 'thinking':
    case 'projects':
    case 'friends':
    case 'says':
      return SITE_CAPABILITIES[section]
    default:
      return true
  }
}
