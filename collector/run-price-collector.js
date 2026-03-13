import { getConfig } from './config.js'
import { getFetcherBySource } from './fetchers/fetcher-registry.js'
import { appendSnapshots, insertSnapshotsToDb } from './repository.js'

async function fetchOne(item) {
  const fetcher = getFetcherBySource(item.source)
  return fetcher(item)
}

async function run() {
  const config = getConfig()
  const snapshots = []

  for (const item of config.trackItems) {
    const snapshot = await fetchOne(item)
    snapshots.push(snapshot)
  }

  const dbResult = await insertSnapshotsToDb(snapshots)
  await appendSnapshots(config.outputFile, snapshots)

  console.log(`[collector] wrote ${snapshots.length} snapshots to ${config.outputFile}`)
  if (dbResult.enabled) {
    console.log(`[collector] inserted ${dbResult.inserted} snapshots into PostgreSQL`)
  } else {
    console.log('[collector] DATABASE_URL not set, skipped PostgreSQL insert')
  }
  for (const row of snapshots) {
    console.log(
      `[collector] ${row.source}:${row.externalId} ${row.price} ${row.currency} (${row.fetchedWith})`,
    )
  }
}

run().catch((error) => {
  console.error('[collector] failed:', error)
  process.exit(1)
})
