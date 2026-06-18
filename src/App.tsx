import { DemoProvider } from './context/DemoContext'
import { KpEditorPage } from './pages/KpEditorPage'

function App() {
  return (
    <DemoProvider>
      <KpEditorPage />
    </DemoProvider>
  )
}

export default App
