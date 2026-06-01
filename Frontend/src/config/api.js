// Live backend (added to prevent CORS issues when frontend is served from onrender)
const DEFAULT_API_BASE_URL = "https://full-stack-ai-resume-analyzer-and-c1sm.onrender.com"

export const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL)
    .trim()
    .replace(/\/+$/, "")
