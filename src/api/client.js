import axios from 'axios'

const TOKEN_KEY = 'jobtrackr_token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 15000,
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
