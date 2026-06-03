import axios from "axios";
import { API_BASE_URL, getAuthToken } from "../../../config/api.js";

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
})

api.interceptors.request.use((config) => {
    const token = getAuthToken()
    if (token) {
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${token}`
        config.headers['X-Auth-Token'] = token
    }

    return config
})


/**
 * @description Service to generate interview report based on user self description, resume and job description.
 */
export const generateInterviewReport = async ({ jobDescription, selfDescription, resumeFile }) => {

    const formData = new FormData()
    formData.append("jobDescription", jobDescription)
    formData.append("selfDescription", selfDescription)
    formData.append("resume", resumeFile)

    const response = await api.post("/api/interview/", formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        }
    })

    return response.data

}


/**
 * @description Service to get interview report by interviewId.
 */
export const getInterviewReportById = async (interviewId) => {
    const response = await api.get(`/api/interview/report/${interviewId}`)

    return response.data
}


/**
 * @description Service to get all interview reports of logged in user.
 */
export const getAllInterviewReports = async () => {
    const response = await api.get("/api/interview/")

    return response.data
}

/**
 * @description Service to delete interview report by interviewId.
 */
export const deleteInterviewReport = async (interviewId) => {
    const response = await api.delete(`/api/interview/${interviewId}`)
    return response.data
}


/**
 * @description Service to generate resume pdf based on user self description, resume content and job description.
 */
export const generateResumePdf = async ({ interviewReportId }) => {
    const response = await api.post(`/api/interview/resume/pdf/${interviewReportId}`, null, {
        responseType: "blob"
    })

    return response.data
}

/**
 * @description Evaluate a practice interview answer against a stored report question.
 */
export const evaluatePracticeAnswer = async ({ interviewReportId, questionType, questionIndex, answer }) => {
    const response = await api.post(`/api/interview/practice/${interviewReportId}`, {
        questionType,
        questionIndex,
        answer,
    })

    return response.data
}

/**
 * @description Generate or refresh preparation plan for an existing interview report
 */
export const generatePreparationPlan = async ({ interviewReportId }) => {
    const response = await api.post(`/api/interview/plan/${interviewReportId}`)
    return response.data
}

/**
 * @description Update preparation plan progress for an interview report
 */
export const updatePreparationProgress = async ({ interviewReportId, dayIndex, completed }) => {
    const response = await api.patch(`/api/interview/plan/${interviewReportId}/progress`, { dayIndex, completed })
    return response.data
}