const pdfParse = require("pdf-parse")
const { generateInterviewReport, generateResumePdf } = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")

/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 */
async function generateInterviewReportController(req, res) {
    try {
        const { selfDescription, jobDescription } = req.body

        if (!jobDescription || !String(jobDescription).trim()) {
            return res.status(400).json({ message: "Job description is required." })
        }

        if (!req.file && (!selfDescription || !String(selfDescription).trim())) {
            return res.status(400).json({ message: "Provide either a resume PDF or a self description." })
        }

        let resumeText = ""

        if (req.file?.buffer) {
            const mimeType = String(req.file.mimetype || "").toLowerCase()
            const originalName = String(req.file.originalname || "").toLowerCase()
            const isPdf = mimeType === "application/pdf" || originalName.endsWith(".pdf")

            if (!isPdf) {
                return res.status(400).json({ message: "Only PDF resume is supported right now. Please upload a .pdf file." })
            }

            const resumeContent = await (new pdfParse.PDFParse(Uint8Array.from(req.file.buffer))).getText()
            resumeText = String(resumeContent?.text || "").trim()
        }

        const interViewReportByAi = await generateInterviewReport({
            resume: resumeText,
            selfDescription,
            jobDescription
        })

        const interviewReport = await interviewReportModel.create({
            user: req.user.id,
            resume: resumeText,
            selfDescription,
            jobDescription,
            ...interViewReportByAi
        })

        return res.status(201).json({
            message: "Interview report generated successfully.",
            interviewReport
        })
    } catch (error) {
        const message = String(error.message || "Failed to generate interview report.")
        const isQuotaError = message.toLowerCase().includes("quota exceeded")

        if (isQuotaError) {
            return res.status(429).json({
                message: "AI quota exceeded. Please retry later.",
                error: message
            })
        }

        return res.status(500).json({
            message: "Failed to generate interview report.",
            error: message
        })
    }

}

/**
 * @description Controller to get interview report by interviewId.
 */
async function getInterviewReportByIdController(req, res) {
    try {
        const { interviewId } = req.params

        const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found."
            })
        }

        return res.status(200).json({
            message: "Interview report fetched successfully.",
            interviewReport
        })
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch interview report.",
            error: error.message
        })
    }
}

/** 
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res) {
    try {
        const interviewReports = await interviewReportModel.find({ user: req.user.id }).sort({ createdAt: -1 }).select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan")

        return res.status(200).json({
            message: "Interview reports fetched successfully.",
            interviewReports
        })
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch interview reports.",
            error: error.message
        })
    }
}

/**
 * @description Controller to delete interview report by interviewId.
 */
async function deleteInterviewReportController(req, res) {
    try {
        const { interviewId } = req.params

        const deleted = await interviewReportModel.findOneAndDelete({ _id: interviewId, user: req.user.id })

        if (!deleted) {
            return res.status(404).json({ message: "Interview report not found." })
        }

        return res.status(200).json({ message: "Interview report deleted successfully." })
    } catch (error) {
        return res.status(500).json({
            message: "Failed to delete interview report.",
            error: error.message
        })
    }
}


/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
async function generateResumePdfController(req, res) {
    const { interviewReportId } = req.params

    const interviewReport = await interviewReportModel.findById(interviewReportId)

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    const { resume, jobDescription, selfDescription } = interviewReport

    const pdfBuffer = await generateResumePdf({ resume, jobDescription, selfDescription })

    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
    })

    res.send(pdfBuffer)
}

module.exports = { generateInterviewReportController, getInterviewReportByIdController, getAllInterviewReportsController, deleteInterviewReportController, generateResumePdfController }