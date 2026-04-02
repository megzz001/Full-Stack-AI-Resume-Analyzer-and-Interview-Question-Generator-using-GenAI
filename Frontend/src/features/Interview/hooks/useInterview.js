import { getAllInterviewReports, generateInterviewReport, getInterviewReportById, generateResumePdf, deleteInterviewReport } from "../services/interview.api.js"
import { useContext, useEffect } from "react"
import { InterviewContext } from "../Interview.context.jsx"
import { useParams } from "react-router"


export const useInterview = () => {

    const context = useContext(InterviewContext)
    const { interviewId } = useParams()

    if (!context) {
        throw new Error("useInterview must be used within an InterviewProvider")
    }

    const { loading, setLoading, report, setReport, reports, setReports } = context

    const generateReport = async ({ jobDescription, selfDescription, resumeFile }) => {
        setLoading(true)
        let response = null
        try {
            response = await generateInterviewReport({ jobDescription, selfDescription, resumeFile })
            setReport(response.interviewReport)
            return response?.interviewReport || null
        } catch (error) {
            console.log(error)
            const message = error?.response?.data?.error || error?.response?.data?.message || "Failed to generate report"
            throw new Error(message)
        } finally {
            setLoading(false)
        }
    }

    const getReportById = async (interviewId) => {
        setLoading(true)
        let response = null
        try {
            response = await getInterviewReportById(interviewId)
            setReport(response.interviewReport)
            return response?.interviewReport || null
        } catch (error) {
            console.log(error)
            const message = error?.response?.data?.message || "Failed to load report"
            throw new Error(message)
        } finally {
            setLoading(false)
        }
    }

    const getReports = async () => {
        setLoading(true)
        let response = null
        try {
            response = await getAllInterviewReports()
            setReports(response.interviewReports)
            return response?.interviewReports || []
        } catch (error) {
            console.log(error)
            const message = error?.response?.data?.message || "Failed to load reports"
            throw new Error(message)
        } finally {
            setLoading(false)
        }
    }

    const getResumePdf = async (interviewReportId) => {
        setLoading(true)
        let response = null
        try {
            response = await generateResumePdf({ interviewReportId })
            const url = window.URL.createObjectURL(new Blob([response], { type: "application/pdf" }))
            const link = document.createElement("a")
            link.href = url
            link.setAttribute("download", `resume_${interviewReportId}.pdf`)
            document.body.appendChild(link)
            link.click()
        }
        catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
    }

    const deleteReport = async (interviewReportId) => {
        setLoading(true)
        try {
            await deleteInterviewReport(interviewReportId)
            setReports((prev) => prev.filter((item) => item._id !== interviewReportId))
            setReport(null)
            return true
        } catch (error) {
            console.log(error)
            const message = error?.response?.data?.message || "Failed to delete report"
            throw new Error(message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (interviewId) {
            getReportById(interviewId)
        } else {
            getReports()
        }
    }, [interviewId])

    return { loading, report, reports, generateReport, getReportById, getReports, getResumePdf, deleteReport }

}