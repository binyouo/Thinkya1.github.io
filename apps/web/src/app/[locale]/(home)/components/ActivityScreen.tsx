import { ErrorBoundary } from '~/components/common/ErrorBoundary'
import { SITE_CAPABILITIES } from '~/constants/site'

import { ActivityPostList } from './ActivityPostList'
import { ActivityRecent } from './ActivityRecent'
import { TwoColumnLayout } from './TwoColumnLayout'

export const ActivityScreen = () =>
  !SITE_CAPABILITIES.recentActivity ? (
    <div className="paper-home-section">
      <ActivityPostList />
    </div>
  ) : (
    <div className="mt-24">
      <TwoColumnLayout
        rightContainerClassName="block lg:flex [&>div]:w-full px-4"
        leftContainerClassName="[&>div]:w-full px-4"
      >
        <ActivityPostList />
        <ErrorBoundary>
          <ActivityRecent />
        </ErrorBoundary>
      </TwoColumnLayout>
    </div>
  )
