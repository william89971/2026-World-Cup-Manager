import { useMemo, useRef, useState } from 'react'
import { copyCardToClipboard, downloadCard } from '../../utils/shareCard'

/** Preview + download/copy controls for a rendered share card canvas. */
export default function ShareCardPanel({
  render,
  filename,
  title = 'Share',
}: {
  /** Builds the card canvas (called once, memoised). */
  render: () => HTMLCanvasElement
  filename: string
  title?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle')

  const dataUrl = useMemo(() => {
    const cv = render()
    canvasRef.current = cv
    return cv.toDataURL('image/png')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onDownload = () => {
    if (canvasRef.current) void downloadCard(canvasRef.current, filename)
  }
  const onCopy = async () => {
    if (!canvasRef.current) return
    const ok = await copyCardToClipboard(canvasRef.current)
    setCopied(ok ? 'ok' : 'fail')
    setTimeout(() => setCopied('idle'), 2000)
  }

  return (
    <div>
      <div className="text-steel-400 mb-2 text-[11px] font-bold uppercase">{title}</div>
      <img src={dataUrl} alt="Share card preview" className="w-full rounded-lg border border-navy-600" />
      <div className="mt-2 flex gap-2">
        <button className="btn-primary flex-1 text-xs" onClick={onDownload}>
          ⬇ Download PNG
        </button>
        <button className="btn-ghost flex-1 text-xs" onClick={onCopy}>
          {copied === 'ok' ? '✓ Copied!' : copied === 'fail' ? 'Copy unavailable' : '⧉ Copy image'}
        </button>
      </div>
    </div>
  )
}
