import WatchDashboard from '../components/watch-dashboard'
import { listWatchJobs } from '../lib/watch-service'

export const dynamic = 'force-dynamic'

export default async function Page() {
  try {
    const watches = await listWatchJobs()
    return <WatchDashboard initialWatches={watches} dbError={null} />
  } catch (error) {
    return <WatchDashboard initialWatches={[]} dbError={error.message} />
  }
}
