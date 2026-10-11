import { writeFileSync } from 'fs'
import { join } from 'path'

/** Stamps the commit the payload was built from, for checking Linux artifacts. */
export function writeLinuxBuildSha(appPath: string, sha: string) {
  writeFileSync(
    join(appPath, 'resources', 'app', 'linux-build-sha'),
    `${sha}\n`
  )
}
