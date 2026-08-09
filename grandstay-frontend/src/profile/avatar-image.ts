export const MAX_AVATAR_UPLOAD_SIZE = 2 * 1024 * 1024
export const MAX_AVATAR_SOURCE_SIZE = 15 * 1024 * 1024
export const MAX_AVATAR_DIMENSION = 2048
export const AVATAR_FILE_TYPES = ['image/jpeg', 'image/png']

export type PreparedAvatar = {
  file: File
  optimized: boolean
}

export async function prepareAvatar(source: File): Promise<PreparedAvatar> {
  if (!AVATAR_FILE_TYPES.includes(source.type)) {
    throw new Error('Vui lòng chọn ảnh JPEG hoặc PNG.')
  }
  if (source.size > MAX_AVATAR_SOURCE_SIZE) {
    throw new Error('Ảnh gốc không được vượt quá 15 MB.')
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('Không thể đọc ảnh đã chọn. Vui lòng thử một ảnh JPEG hoặc PNG khác.')
  }

  try {
    if (bitmap.width < 1 || bitmap.height < 1) throw new Error('Ảnh đã chọn không hợp lệ.')
    const scale = Math.min(1, MAX_AVATAR_DIMENSION / bitmap.width, MAX_AVATAR_DIMENSION / bitmap.height)
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale))
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale))

    if (scale === 1 && source.size <= MAX_AVATAR_UPLOAD_SIZE) {
      return { file: source, optimized: false }
    }

    if (source.type === 'image/png') {
      const pngCanvas = render(bitmap, targetWidth, targetHeight, false)
      const png = await toBlob(pngCanvas, 'image/png')
      if (png.size <= MAX_AVATAR_UPLOAD_SIZE) {
        return { file: outputFile(source, png, 'png'), optimized: true }
      }
    }

    let width = targetWidth
    let height = targetHeight
    for (let resizeAttempt = 0; resizeAttempt < 5; resizeAttempt += 1) {
      const canvas = render(bitmap, width, height, true)
      for (const quality of [0.88, 0.78, 0.68, 0.58]) {
        const jpeg = await toBlob(canvas, 'image/jpeg', quality)
        if (jpeg.size <= MAX_AVATAR_UPLOAD_SIZE) {
          return { file: outputFile(source, jpeg, 'jpg'), optimized: true }
        }
      }
      width = Math.max(320, Math.round(width * 0.82))
      height = Math.max(320, Math.round(height * 0.82))
    }
    throw new Error('Không thể tối ưu ảnh xuống dưới 2 MB. Vui lòng chọn ảnh khác.')
  } finally {
    bitmap.close()
  }
}

function render(image: ImageBitmap, width: number, height: number, solidBackground: boolean) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { alpha: !solidBackground })
  if (!context) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.')
  if (solidBackground) {
    context.fillStyle = '#f8fafc'
    context.fillRect(0, 0, width, height)
  }
  context.drawImage(image, 0, 0, width, height)
  return canvas
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Không thể xử lý ảnh đã chọn.')), type, quality)
  })
}

function outputFile(source: File, blob: Blob, extension: 'png' | 'jpg') {
  const baseName = source.name.replace(/\.[^.]+$/, '') || 'avatar'
  return new File([blob], `${baseName}.${extension}`, { type: blob.type, lastModified: Date.now() })
}
