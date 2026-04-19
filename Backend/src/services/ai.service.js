const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")
const puppeteer = require("puppeteer")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})

function getCandidateModels() {
    const envPrimary = String(process.env.GEMINI_MODEL || "").trim()
    const envFallbacks = String(process.env.GEMINI_FALLBACK_MODELS || "")
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean)

    // Try user-configured model first, then commonly available Gemini families.
    const models = [
        envPrimary,
        ...envFallbacks,
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
        "gemini-1.5-pro",
    ].filter(Boolean)

    // Keep order while removing duplicates.
    return [...new Set(models)]
}

function formatGeminiError(error) {
    const raw = String(error?.message || "Unknown error")
    const status = error?.status || error?.code

    if (raw.includes("RESOURCE_EXHAUSTED") || raw.toLowerCase().includes("quota exceeded") || status === 429 || status === 503) {
        const retry = raw.match(/retryDelay"\s*:\s*"([^"]+)"/i)?.[1]
        if (retry) {
            return `Gemini API is currently unavailable or overloaded. Please retry after ${retry} or check billing/quota limits.`
        }
        return "Gemini API is currently unavailable or overloaded. Please retry later or check billing/quota limits."
    }

    if (raw.includes("NOT_FOUND") || raw.toLowerCase().includes("not found")) {
        return "No available Gemini model was found for this API key/project. Set GEMINI_MODEL to an enabled model."
    }

    return raw
}

function isModelUnavailableError(message) {
    const lower = String(message || "").toLowerCase()
    if (!lower) return false
    return (
        lower.includes("model") &&
        (lower.includes("not found") || lower.includes("no available"))
    )
}

function ensureArray(value) {
    if (Array.isArray(value)) return value
    if (value == null) return []
    return [value]
}

function parseObjectLikeString(value) {
    const raw = String(value || "").trim()

    const maybeObject = raw.startsWith("{") && raw.endsWith("}")
        ? raw
        : (raw.includes(":") ? `{${raw.replace(/^\{?|\}?$/g, "")}}` : "")

    if (!maybeObject) return null

    try {
        return JSON.parse(maybeObject)
    } catch {
        // Try a light conversion for model outputs that use single quotes.
        try {
            const normalized = maybeObject
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

function extractQAFromSectionText(value) {
    const raw = String(value || "").trim()
    if (!raw) return null

    // Only parse section-style blobs when explicit labels are present.
    const lower = raw.toLowerCase()
    const hasSectionLabels =
        /\bintention\b/.test(lower) ||
        /\bmodel\s*answer\b/.test(lower) ||
        /^\s*q\d+\.?\s+/i.test(raw)

    if (!hasSectionLabels) return null

    // Supports outputs like:
    // Q1. ...\nINTENTION ...\nMODEL ANSWER ...
    const questionMatch = raw.match(/^(?:q\d+\.?\s*)?([\s\S]*?)(?=\n\s*intention\b|\n\s*model\s*answer\b|$)/i)
    const intentionMatch = raw.match(/intention\s*:?\s*([\s\S]*?)(?=\n\s*model\s*answer\b|$)/i)
    const answerMatch = raw.match(/model\s*answer\s*:?\s*([\s\S]*?)$/i)

    if (!questionMatch && !intentionMatch && !answerMatch) return null

    const question = String(questionMatch?.[1] || "").replace(/^[-:\s]+/, "").trim()
    const intention = String(intentionMatch?.[1] || "").replace(/^[-:\s]+/, "").trim()
    const answer = String(answerMatch?.[1] || "").replace(/^[-:\s]+/, "").trim()

    if (!question && !intention && !answer) return null

    return { question, intention, answer }
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

function extractSkillGapFromKeyValueString(value) {
    const raw = String(value || "").trim()
    if (!raw) return null

    const skillMatch = raw.match(/"?skill"?\s*:\s*"?([^",}]+(?:\s[^",}]*)?)"?/i)
    const severityMatch = raw.match(/"?severity"?\s*:\s*"?(low|medium|high)"?/i)

    if (!skillMatch) return null

    return {
        skill: String(skillMatch[1] || "").trim(),
        severity: severityMatch ? String(severityMatch[1]).toLowerCase() : "medium",
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

                const extractedFromAnswer = extractQAFromSectionText(answer)
                if (extractedFromAnswer) {
                    question = extractedFromAnswer.question || question
                    intention = extractedFromAnswer.intention || intention
                    answer = extractedFromAnswer.answer || answer
                }

                const extractedFromQuestion = extractQAFromLooseString(question)
                if (extractedFromQuestion) {
                    question = extractedFromQuestion.question
                    intention = extractedFromQuestion.intention || intention
                    answer = extractedFromQuestion.answer || answer
                }

                const extractedFromQuestionSections = extractQAFromSectionText(question)
                if (extractedFromQuestionSections) {
                    question = extractedFromQuestionSections.question || question
                    intention = extractedFromQuestionSections.intention || intention
                    answer = extractedFromQuestionSections.answer || answer
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
                    if (extracted) {
                        item = extracted
                    } else {
                        const keyValueExtracted = extractSkillGapFromKeyValueString(item)
                        if (keyValueExtracted) item = keyValueExtracted
                    }
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

function pickRoleTitle(jobDescription) {
    const raw = String(jobDescription || "").trim()
    if (!raw) return "Interview Preparation Report"

    const firstLine = raw.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || ""
    const cleaned = firstLine.replace(/^job\s*title\s*[:\-]\s*/i, "").trim()

    if (cleaned.length >= 4 && cleaned.length <= 90) return cleaned
    return "Interview Preparation Report"
}

function buildQuotaFallbackReport({ resume, selfDescription, jobDescription }) {
    const context = [resume, selfDescription, jobDescription].map((v) => String(v || "").trim()).filter(Boolean).join("\n\n")
    const hasStrongContext = context.length > 120

    const technicalQuestions = [
        {
            question: "Can you explain the difference between processes and threads and why this distinction is important for system performance and troubleshooting?",
            intention: "To assess foundational operating system knowledge relevant to debugging and resource management in a support context.",
            answer: "A process is an independent execution unit with its own memory space, while threads run within a process and share the same memory and resources. Processes are safer because failures are isolated, but they are heavier in terms of creation and context switching overhead. Threads are lighter and better for concurrency, but require synchronization to avoid race conditions and deadlocks. This distinction helps troubleshooting: process-level issues often crash whole services, whereas thread-level issues usually appear as partial hangs, lock contention, or high CPU in specific workers."
        },
        {
            question: "Imagine you're monitoring a Linux server and notice consistently high CPU usage. Describe your troubleshooting steps.",
            intention: "To evaluate the candidate's practical troubleshooting skills for server-side issues common in L1/L2 support.",
            answer: "I would begin by confirming the scope and timeline of the issue, then use tools like top, htop, pidstat, and sar to identify which process or thread is consuming CPU. Next, I would check whether the load is user-space, system, or iowait, and correlate it with recent deployments, cron jobs, traffic spikes, or backup jobs. I would review application and system logs for repeated errors, retries, or tight loops. If needed, I would profile the process, apply temporary mitigation such as throttling or restarting unhealthy workers, and then implement a permanent fix based on root cause."
        },
        {
            question: "Explain the ACID properties in the context of database transactions and why they are vital for data integrity.",
            intention: "To assess knowledge of fundamental database principles, crucial for maintaining data consistency in any application.",
            answer: "ACID stands for Atomicity, Consistency, Isolation, and Durability. Atomicity means a transaction is all-or-nothing, so partial failures do not leave corrupted state. Consistency ensures each committed transaction keeps data within business and schema rules. Isolation ensures concurrent transactions do not produce invalid intermediate results such as dirty reads or lost updates. Durability guarantees committed data survives crashes. Together, these properties protect data correctness in operations like payments, inventory updates, and account transfers where incorrect intermediate state can cause real business loss."
        },
        {
            question: "You've identified a slow query in your MongoDB-backed MERN application. How would you approach optimizing it?",
            intention: "To evaluate practical skills in database performance tuning within a specialized MERN stack.",
            answer: "I would inspect query patterns and run explain plans to verify whether indexes are being used efficiently. Then I would optimize by creating compound indexes that match filter and sort order, and reduce payload size by projecting only required fields. I would also check for anti-patterns such as unbounded array scans, regex filters without anchors, and unnecessary aggregation stages. If workload allows, I would add caching for expensive repeated reads and review write overhead caused by extra indexes. Finally, I would validate improvements by comparing latency and throughput before and after changes."
        },
        {
            question: "How would you design secure authentication and authorization for a production web application?",
            intention: "To test practical security design across identity, session management, and access control.",
            answer: "I would separate authentication from authorization: use secure login with hashed passwords and short-lived access tokens, then enforce role or permission checks at every protected API boundary. Refresh token rotation and revocation should be implemented to reduce token abuse risk. Transport must be HTTPS-only, secrets must be managed in a vault, and sensitive events must be audit logged. I would also add rate limiting, brute-force protection, and periodic permission review to ensure access remains least-privilege as the system evolves."
        },
        {
            question: "How would you improve API performance under high concurrency in a Node.js backend?",
            intention: "To evaluate capability in end-to-end performance optimization and scalability planning.",
            answer: "I would profile endpoints to locate bottlenecks in CPU, I/O, and database calls, then prioritize the highest latency contributors. Common improvements include removing N+1 queries, batching operations, adding pagination, and caching frequently read data with clear invalidation rules. I would tune connection pools, set reasonable timeouts, and apply backpressure controls so downstream dependencies are protected under spikes. After changes, I would run load tests and track p95 or p99 latency, error rate, and throughput to verify impact before full rollout."
        },
        {
            question: "How would you debug and resolve a memory leak in a Node.js service?",
            intention: "To evaluate debugging approach for runtime stability issues in production services.",
            answer: "I would first confirm leak behavior by monitoring heap growth over time under stable traffic. Then I would capture and compare heap snapshots to find retained objects and references that should have been garbage collected. Typical causes include unbounded caches, listener leaks, and closures holding large objects. I would patch the source, add safeguards such as cache size limits and listener cleanup, and run soak tests to verify memory stabilizes. Finally, I would add proactive memory alerts and dashboards to catch regressions early."
        },
        {
            question: "How would you ensure data consistency across multiple services in a distributed system?",
            intention: "To assess understanding of transaction boundaries, eventual consistency, and failure handling.",
            answer: "I would keep strongly consistent updates transactional within a single service boundary and use asynchronous events for cross-service workflows. For multi-step distributed operations, I would use saga patterns with compensating actions instead of long-lived distributed transactions. I would enforce idempotency keys so retries do not create duplicates, and include message deduplication and replay-safe consumers. Periodic reconciliation jobs and clear observability around event states help identify and correct drift before it impacts users."
        },
        {
            question: "How would you design observability for faster incident detection and response?",
            intention: "To evaluate practical monitoring strategy using logs, metrics, traces, and actionable alerts.",
            answer: "I would define observability around service objectives by instrumenting structured logs, core metrics, and distributed traces with consistent correlation IDs. Metrics should include latency, traffic, errors, and resource saturation, while alerts should align to SLO thresholds to reduce noise. Traces would reveal bottlenecks and failing dependencies across request paths. I would build role-specific dashboards and runbooks so responders can quickly identify blast radius, likely root cause, and safe mitigation actions during incidents."
        },
        {
            question: "How would you reduce deployment risk using CI/CD and release strategies?",
            intention: "To test release engineering maturity and ability to ship safely at speed.",
            answer: "I would enforce automated quality gates in CI, including lint checks, unit tests, integration tests, and security scans before artifacts are promoted. In CD, I would use progressive rollout strategies such as canary or blue-green with real-time health checks and automated rollback triggers. Database migrations should be backward compatible and executed in phases to avoid downtime. Feature flags can decouple deploy from release, allowing controlled exposure and rapid rollback if business or reliability metrics regress."
        },
    ]

    const behavioralQuestions = [
        {
            question: "Tell me about a time you handled an ambiguous requirement and still delivered a successful outcome.",
            intention: "Evaluate ambiguity handling, stakeholder alignment, and outcome-focused execution.",
            answer: "In Situation and Task, explain the unclear requirement, who was affected, and what deadline or risk existed. In Action, describe how you converted ambiguity into concrete acceptance criteria through stakeholder interviews, assumptions tracking, and iterative demos. Mention how you prioritized scope and managed trade-offs between speed and completeness. In Result, share measurable impact such as on-time delivery, reduced rework, or improved user satisfaction, then note what process you standardized afterward."
        },
        {
            question: "Describe a situation where you disagreed with a technical decision and how you resolved it.",
            intention: "Assess technical communication, conflict resolution, and evidence-based decision making.",
            answer: "Use STAR and keep the tone collaborative. Describe the disputed decision, why it mattered, and the risks each option carried. In Action, show that you proposed objective evaluation criteria, gathered data from prototypes or benchmarks, and aligned discussion around team goals rather than personal preference. In Result, explain the final decision and measurable effects on reliability, delivery speed, or maintainability. End with how the disagreement improved team decision quality for future work."
        },
        {
            question: "Share an example of a production incident you owned and what changed afterward.",
            intention: "Evaluate incident ownership, calm execution under pressure, and preventive mindset.",
            answer: "Frame the incident scope, customer impact, and your direct ownership responsibilities. In Action, explain how you stabilized service first, communicated clearly to stakeholders, and drove root-cause analysis with timeline evidence. Then describe durable fixes such as code changes, alert tuning, runbook updates, and post-incident action tracking. In Result, provide quantified outcomes like lower MTTR, fewer repeat incidents, and improved alert precision, showing you turned a failure into system improvement."
        },
    ]

    const preparationPlan = [
        { day: 1, focus: "Role and architecture fundamentals", tasks: ["Review role requirements", "Map current system architecture", "List core technical risks"] },
        { day: 2, focus: "Backend and database depth", tasks: ["Practice API design questions", "Revise indexing and transactions", "Prepare scaling examples"] },
        { day: 3, focus: "Reliability and performance", tasks: ["Study caching and rate limiting", "Review monitoring strategy", "Practice incident response stories"] },
        { day: 4, focus: "Security and quality", tasks: ["Revise auth and authorization", "Review secure coding patterns", "Prepare testing strategy examples"] },
        { day: 5, focus: "Behavioral interview readiness", tasks: ["Prepare STAR stories", "Refine collaboration examples", "Quantify business impact in each story"] },
    ]

    return {
        matchScore: hasStrongContext ? 72 : 60,
        title: pickRoleTitle(jobDescription),
        technicalQuestions,
        behavioralQuestions,
        skillGaps: [
            { skill: "System design at scale", severity: "medium" },
            { skill: "Performance optimization under load", severity: "medium" },
            { skill: "Behavioral storytelling with measurable impact", severity: "low" },
        ],
        preparationPlan,
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
- question must contain only the interview question text (no "Q1", no labels, no JSON fragments)
- intention must contain only one concise sentence (no "INTENTION" label)
- answer must contain only the model answer paragraph (no "MODEL ANSWER" label)
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
- For every question object, keep values clean:
    - question: only the question text
    - intention: only the intention sentence
    - answer: only the model answer paragraph
- Do NOT combine question/intention/answer inside a single field
- Do NOT include labels like "Q1", "INTENTION", or "MODEL ANSWER" inside values
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

    if (lastMessage.toLowerCase().includes("unavailable") || lastMessage.toLowerCase().includes("overloaded") || lastMessage.toLowerCase().includes("quota") || isModelUnavailableError(lastMessage)) {
        const fallback = buildQuotaFallbackReport({ resume, selfDescription, jobDescription })
        const normalized = normalizeInterviewReport(fallback)
        const formatted = ensureConsistentReportFormat(normalized)

        return interviewReportSchema.parse({
            ...formatted,
            technicalQuestions: formatted.technicalQuestions.slice(0, formatted.technicalMinCount),
            behavioralQuestions: formatted.behavioralQuestions.slice(0, formatted.behavioralCount),
        })
    }
    throw new Error(`Gemini content generation failed. ${modelHint} Last error: ${lastMessage}`)
}

async function generatePdfFromHtml(htmlContent) {
    const browser = await puppeteer.launch()
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" })

    const pdfBuffer = await page.pdf({
        format: "A4", margin: {
            top: "20mm",
            bottom: "20mm",
            left: "15mm",
            right: "15mm"
        }
    })

    await browser.close()

    return pdfBuffer
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {

    const resumePdfSchema = z.object({
        html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")
    })

    const prompt = `Generate resume for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}
                        the response should be a JSON object with a single field "html" which contains the HTML content of the resume which can be converted to PDF using any library like puppeteer.
                        The resume should be tailored for the given job description and should highlight the candidate's strengths and relevant experience. The HTML content should be well-formatted and structured, making it easy to read and visually appealing.
                        The content of resume should be not sound like it's generated by AI and should be as close as possible to a real human-written resume.
                        you can highlight the content using some colors or different font styles but the overall design should be simple and professional use times new roman font please.
                        The content should be ATS friendly, i.e. it should be easily parsable by ATS systems without losing important information.
                        The resume should not be so lengthy, it should ideally be only 1 page long when converted to PDF. Focus on quality rather than quantity and make sure to include all the relevant information that can increase the candidate's chances of getting an interview call for the given job description.
                        The resume should not sound like it is written by ai. It should be as close as human written.
                    `

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(resumePdfSchema),
        }
    })


    const jsonContent = JSON.parse(response.text)

    const pdfBuffer = await generatePdfFromHtml(jsonContent.html)

    return pdfBuffer

}

module.exports = { generateInterviewReport, generateResumePdf };