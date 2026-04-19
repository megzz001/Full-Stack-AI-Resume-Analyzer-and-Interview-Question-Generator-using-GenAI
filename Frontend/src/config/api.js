const DEFAULT_API_BASE_URL = "https://full-stack-ai-resume-analyzer-and-dr8y.onrender.com"

export const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL)
    .trim()
    .replace(/\/+$/, "")
