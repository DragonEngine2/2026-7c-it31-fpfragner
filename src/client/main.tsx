import { createRoot } from 'react-dom/client'
import { App } from './App'
import './style.css'

// Die App hängt sich an #app. Für die Einbettung in fremde Seiten (Aufgabe 7)
// funktioniert auch jedes Element mit dem Attribut data-kepler-app.
const container = document.getElementById('app') ?? document.querySelector('[data-kepler-app]')
if (container) {
  const root = createRoot(container)
  root.render(<App />)
}
