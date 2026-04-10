import { readFileSync } from 'fs'
import { resolve } from 'path'

import { describe, expect, it } from 'bun:test'

const ROOT = process.cwd()
const PACKAGE_JSON_PATH = resolve(ROOT, 'package.json')
const CLI_ENTRY_PATH = resolve(ROOT, 'bin/hx.js')

describe('package manifest', () => {
  it('publishes every builtin CLI script referenced by the entrypoint', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'))
    const cliEntry = readFileSync(CLI_ENTRY_PATH, 'utf8')

    expect(cliEntry).toContain("upgrade: 'hx-upgrade.ts'")
    expect(cliEntry).toContain("uninstall: 'hx-uninstall.ts'")
    expect(pkg.files).toContain('src/contracts/**/*')
    expect(pkg.files).toContain('src/scripts/hx-migrate.ts')
    expect(pkg.files).toContain('src/scripts/hx-setup.ts')
    expect(pkg.files).toContain('src/scripts/hx-upgrade.ts')
    expect(pkg.files).toContain('src/scripts/hx-uninstall.ts')
  })
})
