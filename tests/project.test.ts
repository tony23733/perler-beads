import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_GRID_OPTIONS } from '../src/core/grid'
import { PROJECT_VERSION, newProjectId, normalizeSettings } from '../src/core/project'
import type { ProjectRecord, ProjectSettingsSnapshot } from '../src/core/project'
import {
  _resetDbForTests,
  deleteProject,
  listProjects,
  loadProject,
  saveProject,
} from '../src/core/projectStore'

const defaults: ProjectSettingsSnapshot = {
  targetWidth: 50,
  targetHeight: 50,
  locked: true,
  paletteId: 'mard',
  background: 'keep',
  removeColor: null,
  tolerance: 30,
  minCoverage: 15,
  maxColors: 0,
  dither: 'none',
  ditherStrength: 1,
  gridOptions: { ...DEFAULT_GRID_OPTIONS },
}

function makeRecord(id: string, name: string, updatedAt: number): ProjectRecord {
  return {
    version: PROJECT_VERSION,
    id,
    name,
    createdAt: updatedAt,
    updatedAt,
    sourceName: 'photo.png',
    source: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' }),
    settings: { ...defaults, targetWidth: 29, targetHeight: 40, maxColors: 16 },
  }
}

describe('normalizeSettings', () => {
  it('空值返回默认快照且不共享 gridOptions 引用', () => {
    const s = normalizeSettings(undefined, defaults)
    expect(s).toEqual(defaults)
    expect(s.gridOptions).not.toBe(defaults.gridOptions)
  })

  it('保留合法字段', () => {
    const s = normalizeSettings(
      { targetWidth: 100, targetHeight: 80, background: 'remove', dither: 'ordered', removeColor: [10, 20, 30] },
      defaults,
    )
    expect(s.targetWidth).toBe(100)
    expect(s.background).toBe('remove')
    expect(s.dither).toBe('ordered')
    expect(s.removeColor).toEqual([10, 20, 30])
  })

  it('非法枚举与数值被回退/夹紧', () => {
    const s = normalizeSettings(
      {
        background: 'nope' as never,
        dither: 'weird' as never,
        targetWidth: -5,
        tolerance: 9999,
        minCoverage: -3,
        removeColor: [1, 2] as never,
      },
      defaults,
    )
    expect(s.background).toBe('keep')
    expect(s.dither).toBe('none')
    expect(s.targetWidth).toBe(1)
    expect(s.tolerance).toBe(441)
    expect(s.minCoverage).toBe(0)
    expect(s.removeColor).toBeNull()
  })
})

describe('projectStore (IndexedDB)', () => {
  beforeEach(() => {
    _resetDbForTests()
  })

  it('保存后可列出、读取、删除', async () => {
    const rec = makeRecord(newProjectId(), '测试工程', 1000)
    await saveProject(rec)

    const list = await listProjects()
    const meta = list.find((m) => m.id === rec.id)
    expect(meta).toMatchObject({ name: '测试工程', sourceName: 'photo.png' })
    // 列表不含大字段
    expect(meta).not.toHaveProperty('source')
    expect(meta).not.toHaveProperty('settings')

    const loaded = await loadProject(rec.id)
    expect(loaded?.settings.targetWidth).toBe(29)
    expect(loaded?.settings.maxColors).toBe(16)
    expect(loaded?.source).toBeInstanceOf(Blob)
    expect(loaded?.source.size).toBe(4)

    await deleteProject(rec.id)
    expect(await loadProject(rec.id)).toBeNull()
  })

  it('列表按更新时间倒序', async () => {
    const a = makeRecord(newProjectId(), 'A', 100)
    const b = makeRecord(newProjectId(), 'B', 200)
    await saveProject(a)
    await saveProject(b)
    const list = await listProjects()
    const ids = list.map((m) => m.id)
    expect(ids.indexOf(b.id)).toBeLessThan(ids.indexOf(a.id))
    await deleteProject(a.id)
    await deleteProject(b.id)
  })

  it('同 id 再次保存为覆盖更新', async () => {
    const id = newProjectId()
    await saveProject(makeRecord(id, '旧', 100))
    await saveProject(makeRecord(id, '新', 300))
    const loaded = await loadProject(id)
    expect(loaded?.name).toBe('新')
    await deleteProject(id)
  })
})
