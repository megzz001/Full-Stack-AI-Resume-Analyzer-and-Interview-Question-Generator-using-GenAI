// Live backend (added to prevent CORS issues when frontend is served from onrender)
const DEFAULT_API_BASE_URL = "https://full-stack-ai-resume-analyzer-and-c1sm.onrender.com"
export const AUTH_TOKEN_STORAGE_KEY = "interviewpro.auth.token"

export const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL)
    .trim()
    .replace(/\/+$/, "")

export const getAuthToken = () => {
    if (typeof window === "undefined") return ""
    return String(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "").trim()
}

export const setAuthToken = (token) => {
    if (typeof window === "undefined") return
    if (token) {
        window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, String(token).trim())
        return
    }

    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
}

export const clearAuthToken = () => setAuthToken("")
