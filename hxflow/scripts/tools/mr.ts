/**
 * hx-mr.ts — MR 事实工具
 *
 * 用法：
 *   hx mr archive <feature>
 *       归档 feature 产物到 archive 目录
 *
 * 所有子命令输出 JSON 到 stdout，失败时 exit 1。
 */

import { exitWithJsonError as err, printJson as out } from '../lib/json-cli.ts'
import {
  archiveFeature,
  getFeatureArtifactExistence,
  getFeatureArtifactPaths,
  resolveFeatureArtifactRoot,
} from '../lib/file-paths.ts'
import { createToolContext } from '../lib/tool-cli.ts'

const { sub, positional, projectRoot: initialProjectRoot } = createToolContext()
const [feature] = positional

switch (sub) {
  case 'archive': {
    if (!feature) err('用法：hx mr archive <feature>')

    const projectRoot = resolveFeatureArtifactRoot(initialProjectRoot, feature)
    const artifacts = getFeatureArtifactPaths(projectRoot, feature)
    const artifactExists = getFeatureArtifactExistence(artifacts)
    const alreadyArchived = !artifactExists.progressFile && artifactExists.archivedProgressFile

    if (alreadyArchived) {
      out({ ok: true, feature, performed: false, archived: [], reason: '已归档' })
      break
    }

    try {
      const result = archiveFeature(projectRoot, feature)
      out({ ok: true, feature, performed: true, archived: result.archived })
    } catch (error) {
      err(error instanceof Error ? error.message : String(error))
    }
    break
  }

  default:
    err(`未知子命令 "${sub ?? ''}"，可用：archive`)
}
