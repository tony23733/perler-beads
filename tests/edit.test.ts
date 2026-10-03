import { describe, expect, it } from 'vitest'
import { applyEdits, commitStroke, createHistory, deserializeEdits, redo, serializeEdits, undo } from '../src/core/edit'
import type { EditStroke } from '../src/core/edit'
import { statsFromCells } from '../src/core/matcher'

const base: (string | null)[] = ['A1', 'A2', null, 'A1']

describe('applyEdits', () => {
  it('无编辑时原样返回同一数组', () => {
    expect(applyEdits(base, new Map())).toBe(base)
  })

  it('叠加覆盖且不修改原数组', () => {
    const edits = new Map<number, string | null>([
      [1, 'B3'],
      [2, null],
    ])
    const out = applyEdits(base, edits)
    expect(out).toEqual(['A1', 'B3', null, 'A1'])
    expect(base).toEqual(['A1', 'A2', null, 'A1'])
  })

  it('越界索引被忽略', () => {
    const out = applyEdits(base, new Map([[99, 'X' as never]]))
    expect(out).toEqual(base)
  })
})

describe('撤销 / 重做', () => {
  // 一次描边：把 0 号从「无编辑(计算值 A1)」改成 B2；1 号从 A2 改成 null
  const stroke: EditStroke = {
    changes: [
      { index: 0, before: undefined, after: 'B2' },
      { index: 1, before: undefined, after: null },
    ],
  }

  it('提交后用新 edits 计算出结果', () => {
    let state = createHistory()
    // 模拟描边过程中已写入 edits
    state = { ...state, edits: new Map([[0, 'B2'], [1, null]]) }
    state = commitStroke(state, stroke)
    expect(state.past).toHaveLength(1)
    expect(state.future).toHaveLength(0)
    expect(applyEdits(base, state.edits)).toEqual(['B2', null, null, 'A1'])
  })

  it('撤销回到计算值，重做再应用', () => {
    let state = createHistory()
    state = { ...state, edits: new Map([[0, 'B2'], [1, null]]) }
    state = commitStroke(state, stroke)

    state = undo(state)
    expect(state.edits.size).toBe(0)
    expect(applyEdits(base, state.edits)).toEqual(base)
    expect(state.past).toHaveLength(0)
    expect(state.future).toHaveLength(1)

    state = redo(state)
    expect(applyEdits(base, state.edits)).toEqual(['B2', null, null, 'A1'])
    expect(state.past).toHaveLength(1)
    expect(state.future).toHaveLength(0)
  })

  it('已有编辑再改，撤销恢复到上一次的值', () => {
    let state = createHistory()
    // 第一次描边：0 号 → B2（描边过程中写入 edits）
    state = { ...state, edits: new Map([[0, 'B2']]) }
    state = commitStroke(state, { changes: [{ index: 0, before: undefined, after: 'B2' }] })
    // 第二次描边：0 号 B2 → C4
    state = { ...state, edits: new Map([[0, 'C4']]) }
    state = commitStroke(state, { changes: [{ index: 0, before: 'B2', after: 'C4' }] })
    expect(state.edits.get(0)).toBe('C4')
    state = undo(state)
    expect(state.edits.get(0)).toBe('B2')
    state = undo(state)
    expect(state.edits.has(0)).toBe(false)
  })

  it('空描边不入栈，无可撤销时原样返回', () => {
    let state = createHistory()
    const same = commitStroke(state, { changes: [] })
    expect(same).toBe(state)
    expect(undo(state)).toBe(state)
    expect(redo(state)).toBe(state)
  })
})

describe('statsFromCells', () => {
  it('统计并排序', () => {
    const stats = statsFromCells(['A1', 'A1', null, 'H7', 'A1', 'H7', 'B2'])
    expect(stats).toEqual([
      { id: 'A1', count: 3 },
      { id: 'H7', count: 2 },
      { id: 'B2', count: 1 },
    ])
  })

  it('全空返回空统计', () => {
    expect(statsFromCells([null, null])).toEqual([])
  })
})

describe('serializeEdits / deserializeEdits', () => {
  it('往返一致', () => {
    const edits = new Map<number, string | null>([
      [0, 'B2'],
      [5, null],
    ])
    const entries = serializeEdits(edits)
    expect(entries).toEqual([
      [0, 'B2'],
      [5, null],
    ])
    expect(deserializeEdits(entries)).toEqual(edits)
  })

  it('容错非法项', () => {
    const result = deserializeEdits([['x', 1], [1, 2], [2, 'A1'], [3]])
    expect(result).toEqual(new Map([[2, 'A1']]))
    expect(deserializeEdits(null).size).toBe(0)
  })
})
