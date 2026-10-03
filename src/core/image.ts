// 从用户选择的文件读取为 ImageData（主线程）。

/** 源图最长边上限，避免超大图占用过多内存 */
const MAX_DIMENSION = 6000

/**
 * 把图片文件解码并绘制到画布，返回 ImageData。
 * 超过 MAX_DIMENSION 时按比例缩小。
 */
export async function loadImageData(file: File): Promise<ImageData> {
  const bitmap = await createImageBitmap(file)
  try {
    const { width, height } = bitmap
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('无法创建 2D 画布上下文')
    ctx.drawImage(bitmap, 0, 0, w, h)
    return ctx.getImageData(0, 0, w, h)
  } finally {
    bitmap.close()
  }
}

/**
 * 图片是否真的带透明通道（存在 alpha < 255 的像素）。
 * 普通照片（JPG / 不透明截图）全是 255，此时「透明背景」与「保留背景」效果相同。
 * 注意：必须在把 ImageData 交给 Worker（transfer 掉 buffer）之前调用。
 */
export function hasTransparency(imageData: ImageData): boolean {
  const data = imageData.data
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true
  }
  return false
}
