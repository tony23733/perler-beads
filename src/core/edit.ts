// 手工编辑：在「算法计算出的网格」之上叠加用户的手工修改，并用命令栈支持撤销/重做。
//
// 模型：
// - `edits`：索引 → 色号 | null（null = 擦除成空格）。未出现在 map 里的格子用计算结果。
// - 一次「描边」（按下 → 拖动 → 抬起）记录成一条 `EditStroke`，是撤销/重做的最小单位。
//   每个 change 记录 before/after；undefined 表示「没有手工编辑」（恢复为计算值）。

export type Edits = Map<number, string | null>

export interface EditChange {
  index: number
  /** undefined = 该格此前无手工编辑，撤销时删除覆盖 */
  before: string | null | undefined
  /** undefined = 该格不再需要覆盖（与计算值一致） */
  after: string | null | undefined
}

export interface EditStroke {
  changes: EditChange[]
}

export interface HistoryState {
  edits: Edits
  past: EditStroke[]
  future: EditStroke[]
}

export function createHistory(): HistoryState {
  return { edits: new Map(), past: [], future: [] }
}

/** 可序列化的编辑项：[格点索引, 色号 | null] */
export type EditEntry = [number, string | null]

/** 把编辑层转成可 JSON 序列化的数组 */
export function serializeEdits(edits: Edits): EditEntry[] {
  return Array.from(edits, ([index, color]) => [index, color] as EditEntry)
}

/** 反序列化（容错：非法项直接跳过） */
export function deserializeEdits(entries: unknown): Edits {
  const map: Edits = new Map()
  if (!Array.isArray(entries)) return map
  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length !== 2) continue
    const [index, color] = entry as [unknown, unknown]
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) continue
    if (color !== null && typeof color !== 'string') continue
    map.set(index, color)
  }
  return map
}

/** 把手工编辑叠加到计算网格上，返回新数组（不改原数组） */
export function applyEdits(cells: (string | null)[], edits: Edits): (string | null)[] {
  if (edits.size === 0) return cells
  const out = cells.slice()
  for (const [index, value] of edits) {
    if (index >= 0 && index < out.length) out[index] = value
  }
  return out
}

/** 把一条描边记入历史（清空 redo 栈）；edits 已在描边过程中更新 */
export function commitStroke(state: HistoryState, stroke: EditStroke): HistoryState {
  if (stroke.changes.length === 0) return state
  return { edits: state.edits, past: [...state.past, stroke], future: [] }
}

function revert(state: HistoryState, stroke: EditStroke, direction: 'before' | 'after'): Edits {
  const next = new Map(state.edits)
  for (const change of stroke.changes) {
    const value = direction === 'before' ? change.before : change.after
    if (value === undefined) next.delete(change.index)
    else next.set(change.index, value)
  }
  return next
}

/** 撤销一步；无可撤销时原样返回 */
export function undo(state: HistoryState): HistoryState {
  const stroke = state.past[state.past.length - 1]
  if (!stroke) return state
  return {
    edits: revert(state, stroke, 'before'),
    past: state.past.slice(0, -1),
    future: [stroke, ...state.future],
  }
}

/** 重做一步；无可重做时原样返回 */
export function redo(state: HistoryState): HistoryState {
  const stroke = state.future[0]
  if (!stroke) return state
  return {
    edits: revert(state, stroke, 'after'),
    past: [...state.past, stroke],
    future: state.future.slice(1),
  }
}
