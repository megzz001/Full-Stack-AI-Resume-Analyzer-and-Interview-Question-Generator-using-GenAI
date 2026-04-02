const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")
// const puppeteer = require("puppeteer")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})

function getCandidateModels() {
    // Keep fallbacks conservative to reduce 404 model-not-found failures.
    const models = [
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        process.env.GEMINI_MODEL,
    ].filter(Boolean)

    // Keep order while removing duplicates.
    return [...new Set(models)]
}

function formatGeminiError(error) {
    const raw = String(error?.message || "Unknown error")

    if (raw.includes("RESOURCE_EXHAUSTED") || raw.toLowerCase().includes("quota exceeded")) {
        const retry = raw.match(/retryDelay"\s*:\s*"([^"]+)"/i)?.[1]
        if (retry) {
            return `Gemini API quota exceeded. Please retry after ${retry} or check billing/quota limits.`
        }
        return "Gemini API quota exceeded. Please retry later or check billing/quota limits."
    }

    if (raw.includes("NOT_FOUND") || raw.toLowerCase().includes("not found")) {
        return "No available Gemini model was found for this API key/project. Set GEMINI_MODEL to an enabled model."
    }

    return raw
}

function ensureArray(value) {
    if (Array.isArray(value)) return value
    if (value == null) return []
    return [value]
}

function parseObjectLikeString(value) {
    const raw = String(value || "").trim()
    if (!raw.startsWith("{") || !raw.endsWith("}")) return null

    try {
        return JSON.parse(raw)
    } catch {
        // Try a light conversion for model outputs that use single quotes.
        try {
            const normalized = raw
                .replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":')
                .replace(/:\s*'([^']*)'/g, ': "$1"')
            return JSON.parse(normalized)
        } catch {
            return null
        }
    }
}

function extractQAFromLooseString(value) {
    const raw = String(value || "").trim()
    if (!raw) return null

    const q = raw.match(/question"?\s*:\s*"([\s\S]*?)"\s*,\s*"?intention"?\s*:/i)
    const i = raw.match(/intention"?\s*:\s*"([\s\S]*?)"\s*,\s*"?answer"?\s*:/i)
    const a = raw.match(/answer"?\s*:\s*"([\s\S]*?)"\s*}?$/i)

    if (!q || !i || !a) return null

    return {
        question: q[1],
        intention: i[1],
        answer: a[1],
    }
}

function extractSkillGapFromLooseString(value) {
    const raw = String(value || "").trim()
    if (!raw) return null

    const skillMatch = raw.match(/skill"?\s*:\s*"([\s\S]*?)"\s*(,|})/i)
    const severityMatch = raw.match(/severity"?\s*:\s*"?(low|medium|high)"?/i)
    if (!skillMatch) return null

    return {
        skill: skillMatch[1],
        severity: severityMatch ? severityMatch[1].toLowerCase() : "medium",
    }
}

function cleanSentence(value, fallback) {
    const text = String(value || "").replace(/\s+/g, " ").trim()
    const lower = text.toLowerCase()
    const looksLikeTemplate =
        /^<[^>]+>$/.test(text) ||
        lower.includes("json_here") ||
        lower.includes("placeholder") ||
        lower.includes("insert_")

    if (looksLikeTemplate) return fallback
    return text || fallback
}

function isTemplateArtifact(value) {
    const text = String(value || "").trim().toLowerCase()
    if (!text) return true
    return /^<[^>]+>$/.test(text) || text.includes("json_here") || text.includes("placeholder")
}

function isInvalidQuestionText(value) {
    const text = String(value || "").trim()
    if (!text) return true
    if (/^-?\d+$/.test(text)) return true
    if (text.length < 8) return true
    return false
}

function enforceQuestionShape(item, type) {
    const defaultIntention = type === "technical"
        ? "Evaluate technical depth, performance trade-offs, and production readiness."
        : "Evaluate communication, ownership, and structured decision-making."

    const defaultAnswer = type === "technical"
        ? "Explain the problem context, your technical approach, key trade-offs, and validation strategy. Close with measurable outcomes such as latency, reliability, throughput, or delivery impact."
        : "Use STAR format: Situation, Task, Action, and Result. Keep the answer specific, include your direct contributions, and end with measurable impact."

    return {
        question: cleanSentence(item?.question || item?.q, ""),
        intention: cleanSentence(item?.intention || item?.why, defaultIntention),
        answer: cleanSentence(item?.answer || item?.sampleAnswer, defaultAnswer),
    }
}

function normalizeQuestionList(value, type) {
    return ensureArray(value)
        .map((rawItem) => {
            let item = rawItem

            if (typeof item === "string") {
                const parsed = parseObjectLikeString(item)
                if (parsed && typeof parsed === "object") {
                    item = parsed
                } else {
                    const extracted = extractQAFromLooseString(item)
                    if (extracted) item = extracted
                }
            }

            if (typeof item === "string") {
                const questionText = item.trim()
                if (!questionText || isInvalidQuestionText(questionText)) return null
                return enforceQuestionShape({
                    question: questionText,
                    intention: type === "technical" ? "Evaluate technical depth and practical understanding." : "Evaluate communication, ownership, and teamwork.",
                    answer: type === "technical"
                        ? "Start with a short context and state the technical challenge clearly. Explain your approach step by step, including key design decisions, trade-offs, and why you chose specific tools or patterns. Describe how you validated the solution using testing, monitoring, or benchmarks. End with measurable outcomes such as latency reduction, improved throughput, lower error rates, or delivery impact."
                        : "Use a STAR structure with detail. In Situation and Task, describe the business context and your responsibility. In Action, explain the communication and collaboration steps you took, conflicts you resolved, and how you aligned stakeholders. In Result, share measurable impact such as delivery speed, quality improvements, customer outcomes, or team effectiveness."
                }, type)
            }

            if (item && typeof item === "object") {
                let question = String(item.question || item.q || "").trim()
                let intention = item.intention || item.why || "Understand reasoning and decision-making."
                let answer = item.answer || item.sampleAnswer || "Provide a detailed, structured STAR-style answer with concrete technical actions, clear trade-offs, and measurable outcomes."

                const extractedFromQuestion = extractQAFromLooseString(question)
                if (extractedFromQuestion) {
                    question = extractedFromQuestion.question
                    intention = extractedFromQuestion.intention || intention
                    answer = extractedFromQuestion.answer || answer
                }

                if (isInvalidQuestionText(question)) return null

                if (!question) return null
                return enforceQuestionShape({
                    question,
                    intention,
                    answer
                }, type)
            }

            return null
        })
        .filter(Boolean)
}

function normalizeSkillGaps(value) {
    return ensureArray(value)
        .map((rawItem) => {
            let item = rawItem

            if (typeof item === "string") {
                const parsed = parseObjectLikeString(item)
                if (parsed && typeof parsed === "object") {
                    item = parsed
                } else {
                    const extracted = extractSkillGapFromLooseString(item)
                    if (extracted) item = extracted
                }
            }

            if (typeof item === "string") {
                const skill = cleanSentence(item, "")
                if (!skill) return null
                return { skill, severity: "medium" }
            }

            if (item && typeof item === "object") {
                const skill = cleanSentence(item.skill || item.name, "")
                if (!skill || /^-?\d+$/.test(skill)) return null
                const severityRaw = String(item.severity || "medium").toLowerCase()
                const severity = ["low", "medium", "high"].includes(severityRaw) ? severityRaw : "medium"
                return { skill, severity }
            }

            return null
        })
        .filter(Boolean)
}

function normalizePreparationPlan(value) {
    return ensureArray(value)
        .map((item, index) => {
            if (typeof item === "string") {
                const focus = item.trim()
                if (!focus) return null
                return {
                    day: index + 1,
                    focus,
                    tasks: ["Review core concepts", "Practice one relevant problem", "Prepare a concise explanation"]
                }
            }

            if (item && typeof item === "object") {
                const day = Number(item.day) || index + 1
                const focus = String(item.focus || item.topic || `Day ${day} preparation`).trim()
                const tasks = ensureArray(item.tasks)
                    .map((task) => String(task).trim())
                    .filter(Boolean)

                return {
                    day,
                    focus,
                    tasks: tasks.length ? tasks : ["Study the topic", "Practice interview questions", "Revise key takeaways"]
                }
            }

            return null
        })
        .filter(Boolean)
}

function normalizeInterviewReport(raw) {
    const safe = raw && typeof raw === "object" ? raw : {}

    return {
        matchScore: Number.isFinite(Number(safe.matchScore)) ? Number(safe.matchScore) : 0,
        title: String(safe.title || "Interview Preparation Report").trim(),
        technicalQuestions: normalizeQuestionList(safe.technicalQuestions, "technical"),
        behavioralQuestions: normalizeQuestionList(safe.behavioralQuestions, "behavioral"),
        skillGaps: normalizeSkillGaps(safe.skillGaps),
        preparationPlan: normalizePreparationPlan(safe.preparationPlan),
    }
}

function dedupeQuestions(items, type) {
    const normalized = ensureArray(items)
        .map((entry) => enforceQuestionShape(entry, type))
        .filter((entry) => entry.question && !isInvalidQuestionText(entry.question) && !isTemplateArtifact(entry.question))
    const unique = []
    const seen = new Set()
    for (const entry of normalized) {
        const key = entry.question.toLowerCase()
        if (!seen.has(key)) {
            seen.add(key)
            unique.push(entry)
        }
    }
    return unique
}

function ensureConsistentReportFormat(report) {
    const TECHNICAL_MIN_COUNT = 10
    const BEHAVIORAL_COUNT = 3

    report.technicalQuestions = dedupeQuestions(report.technicalQuestions, "technical")
    report.behavioralQuestions = dedupeQuestions(report.behavioralQuestions, "behavioral").slice(0, BEHAVIORAL_COUNT)

    if (!Array.isArray(report.skillGaps)) report.skillGaps = []
    if (!Array.isArray(report.preparationPlan)) report.preparationPlan = []

    report.skillGaps = ensureArray(report.skillGaps).filter((gap) => !isTemplateArtifact(gap?.skill))

    return {
        ...report,
        technicalMinCount: TECHNICAL_MIN_COUNT,
        behavioralCount: BEHAVIORAL_COUNT,
    }
}

async function generateMissingQuestionsFromAI({ resume, selfDescription, jobDescription, existingTechnicalQuestions, existingBehavioralQuestions, neededTechnicalCount, neededBehavioralCount }) {
    const missingSchema = z.object({
        technicalQuestions: z.array(z.object({
            question: z.string(),
            intention: z.string(),
            answer: z.string(),
        })),
        behavioralQuestions: z.array(z.object({
            question: z.string(),
            intention: z.string(),
            answer: z.string(),
        })),
    })

    const prompt = `
You are an AI interview coach.

Generate ONLY missing interview questions based on the candidate profile and job description.

Return strict JSON with this format only:
{
  "technicalQuestions": [{"question": string, "intention": string, "answer": string}],
  "behavioralQuestions": [{"question": string, "intention": string, "answer": string}]
}

Rules:
- Return ONLY JSON
- Do not repeat existing questions
- Generate up to ${neededTechnicalCount} technical questions and up to ${neededBehavioralCount} behavioral questions
- If needed count is 0 for a section, return an empty array for that section
- Keep this exact object shape for each question: { "question", "intention", "answer" }
- intention must be one concise sentence
- answer must be one detailed paragraph with clear practical guidance

Existing Technical Questions (do not repeat):
${JSON.stringify(existingTechnicalQuestions || [])}

Existing Behavioral Questions (do not repeat):
${JSON.stringify(existingBehavioralQuestions || [])}

Candidate Resume:
${resume}

Self Description:
${selfDescription}

Job Description:
${jobDescription}
`

    const candidateModels = getCandidateModels()

    for (const modelName of candidateModels) {
        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: zodToJsonSchema(missingSchema),
                }
            })

            const parsed = JSON.parse(response.text)
            return missingSchema.parse(parsed)
        } catch {
            // try next model
        }
    }

    return { technicalQuestions: [], behavioralQuestions: [] }
}

async function fillQuestionsIteratively({
    resume,
    selfDescription,
    jobDescription,
    technicalQuestions,
    behavioralQuestions,
    technicalTarget,
    behavioralTarget,
}) {
    let tech = dedupeQuestions(technicalQuestions, "technical")
    let beh = dedupeQuestions(behavioralQuestions, "behavioral")

    // Smaller batch requests are more reliable than one large strict request.
    for (let attempt = 0; attempt < 4; attempt++) {
        const missingTechnical = Math.max(0, technicalTarget - tech.length)
        const missingBehavioral = Math.max(0, behavioralTarget - beh.length)

        if (missingTechnical === 0 && missingBehavioral === 0) break

        const generatedMissing = await generateMissingQuestionsFromAI({
            resume,
            selfDescription,
            jobDescription,
            existingTechnicalQuestions: tech.map((q) => q.question),
            existingBehavioralQuestions: beh.map((q) => q.question),
            neededTechnicalCount: Math.min(3, missingTechnical),
            neededBehavioralCount: Math.min(2, missingBehavioral),
        })

        const addedTech = normalizeQuestionList(generatedMissing.technicalQuestions, "technical")
        const addedBeh = normalizeQuestionList(generatedMissing.behavioralQuestions, "behavioral")

        const nextTech = dedupeQuestions([...tech, ...addedTech], "technical")
        const nextBeh = dedupeQuestions([...beh, ...addedBeh], "behavioral")

        const noProgress = nextTech.length === tech.length && nextBeh.length === beh.length
        tech = nextTech
        beh = nextBeh

        if (noProgress) break
    }

    return {
        technicalQuestions: tech,
        behavioralQuestions: beh,
    }
}


const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's profile matches the job describe"),
    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("A detailed model answer strategy with practical steps, technical depth, trade-offs, and measurable impact. It should be interview-ready and not generic.")
    })).describe("Technical questions that can be asked in the interview along with their intention and how to answer them"),
    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("A detailed model answer strategy using STAR with specific actions, ownership, collaboration, and measurable outcomes.")
    })).describe("Behavioral questions that can be asked in the interview along with their intention and how to answer them"),
    skillGaps: z.array(z.object({
        skill: z.string().describe("The skill which the candidate is lacking"),
        severity: z.enum(["low", "medium", "high"]).describe("The severity of this skill gap, i.e. how important is this skill for the job and how much it can impact the candidate's chances")
    })).describe("List of skill gaps in the candidate's profile along with their severity"),
    preparationPlan: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, starting from 1"),
        focus: z.string().describe("The main focus of this day in the preparation plan, e.g. data structures, system design, mock interviews etc."),
        tasks: z.array(z.string()).describe("List of tasks to be done on this day to follow the preparation plan, e.g. read a specific book or article, solve a set of problems, watch a video etc.")
    })).describe("A day-wise preparation plan for the candidate to follow in order to prepare for the interview effectively"),
    title: z.string().describe("The title of the job for which the interview report is generated"),
})

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {


    const prompt = `
You are an AI interview coach.

Generate a structured interview report strictly in this JSON format:

{
  "matchScore": number,
  "title": string,
  "technicalQuestions": [
    {
      "question": string,
      "intention": string,
      "answer": string
    }
  ],
  "behavioralQuestions": [
    {
      "question": string,
      "intention": string,
      "answer": string
    }
  ],
  "skillGaps": [
    {
      "skill": string,
      "severity": "low" | "medium" | "high"
    }
  ],
  "preparationPlan": [
    {
      "day": number,
      "focus": string,
      "tasks": [string]
    }
  ]
}

Rules:
- Return ONLY JSON
- Do NOT add extra fields
- Do NOT write explanations
- Do NOT write markdown
- For each technicalQuestions[].answer and behavioralQuestions[].answer, write a detailed response guidance, not a one-liner
- Each answer must be at least 80 words and include: context, actions, reasoning/trade-offs, and measurable outcomes
- For behavioral answers, prefer STAR structure explicitly
- For technical answers, include architecture or implementation depth (e.g., scaling, data model, caching, testing, monitoring)
- Keep identical object structure for every question: { "question": string, "intention": string, "answer": string }
- Generate at least 10 technical questions and exactly 3 behavioral questions
- Intention must be one concise sentence, and answer must be one detailed paragraph

Candidate Resume:
${resume}

Self Description:
${selfDescription}

Job Description:
${jobDescription}
`;

    const candidateModels = getCandidateModels()

    let lastError = null
    const triedModels = []

    for (const modelName of candidateModels) {
        try {
            triedModels.push(modelName)
            const response = await ai.models.generateContent({
                model: modelName,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: zodToJsonSchema(interviewReportSchema),
                }
            })

            const parsed = JSON.parse(response.text)
            const normalized = normalizeInterviewReport(parsed)
            const formatted = ensureConsistentReportFormat(normalized)

            const hasTemplateData =
                formatted.technicalQuestions.some((q) => isTemplateArtifact(q.question) || isTemplateArtifact(q.intention) || isTemplateArtifact(q.answer)) ||
                formatted.behavioralQuestions.some((q) => isTemplateArtifact(q.question) || isTemplateArtifact(q.intention) || isTemplateArtifact(q.answer)) ||
                formatted.skillGaps.some((g) => isTemplateArtifact(g.skill))

            if (hasTemplateData) {
                throw new Error("AI returned template placeholders instead of real content.")
            }

            const filled = await fillQuestionsIteratively({
                resume,
                selfDescription,
                jobDescription,
                technicalQuestions: formatted.technicalQuestions,
                behavioralQuestions: formatted.behavioralQuestions,
                technicalTarget: formatted.technicalMinCount,
                behavioralTarget: formatted.behavioralCount,
            })

            let technicalQuestions = filled.technicalQuestions
            let behavioralQuestions = filled.behavioralQuestions

            // Do not fail the full report generation if counts are still short.
            if (technicalQuestions.length === 0 || behavioralQuestions.length === 0) {
                throw new Error("AI could not generate interview questions for this input.")
            }

            return interviewReportSchema.parse({
                ...formatted,
                technicalQuestions,
                behavioralQuestions: behavioralQuestions.slice(0, formatted.behavioralCount),
            })
        } catch (error) {
            lastError = error
        }
    }

    const lastMessage = formatGeminiError(lastError)
    const modelHint = `Tried models: ${triedModels.join(", ")}.`

    if (lastMessage.toLowerCase().includes("model") && lastMessage.toLowerCase().includes("not")) {
        throw new Error(`No available Gemini model was found for this API key/project. ${modelHint} Set GEMINI_MODEL to a model enabled in your account (for example: gemini-2.5-flash).`)
    }

    if (lastMessage.toLowerCase().includes("quota exceeded")) {
        throw new Error(`${lastMessage} ${modelHint}`)
    }

    throw new Error(`Gemini content generation failed. ${modelHint} Last error: ${lastMessage}`)


}



