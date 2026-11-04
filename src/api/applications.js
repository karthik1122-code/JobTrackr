import client from './client'

// params: { page, limit, status, search }
export async function fetchApplications(params, signal) {
  const { data } = await client.get('/applications', { params, signal })
  return data // { data, page, limit, total, totalPages }
}

export async function fetchStats(signal) {
  const { data } = await client.get('/applications/stats', { signal })
  return data.data // { total, byStatus, averageOfferSalary }
}

export async function createApplication(app) {
  const { data } = await client.post('/applications', app)
  return data.data
}

export async function updateApplication(id, changes) {
  const { data } = await client.patch(`/applications/${id}`, changes)
  return data.data
}

export async function deleteApplication(id) {
  await client.delete(`/applications/${id}`)
}
