import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import BoardPage from './pages/BoardPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import NotFound from './pages/NotFound'

// login/register pages: if already logged in, go to the page they originally wanted
function GuestOnly({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (user) return <Navigate to={location.state?.from || '/'} replace />
  return children
}

function App() {
  const { checking } = useAuth()

  // don't show any page until we know if the saved token is still good
  if (checking) {
    return <div className="splash">Loading JobTrackr…</div>
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <BoardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />
      <Route
        path="/register"
        element={
          <GuestOnly>
            <RegisterPage />
          </GuestOnly>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
