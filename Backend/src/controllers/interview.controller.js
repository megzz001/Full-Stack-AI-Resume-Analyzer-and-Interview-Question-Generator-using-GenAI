const path = require("path")
const { pathToFileURL } = require("url")
const { generateInterviewReport, generateResumePdf, evaluateInterviewAnswer } = require("../services/ai.service")
const { generatePreparationPlan } = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")

const pdfjsDistRoot = path.dirname(require.resolve("pdfjs-dist/package.json"))
const standardFontDataPath = path.join(pdfjsDistRoot, "standard_fonts")
const standardFontDataUrl = pathToFileURL(standardFontDataPath).href.replace(/\/?$/, "/")
const pdfjsModuleUrl = pathToFileURL(path.join(pdfjsDistRoot, "legacy/build/pdf.mjs")).href

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

            try {
                const pdfjsLib = await import(pdfjsModuleUrl)
                const pdfDocument = await pdfjsLib.getDocument({
                    data: new Uint8Array(req.file.buffer),
                    standardFontDataUrl,
                }).promise

                let fullText = ""
                for (let i = 1; i <= pdfDocument.numPages; i++) {
                    const page = await pdfDocument.getPage(i)
                    const textContent = await page.getTextContent()
                    const pageText = textContent.items.map(item => item.str).join(" ")
                    fullText += pageText + "\n"
                }
                resumeText = fullText.trim()
            } catch (pdfError) {
                throw new Error(`Failed to parse resume PDF: ${pdfError.message}`)
            }
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

/**
 * @description Controller to evaluate a single interview practice answer.
 */
async function evaluateInterviewAnswerController(req, res) {
    try {
        const { interviewReportId } = req.params
        const { answer, questionType = 'technical', questionIndex = 0 } = req.body

        const interviewReport = await interviewReportModel.findOne({ _id: interviewReportId, user: req.user.id })

        if (!interviewReport) {
            return res.status(404).json({ message: 'Interview report not found.' })
        }

        const questionList = questionType === 'behavioral'
            ? interviewReport.behavioralQuestions
            : interviewReport.technicalQuestions

        const currentQuestion = Array.isArray(questionList) ? questionList[Number(questionIndex) || 0] : null

        if (!currentQuestion) {
            return res.status(400).json({ message: 'Practice question not found.' })
        }

        const evaluation = await evaluateInterviewAnswer({
            reportTitle: interviewReport.title,
            questionType,
            question: currentQuestion.question,
            intention: currentQuestion.intention,
            modelAnswer: currentQuestion.answer,
            candidateAnswer: String(answer || '').trim(),
            skillGaps: interviewReport.skillGaps,
        })

        return res.status(200).json({
            message: 'Practice answer evaluated successfully.',
            evaluation,
        })
    } catch (error) {
        return res.status(500).json({
            message: 'Failed to evaluate practice answer.',
            error: error.message,
        })
    }
}

/**
 * @description Controller to generate or refresh the preparation plan for an existing report using AI
 */
async function generatePreparationPlanController(req, res) {
    try {
        const { interviewReportId } = req.params

        const interviewReport = await interviewReportModel.findOne({ _id: interviewReportId, user: req.user.id })

        if (!interviewReport) {
            return res.status(404).json({ message: 'Interview report not found.' })
        }

        const plan = await generatePreparationPlan({ interviewReport })

        interviewReport.preparationPlan = plan
        await interviewReport.save()

        return res.status(200).json({ message: 'Preparation plan generated successfully.', preparationPlan: plan })
    } catch (error) {
        return res.status(500).json({ message: 'Failed to generate preparation plan.', error: error.message })
    }
}

/**
 * @description Controller to update preparation plan progress (toggle completed)
 */
async function updatePreparationProgressController(req, res) {
    try {
        const { interviewReportId } = req.params
        const { dayIndex, completed } = req.body

        if (typeof dayIndex !== 'number') {
            return res.status(400).json({ message: 'dayIndex (number) is required in body.' })
        }

        const interviewReport = await interviewReportModel.findOne({ _id: interviewReportId, user: req.user.id })

        if (!interviewReport) {
            return res.status(404).json({ message: 'Interview report not found.' })
        }

        if (!Array.isArray(interviewReport.preparationPlan) || dayIndex < 0 || dayIndex >= interviewReport.preparationPlan.length) {
            return res.status(400).json({ message: 'Invalid dayIndex.' })
        }

        interviewReport.preparationPlan[dayIndex].completed = Boolean(completed)
        await interviewReport.save()

        return res.status(200).json({ message: 'Progress updated.', preparationPlan: interviewReport.preparationPlan })
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update progress.', error: error.message })
    }
}

module.exports = { generateInterviewReportController, getInterviewReportByIdController, getAllInterviewReportsController, deleteInterviewReportController, generateResumePdfController, evaluateInterviewAnswerController, generatePreparationPlanController, updatePreparationProgressController }