import client from './client'

export async function registerUser({ name, email, password }) {
  const { data } = await client.post('/auth/register', { name, email, password })
  return data // { token, user }
}

export async function loginUser({ email, password }) {
  const { data } = await client.post('/auth/login', { email, password })
  return data
}

export async function fetchMe() {
  const { data } = await client.get('/auth/me')
  return data.user
}