// async function generatePdfFromHtml(htmlContent) {
//     const browser = await puppeteer.launch()
//     const page = await browser.newPage();
//     await page.setContent(htmlContent, { waitUntil: "networkidle0" })

//     const pdfBuffer = await page.pdf({
//         format: "A4", margin: {
//             top: "20mm",
//             bottom: "20mm",
//             left: "15mm",
//             right: "15mm"
//         }
//     })

//     await browser.close()

//     return pdfBuffer
// }

// async function generateResumePdf({ resume, selfDescription, jobDescription }) {

//     const resumePdfSchema = z.object({
//         html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")
//     })

//     const prompt = `Generate resume for a candidate with the following details:
//                         Resume: ${resume}
//                         Self Description: ${selfDescription}
//                         Job Description: ${jobDescription}

//                         the response should be a JSON object with a single field "html" which contains the HTML content of the resume which can be converted to PDF using any library like puppeteer.
//                         The resume should be tailored for the given job description and should highlight the candidate's strengths and relevant experience. The HTML content should be well-formatted and structured, making it easy to read and visually appealing.
//                         The content of resume should be not sound like it's generated by AI and should be as close as possible to a real human-written resume.
//                         you can highlight the content using some colors or different font styles but the overall design should be simple and professional.
//                         The content should be ATS friendly, i.e. it should be easily parsable by ATS systems without losing important information.
//                         The resume should not be so lengthy, it should ideally be 1-2 pages long when converted to PDF. Focus on quality rather than quantity and make sure to include all the relevant information that can increase the candidate's chances of getting an interview call for the given job description.
//                     `

//     const response = await ai.models.generateContent({
//         model: "gemini-3-flash-preview",
//         contents: prompt,
//         config: {
//             responseMimeType: "application/json",
//             responseSchema: zodToJsonSchema(resumePdfSchema),
//         }
//     })


//     const jsonContent = JSON.parse(response.text)

//     const pdfBuffer = await generatePdfFromHtml(jsonContent.html)

//     return pdfBuffer

// }

module.exports = { generateInterviewReport }