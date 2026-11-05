const API_URL = 'http://localhost:8000/api/v1'

export async function getVehicles() {
  const response = await fetch(`${API_URL}/vehicles`)

  if (!response.ok) {
    throw new Error(`Error al consultar vehículos: ${response.status}`)
  }

  return response.json()
}