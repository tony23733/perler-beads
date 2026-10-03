// 工程持久化：用 IndexedDB 保存/列出/加载/删除工程（源图以 Blob 存储）。
// 纯本地，无后端。IndexedDB 不可用时（隐私模式/测试环境）抛错，由界面提示。

import type { ProjectMeta, ProjectRecord } from './project'

const DB_NAME = 'perler-beads'
const DB_VERSION = 1
const STORE = 'projects'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前环境不支持 IndexedDB'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('打开数据库失败'))
  })
  return dbPromise
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 请求失败'))
  })
}

/** 新增或覆盖保存一个工程 */
export async function saveProject(record: ProjectRecord): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('保存失败'))
    tx.onabort = () => reject(tx.error ?? new Error('保存被中断'))
  })
}

/** 列出全部工程元信息（按更新时间倒序） */
export async function listProjects(): Promise<ProjectMeta[]> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readonly')
  const records = await requestToPromise<ProjectRecord[]>(tx.objectStore(STORE).getAll())
  return records
    .map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      sourceName: r.sourceName,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

/** 读取单个工程（含源图与设置）；不存在返回 null */
export async function loadProject(id: string): Promise<ProjectRecord | null> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readonly')
  const record = await requestToPromise<ProjectRecord | undefined>(tx.objectStore(STORE).get(id))
  return record ?? null
}

/** 删除一个工程 */
export async function deleteProject(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('删除失败'))
  })
}

/** 仅供测试：重置缓存的连接（配合 fake-indexeddb 使用） */
export function _resetDbForTests(): void {
  dbPromise = null
}
