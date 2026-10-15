import { simpleCamelcaseKeys } from '@mx-space/api-client'
import { useQuery } from '@tanstack/react-query'
import { nanoid } from 'nanoid'
import { useEffect } from 'react'

import { fetchAppUrl } from '~/atoms'
import { setIsOwnerLogged } from '~/atoms/hooks/owner'
import { setSessionReader } from '~/atoms/hooks/reader'
import { SITE_CAPABILITIES } from '~/constants/site'
import { apiClient } from '~/lib/request'
import type { SessionReader } from '~/models/session'

type AdapterUser = SessionReader & { role?: string }
export const AuthSessionProvider: Component = ({ children }) => {
  const { data: session } = useQuery({
    queryKey: ['session'],
    enabled: SITE_CAPABILITIES.authentication,
    refetchOnMount: 'always',
    queryFn: () =>
      apiClient.proxy.auth.session.get<AdapterUser>({
        params: {
          r: nanoid(),
        },
      }),
  })
  useEffect(() => {
    if (!SITE_CAPABILITIES.authentication || !session?.id) {
      setIsOwnerLogged(false)
      setSessionReader(null)
      return
    }
    const transformedData = simpleCamelcaseKeys(session)

    setSessionReader(transformedData)
    if (transformedData.role === 'owner') {
      setIsOwnerLogged(true)
      fetchAppUrl()
    }
  }, [session])
  return children
}
