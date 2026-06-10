import { useGame } from './store/gameStore'
import MainMenu from './ui/screens/MainMenu'
import Hub from './ui/screens/Hub'
import Squad from './ui/screens/Squad'
import Tactics from './ui/screens/Tactics'
import Groups from './ui/screens/Groups'
import Bracket from './ui/screens/Bracket'
import PreMatch from './ui/screens/PreMatch'
import Match from './ui/screens/Match'
import PostMatch from './ui/screens/PostMatch'
import Stats from './ui/screens/Stats'

export default function App() {
  const screen = useGame((s) => s.screen)
  const started = useGame((s) => s.started)

  const view = (() => {
    if (!started || screen === 'menu') return <MainMenu />
    switch (screen) {
      case 'hub':
        return <Hub />
      case 'squad':
        return <Squad />
      case 'tactics':
        return <Tactics />
      case 'groups':
        return <Groups />
      case 'bracket':
        return <Bracket />
      case 'stats':
        return <Stats />
      case 'prematch':
        return <PreMatch />
      case 'match':
        return <Match />
      case 'postmatch':
        return <PostMatch />
      default:
        return <Hub />
    }
  })()

  // keyed wrapper re-mounts per screen so every transition gets a fade/slide
  return (
    <div key={started ? screen : 'menu'} className="screen-enter h-full">
      {view}
    </div>
  )
}
