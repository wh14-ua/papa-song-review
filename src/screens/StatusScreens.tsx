import { CassetteMark } from '../components/CassetteMark'
import { Link } from '../components/Link'

export function LoadingScreen() {
  return (
    <div className="screen screen--status">
      <output className="status-screen">
        <CassetteMark className="status-screen__mark" />
        <p className="status-screen__title">爸爸的歌单</p>
        <p>
          <span className="spinner spinner--ink" aria-hidden="true" /> 正在打开歌单…
        </p>
      </output>
    </div>
  )
}

export function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="screen screen--status">
      <div className="status-screen" role="alert">
        <p className="status-screen__title">歌单没有打开</p>
        <p>请检查网络，然后再试一次。</p>
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          再试一次
        </button>
        <p className="muted" lang="es">
          No se pudo cargar songs.json: {message}
        </p>
      </div>
    </div>
  )
}

export function NotFoundScreen() {
  return (
    <div className="screen screen--status">
      <div className="status-screen">
        <p className="status-screen__title">找不到这一页</p>
        <Link to={{ name: 'home' }} className="btn btn--primary">
          回到首页
        </Link>
      </div>
    </div>
  )
}
