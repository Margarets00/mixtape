import './styles/theme.css';
import './styles/global.css';
import { DownloadForm } from './components/DownloadForm';
import { UpdateButton } from './components/UpdateButton';

function App() {
  return (
    <div
      className="app-container"
      style={{
        maxWidth: '700px',
        margin: '0 auto',
        padding: '24px',
        boxShadow: '8px 8px 0px var(--color-pink-dark)',
        border: 'var(--border-style)',
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}
    >
      <header style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '14px',
            color: 'var(--color-pink-dark)',
            margin: '0 0 8px 0',
            lineHeight: '1.6',
          }}
        >
          YouTube Music Downloader
        </h1>
        <p
          className="subtitle"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '22px',
            color: 'var(--color-blue-dark)',
            margin: 0,
          }}
        >
          ~ retro vibes only ~
        </p>
      </header>

      <main
        style={{
          border: 'var(--border-style)',
          padding: '24px',
          background: 'rgba(255, 183, 213, 0.1)',
          boxShadow: 'inset 2px 2px 0px var(--color-pink)',
          marginBottom: '24px',
        }}
      >
        <DownloadForm />
      </main>

      <footer style={{ textAlign: 'center', paddingTop: '16px' }}>
        <UpdateButton />
      </footer>
    </div>
  );
}

export default App;
