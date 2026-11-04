import axios from 'axios'

const TOKEN_KEY = 'jobtrackr_token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

const API_URL = import.meta.env.VITE_API_URL

// Vite bakes env variables in at BUILD time. If this is empty, every request would go to the
// frontend's own domain (and get a 404/405), so fail loudly instead.
if (!API_URL) {
  console.error('VITE_API_URL is not set. Add it in Vercel → Settings → Environment Variables, then redeploy.')
}

const client = axios.create({
  baseURL: API_URL,
  // Render's free tier sleeps when idle and takes up to ~50s to wake up, so be patient
  timeout: 60000,
})

// add "Authorization: Bearer <token>" to every request if we have a token
client.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// AuthContext registers what to do when the session is no longer valid
let onSessionExpired = () => {}
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler
}

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url ?? ''
    // a 401 from login/register just means wrong details, not an expired session
    const isAuthForm = url.includes('/auth/login') || url.includes('/auth/register')
    if (error.response?.status === 401 && !isAuthForm && tokenStore.get()) {
      onSessionExpired()
    }
    return Promise.reject(error)
  },
)

// turns any Axios error into { message, errors } for showing in the UI
export function readError(error) {
  if (axios.isCancel(error)) return { message: '', errors: {}, cancelled: true }
  if (!API_URL) return { message: 'The app is not configured: VITE_API_URL is missing.', errors: {} }
  if (!error.response) {
    return { message: "Can't reach the server. Check that the API is running.", errors: {} }
  }
  const data = error.response.data ?? {}
  return {
    status: error.response.status,
    message: data.message || `Something went wrong (${error.response.status})`,
    errors: data.errors || {},
  }
}

export default client
