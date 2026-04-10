import { readFileSync } from 'fs'
import { resolve } from 'path'

import { describe, expect, it } from 'bun:test'

const ROOT = process.cwd()
const SCHEMA_PATH = resolve(ROOT, 'src/templates/progress.schema.json')
const TEMPLATE_PATH = resolve(ROOT, 'src/templates/progress.json')

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

describe('progress schema', () => {
  it('locks progress.json to a fixed top-level schema', () => {
    const schema = readJson(SCHEMA_PATH)

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
    expect(schema.type).toBe('object')
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required).toEqual([
      'feature',
      'requirementDoc',
      'planDoc',
      'createdAt',
      'updatedAt',
      'completedAt',
      'lastRun',
      'tasks',
    ])
  })

  it('locks lastRun to null or a fixed 6-field object', () => {
    const schema = readJson(SCHEMA_PATH)
    const variants = schema.properties.lastRun.anyOf
    const objectVariant = variants.find((item) => item.type === 'object')

    expect(variants).toHaveLength(2)
    expect(variants.some((item) => item.type === 'null')).toBe(true)
    expect(objectVariant.additionalProperties).toBe(false)
    expect(objectVariant.required).toEqual(['taskId', 'taskName', 'status', 'exitStatus', 'exitReason', 'ranAt'])
    expect(objectVariant.properties.status.enum).toEqual(['in-progress', 'done'])
    expect(objectVariant.properties.exitStatus.enum).toEqual(['succeeded', 'failed', 'aborted', 'blocked', 'timeout'])
  })

  it('locks each task item to the fixed 9-field schema', () => {
    const schema = readJson(SCHEMA_PATH)
    const taskSchema = schema.properties.tasks.items

    expect(schema.properties.tasks.minItems).toBe(1)
    expect(taskSchema.type).toBe('object')
    expect(taskSchema.additionalProperties).toBe(false)
    expect(taskSchema.required).toEqual([
      'id',
      'name',
      'status',
      'dependsOn',
      'parallelizable',
      'output',
      'startedAt',
      'completedAt',
      'durationSeconds',
    ])
    expect(taskSchema.properties.status.enum).toEqual(['pending', 'in-progress', 'done'])
    expect(taskSchema.properties.parallelizable.type).toBe('boolean')
    expect(taskSchema.properties.durationSeconds.minimum).toBe(0)
  })

  it('keeps the progress template aligned with the schema field set', () => {
    const template = readJson(TEMPLATE_PATH)

    expect(Object.keys(template)).toEqual([
      'feature',
      'requirementDoc',
      'planDoc',
      'createdAt',
      'updatedAt',
      'completedAt',
      'lastRun',
      'tasks',
    ])
    expect(template.lastRun).toBe(null)
    expect(Object.keys(template.tasks[0])).toEqual([
      'id',
      'name',
      'status',
      'dependsOn',
      'parallelizable',
      'output',
      'startedAt',
      'completedAt',
      'durationSeconds',
    ])
  })
})
