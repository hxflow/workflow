import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

import { describe, expect, it } from 'bun:test'

const ROOT = process.cwd()
const WORKFLOW_PATH = resolve(ROOT, '.github', 'workflows', 'publish-package.yml')
const NPMRC_PATH = resolve(ROOT, '.npmrc')

describe('publish workflow', () => {
  it('uses GitHub Packages official publishing flow', () => {
    expect(existsSync(WORKFLOW_PATH)).toBe(true)

    const workflow = readFileSync(WORKFLOW_PATH, 'utf8')

    expect(workflow).toContain('push:')
    expect(workflow).toContain("      - 'v*'")
    expect(workflow).not.toContain('release:')
    expect(workflow).toContain('actions/setup-node@v4')
    expect(workflow).toContain('registry-url: https://npm.pkg.github.com')
    expect(workflow).toContain("scope: '@hxflow'")
    expect(workflow).toContain('NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}')
  })

  it('maps the hxflow scope to GitHub Packages in npmrc', () => {
    expect(existsSync(NPMRC_PATH)).toBe(true)

    const npmrc = readFileSync(NPMRC_PATH, 'utf8')

    expect(npmrc).toContain('@hxflow:registry=https://npm.pkg.github.com')
    expect(npmrc).toContain('//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}')
    expect(npmrc).not.toContain('npm.cdfsunrise.com')
  })
})
