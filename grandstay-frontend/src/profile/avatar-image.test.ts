import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_AVATAR_SOURCE_SIZE, prepareAvatar } from './avatar-image'

describe('prepareAvatar', () => {
  const close = vi.fn()
  const drawImage = vi.fn()
  const canvases: Array<{ width: number; height: number }> = []

  beforeEach(() => {
    close.mockReset()
    drawImage.mockReset()
    canvases.length = 0
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 4096, height: 2048, close }))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
      fillRect: vi.fn(),
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback, type) {
      canvases.push({ width: this.width, height: this.height })
      callback(new Blob([new Uint8Array(128)], { type: type ?? 'image/jpeg' }))
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('resizes a large image to fit within 2048 pixels', async () => {
    const source = new File([new Uint8Array(1024)], 'large.jpg', { type: 'image/jpeg' })

    const prepared = await prepareAvatar(source)

    expect(prepared.optimized).toBe(true)
    expect(prepared.file.type).toBe('image/jpeg')
    expect(canvases).toContainEqual({ width: 2048, height: 1024 })
    expect(drawImage).toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
  })

  it('keeps an already compliant image unchanged', async () => {
    vi.mocked(createImageBitmap).mockResolvedValue({ width: 800, height: 600, close } as unknown as ImageBitmap)
    const source = new File([new Uint8Array(1024)], 'ready.png', { type: 'image/png' })

    const prepared = await prepareAvatar(source)

    expect(prepared).toEqual({ file: source, optimized: false })
    expect(canvases).toHaveLength(0)
    expect(close).toHaveBeenCalled()
  })

  it('rejects an excessively large source before decoding it', async () => {
    const source = new File([new Uint8Array(MAX_AVATAR_SOURCE_SIZE + 1)], 'huge.jpg', { type: 'image/jpeg' })

    await expect(prepareAvatar(source)).rejects.toThrow('Ảnh gốc không được vượt quá 15 MB.')
    expect(createImageBitmap).not.toHaveBeenCalled()
  })
})
