import WatchDashboard from '../components/watch-dashboard'
import { listWatchJobs } from '../lib/watch-service.js'

export default async function Page() {
  try {
    const watches = await listWatchJobs()
    return <WatchDashboard initialWatches={watches} dbError={null} />
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unexpected error'
    return <WatchDashboard initialWatches={[]} dbError={message} />
  }
}
