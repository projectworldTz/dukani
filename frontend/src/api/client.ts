import axios from 'axios'
import { useAuthStore } from '../stores/authStore'
import { useSubscriptionStore } from '../stores/subscriptionStore'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1',
  headers: { Accept: 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clear()
    }
    // Trial over / subscription lapsed: show the "trial ended" screen with how to pay.
    if (error.response?.status === 402 && error.response.data?.code === 'subscription_expired') {
      useSubscriptionStore.getState().setEnded({
        message: error.response.data.message,
        subscription: error.response.data.subscription ?? null,
      })
    }
    return Promise.reject(error)
  },
)
