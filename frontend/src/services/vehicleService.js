
const API_URL = 'http://localhost:8000/api/v1'

export async function getVehicles({
  page = 1,
  pageSize = 10,
  search = '',
  status = '',
} = {}) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })

  if (search.trim()) {
    params.set('search', search.trim())
  }

  if (status) {
    params.set('status', status)
  }

  const response = await fetch(
    `${API_URL}/vehicles?${params.toString()}`
  )

  if (!response.ok) {
    throw new Error(`Error al consultar vehículos: ${response.status}`)
  }

  return response.json()
}

export async function getAllVehicles() {
  const data = await getVehicles({
    page: 1,
    pageSize: 100,
  })

  return data.items
}
