import type { SubscribeTypeToBitMap } from '@mx-space/api-client'
import { useQuery } from '@tanstack/react-query'

import { useModalStack } from '~/components/ui/modal'
import { SITE_CAPABILITIES } from '~/constants/site'
import { apiClient } from '~/lib/request'

import { SubscribeModal } from './SubscribeModal'

const QUERY_CHECK_SUBSCRIBE_KEY = ['subscribe-status']

export const useSubscribeStatusQuery = () =>
  useQuery({
    queryKey: QUERY_CHECK_SUBSCRIBE_KEY,
    enabled: SITE_CAPABILITIES.emailSubscription,
    queryFn: apiClient.subscribe.check,
    gcTime: 60_000 * 10,
  })

export const useIsEnableSubscribe = () => {
  const { data } = useQuery({
    queryKey: QUERY_CHECK_SUBSCRIBE_KEY,
    enabled: SITE_CAPABILITIES.emailSubscription,
    queryFn: apiClient.subscribe.check,
    select: (data: { enable: boolean }) => data?.enable,
    gcTime: 60_000 * 10,
    staleTime: 60_000 * 10,
    meta: {
      persist: false,
    },
  })
  return SITE_CAPABILITIES.emailSubscription && data === true
}

export const usePresentSubscribeModal = (
  defaultTypes?: (keyof typeof SubscribeTypeToBitMap)[],
) => {
  const { present } = useModalStack()

  return {
    present: () => {
      if (!SITE_CAPABILITIES.emailSubscription) return
      const dispose = present({
        title: '订阅',
        clickOutsideToDismiss: true,
        content: () => (
          <SubscribeModal onConfirm={dispose} defaultTypes={defaultTypes} />
        ),
      })
    },
  }
}
