const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")

// FIX: support both secret names — GEMINI_API_KEY is the standard Replit secret name
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY
})

function getCandidateModels() {
    const envPrimary = String(process.env.GEMINI_MODEL || "").trim()
    const envFallbacks = String(process.env.GEMINI_FALLBACK_MODELS || "")
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean)

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

    const lower = raw.toLowerCase()
    const hasSectionLabels =
        /\bintention\b/.test(lower) ||
        /\bmodel\s*answer\b/.test(lower) ||
        /^\s*q\d+\.?\s+/i.test(raw)

    if (!hasSectionLabels) return null

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

    return {
        question: cleanSentence(item?.question || item?.q, ""),
        intention: cleanSentence(item?.intention || item?.why, defaultIntention),
        answer: cleanSentence(item?.answer || item?.sampleAnswer, ""),
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
            question: "Imagine you are monitoring a Linux server and notice consistently high CPU usage. Describe your troubleshooting steps.",
            intention: "To evaluate the candidate's practical troubleshooting skills for server-side issues common in L1/L2 support.",
            answer: "I would begin by confirming the scope and timeline of the issue, then use tools like top, htop, pidstat, and sar to identify which process or thread is consuming CPU. Next, I would check whether the load is user-space, system, or iowait, and correlate it with recent deployments, cron jobs, traffic spikes, or backup jobs. I would review application and system logs for repeated errors, retries, or tight loops. If needed, I would profile the process, apply temporary mitigation such as throttling or restarting unhealthy workers, and then implement a permanent fix based on root cause."
        },
        {
            question: "Explain the ACID properties in the context of database transactions and why they are vital for data integrity.",
            intention: "To assess knowledge of fundamental database principles, crucial for maintaining data consistency in any application.",
            answer: "ACID stands for Atomicity, Consistency, Isolation, and Durability. Atomicity means a transaction is all-or-nothing, so partial failures do not leave corrupted state. Consistency ensures each committed transaction keeps data within business and schema rules. Isolation ensures concurrent transactions do not produce invalid intermediate results such as dirty reads or lost updates. Durability guarantees committed data survives crashes. Together, these properties protect data correctness in operations like payments, inventory updates, and account transfers where incorrect intermediate state can cause real business loss."
        },
        {
            question: "You have identified a slow query in your MongoDB-backed application. How would you approach optimizing it?",
            intention: "To evaluate practical skills in database performance tuning.",
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

// ─────────────────────────────────────────────────────────────
// generateMissingQuestionsFromAI
// FIX: prompt now does explicit JD extraction + resume cross-check before
//      generating questions, and every question must name a JD skill/tech
// ─────────────────────────────────────────────────────────────
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
You are a senior technical interviewer. Generate HIGHLY TARGETED interview questions for a specific role.

════════════════════════════════════
JOB DESCRIPTION (source of truth):
════════════════════════════════════
${jobDescription}

════════════════════════════════════
CANDIDATE RESUME:
════════════════════════════════════
${resume || "(no resume provided)"}

════════════════════════════════════
CANDIDATE SELF-DESCRIPTION:
════════════════════════════════════
${selfDescription || "(not provided)"}

════════════════════════════════════
ALREADY GENERATED — DO NOT REPEAT:
════════════════════════════════════
Technical (already covered):
${JSON.stringify(existingTechnicalQuestions || [])}

Behavioral (already covered):
${JSON.stringify(existingBehavioralQuestions || [])}

════════════════════════════════════
YOUR TASK:
════════════════════════════════════
Step 1 — List every skill, technology, framework, tool, and responsibility named in the JD.
Step 2 — Identify which of those are NOT yet covered by the existing questions above.
Step 3 — Generate ${neededTechnicalCount} NEW technical questions and ${neededBehavioralCount} NEW behavioral questions targeting ONLY the uncovered JD skills from Step 2.

STRICT RULES:
- Every technical question MUST reference a specific skill or technology named in the JD
- Every behavioral question MUST map to a responsibility described in the JD
- DO NOT generate generic software engineering questions not tied to this specific JD
- DO NOT repeat or rephrase any question already in the existing lists
- question: only the question text — no numbering, no labels
- intention: one sentence — exactly what JD requirement this tests
- answer: minimum 80 words with concrete steps, named JD technologies, trade-offs, and measurable outcomes

Return strict JSON only — no markdown, no preamble:
{
  "technicalQuestions": [{"question": string, "intention": string, "answer": string}],
  "behavioralQuestions": [{"question": string, "intention": string, "answer": string}]
}

If neededTechnicalCount or neededBehavioralCount is 0, return an empty array for that section.
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
        } catch (err) {
            console.error(`[generateMissingQuestionsFromAI] model ${modelName} failed:`, formatGeminiError(err))
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
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's profile matches the job description"),
    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question to be asked in the interview"),
        intention: z.string().describe("The intention of the interviewer behind asking this question"),
        answer: z.string().describe("A detailed model answer strategy with practical steps, technical depth, trade-offs, and measurable impact. It should be interview-ready and not generic.")
    })).describe("Technical questions that can be asked in the interview along with their intention and how to answer them"),
    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The behavioral question to be asked in the interview"),
        intention: z.string().describe("The intention of the interviewer behind asking this question"),
        answer: z.string().describe("A detailed model answer strategy using STAR with specific actions, ownership, collaboration, and measurable outcomes.")
    })).describe("Behavioral questions that can be asked in the interview along with their intention and how to answer them"),
    skillGaps: z.array(z.object({
        skill: z.string().describe("The skill which the candidate is lacking"),
        severity: z.enum(["low", "medium", "high"]).describe("The severity of this skill gap")
    })).describe("List of skill gaps in the candidate's profile along with their severity"),
    preparationPlan: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, starting from 1"),
        focus: z.string().describe("The main focus of this day"),
        tasks: z.array(z.string()).describe("List of tasks to be done on this day")
    })).describe("A day-wise preparation plan for the candidate"),
    title: z.string().describe("The title of the job for which the interview report is generated"),
})

// ─────────────────────────────────────────────────────────────
// generateInterviewReport
// FIX: 3-step chain-of-thought prompt — extract JD → cross-check resume →
//      generate. skillGaps = JD skills ABSENT from resume only.
//      Errors are logged so fallback triggers are visible in logs.
// ─────────────────────────────────────────────────────────────
async function generateInterviewReport({ resume, selfDescription, jobDescription }) {
    const prompt = `
You are a senior technical interviewer and career coach with deep hiring expertise.

Produce a HIGHLY TARGETED, PERSONALISED interview preparation report by analysing the candidate's specific background against the job description below.

════════════════════════════════════
JOB DESCRIPTION:
════════════════════════════════════
${jobDescription}

════════════════════════════════════
CANDIDATE RESUME:
════════════════════════════════════
${resume || "(no resume provided)"}

════════════════════════════════════
CANDIDATE SELF-DESCRIPTION:
════════════════════════════════════
${selfDescription || "(not provided)"}

════════════════════════════════════
FOLLOW THESE THREE STEPS IN ORDER:
════════════════════════════════════

STEP 1 — Extract from the Job Description:
Read the JD and identify every skill, technology, framework, language, tool, methodology, and responsibility it mentions (both explicit and implied). Note the exact job title and seniority level.

STEP 2 — Analyse the Candidate Profile:
For each JD requirement from Step 1, mark it as:
  PRESENT  — clearly demonstrated in the resume or self-description
  WEAK     — mentioned but with limited depth or only tangentially
  ABSENT   — no evidence at all in the resume

STEP 3 — Generate the report using your Step 1 and Step 2 analysis:

matchScore (0–100):
  Count PRESENT skills vs total JD requirements. Be realistic: 3+ ABSENT core requirements = score below 65.

title:
  The exact job title from the JD.

technicalQuestions (at least 10):
  - EVERY question MUST test a specific skill or technology named in the JD
  - Name the specific JD technology IN the question text (e.g. "This role uses Redis — walk me through how you would use it to...")
  - Mix depth: conceptual, hands-on implementation, architecture/design
  - DO NOT generate generic CS questions not tied to this specific JD
  - question: the question text naming the specific JD skill/tech
  - intention: one sentence — what JD requirement this tests and why it matters for THIS role
  - answer: minimum 80 words — concrete steps, trade-offs, named JD technologies, measurable outcomes

behavioralQuestions (exactly 3):
  - Tailor to the responsibilities and team dynamics described in THIS JD
  - question: behavioral question tied to a JD responsibility
  - intention: one sentence — what aspect of THIS role this assesses
  - answer: STAR-structured, minimum 80 words, specific actions, collaboration, quantified result

skillGaps:
  - List ONLY skills that are ABSENT or WEAK in the candidate profile AND required/mentioned in the JD
  - DO NOT list skills the candidate already has
  - DO NOT fabricate generic gaps — only gaps you identified in Step 2
  - severity: high = core JD requirement completely missing, medium = partially covered, low = nice-to-have not present
  - Return [] if the candidate covers all JD requirements well

preparationPlan (5–7 days):
  - Each day must target a specific JD skill or gap identified in Step 2
  - focus: short heading naming the specific JD skill
  - tasks: 3 concrete action items specific to that JD skill

Return ONLY valid JSON. No markdown, no preamble, no explanation outside the JSON.
`

    const candidateModels = getCandidateModels()
    let lastError = null
    let isQuotaError = false
    const triedModels = []

    for (const modelName of candidateModels) {
        try {
            console.log(`[generateInterviewReport] Trying model: ${modelName}`)
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

            const TECHNICAL_TARGET = 10
            const BEHAVIORAL_TARGET = 3

            if (
                formatted.technicalQuestions.length < TECHNICAL_TARGET ||
                formatted.behavioralQuestions.length < BEHAVIORAL_TARGET
            ) {
                console.log(`[generateInterviewReport] Got ${formatted.technicalQuestions.length} tech / ${formatted.behavioralQuestions.length} behavioral — filling iteratively`)
                const filled = await fillQuestionsIteratively({
                    resume,
                    selfDescription,
                    jobDescription,
                    technicalQuestions: formatted.technicalQuestions,
                    behavioralQuestions: formatted.behavioralQuestions,
                    technicalTarget: TECHNICAL_TARGET,
                    behavioralTarget: BEHAVIORAL_TARGET,
                })
                formatted.technicalQuestions = filled.technicalQuestions
                formatted.behavioralQuestions = filled.behavioralQuestions
            }

            if (formatted.technicalQuestions.length === 0 || formatted.behavioralQuestions.length === 0) {
                throw new Error("AI could not generate interview questions for this input.")
            }

            return interviewReportSchema.parse({
                ...formatted,
                technicalQuestions: formatted.technicalQuestions,
                behavioralQuestions: formatted.behavioralQuestions.slice(0, formatted.behavioralCount),
            })
        } catch (err) {
            const message = formatGeminiError(err)
            console.error(`[generateInterviewReport] model ${modelName} failed: ${message}`)
            lastError = err

            if (
                String(err?.message || "").includes("RESOURCE_EXHAUSTED") ||
                err?.status === 429 ||
                err?.status === 503
            ) {
                isQuotaError = true
                break
            }

            continue
        }
    }

    const lastMessage = formatGeminiError(lastError)
    console.warn(`[generateInterviewReport] All models failed — using fallback. Tried: ${triedModels.join(", ")}. Last error: ${lastMessage}`)

    if (
        isQuotaError ||
        lastMessage.toLowerCase().includes("unavailable") ||
        lastMessage.toLowerCase().includes("overloaded") ||
        lastMessage.toLowerCase().includes("quota") ||
        isModelUnavailableError(lastMessage)
    ) {
        const fallback = buildQuotaFallbackReport({ resume, selfDescription, jobDescription })
        const normalized = normalizeInterviewReport(fallback)
        const formatted = ensureConsistentReportFormat(normalized)
        return interviewReportSchema.parse({
            ...formatted,
            technicalQuestions: formatted.technicalQuestions.slice(0, formatted.technicalMinCount),
            behavioralQuestions: formatted.behavioralQuestions.slice(0, formatted.behavioralCount),
        })
    }

    throw new Error(`Gemini content generation failed. Tried: ${triedModels.join(", ")}. Last error: ${lastMessage}`)
}

// ─────────────────────────────────────────────────────────────
// generatePdfFromHtml — unchanged helper
// ─────────────────────────────────────────────────────────────
async function generatePdfFromHtml(htmlContent) {
    if (!htmlContent) return null

    try {
        const puppeteer = require("puppeteer")

        const launchOptions = {
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
            headless: "new",
        }
        if (process.env.PUPPETEER_EXECUTABLE_PATH) {
            launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
        }

        const browser = await puppeteer.launch(launchOptions)
        const page = await browser.newPage()
        await page.setContent(htmlContent, { waitUntil: "networkidle0" })

        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
        })

        await browser.close()
        return pdfBuffer
    } catch (err) {
        console.error("[generatePdfFromHtml] PDF generation failed:", err)
        return null
    }
}

// ─────────────────────────────────────────────────────────────
// generateResumePdf
// FIX 1: Removed hardcoded "gemini-3-flash-preview" (that model doesn't exist)
// FIX 2: Now uses the same getCandidateModels() fallback loop as every other function
// FIX 3: Prompt is more explicit — tailor to JD, ATS-friendly, human-sounding
// FIX 4: Errors are caught and logged; throws a clear message instead of crashing
// ─────────────────────────────────────────────────────────────
async function generateResumePdf({ resume, selfDescription, jobDescription }) {
    const resumePdfSchema = z.object({
        html: z.string().describe("Complete, self-contained HTML for the resume, ready to be rendered to PDF by Puppeteer")
    })

    const prompt = `
You are an expert resume writer and career coach.

Generate a polished, ATS-friendly, human-sounding resume in HTML for the candidate below.
Tailor the resume specifically to the provided Job Description — highlight matching skills, reframe experience using JD keywords, and emphasise the most relevant achievements.

════════════════════════════════════
JOB DESCRIPTION (tailor the resume to this):
════════════════════════════════════
${jobDescription || "(not provided — write a strong general resume)"}

════════════════════════════════════
CANDIDATE RESUME / EXPERIENCE:
════════════════════════════════════
${resume || "(not provided)"}

════════════════════════════════════
CANDIDATE SELF-DESCRIPTION:
════════════════════════════════════
${selfDescription || "(not provided)"}

════════════════════════════════════
HTML REQUIREMENTS:
════════════════════════════════════
- Return a SINGLE complete HTML string in the "html" field — no external CSS files, no external fonts via @import (use system fonts only: "Times New Roman", serif)
- All styles must be inline or in a <style> block inside <head>
- Design: clean, professional, single-column or two-column layout
- Use subtle colour accents (dark navy or dark grey headings, white background) — no bright colours
- Font: "Times New Roman", serif for body; slightly larger bold for name and section headings
- The rendered PDF must fit on ONE A4 page (210mm × 297mm) — keep content concise, use compact spacing
- Do NOT add a photo placeholder
- Sections to include (only if data is available): Contact Info, Professional Summary, Skills, Work Experience, Education, Projects (optional), Certifications (optional)
- ATS rules: use plain section headings (EXPERIENCE, SKILLS, EDUCATION), avoid tables for layout, avoid text in images, use standard bullet points (•)
- The writing must sound natural and human — avoid AI-sounding phrases like "spearheaded", "leveraged synergies", "drove impactful outcomes"
- Quantify achievements where possible (e.g. "reduced load time by 40%", "managed team of 5")
- Do NOT include the string "Generated by AI" or any meta-comment anywhere in the HTML

Return ONLY valid JSON with a single key "html" containing the complete HTML string.
`

    const candidateModels = getCandidateModels()
    let lastError = null

    for (const modelName of candidateModels) {
        try {
            console.log(`[generateResumePdf] Trying model: ${modelName}`)

            const response = await ai.models.generateContent({
                model: modelName,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: zodToJsonSchema(resumePdfSchema),
                }
            })

            const jsonContent = JSON.parse(response.text)
            const validated = resumePdfSchema.parse(jsonContent)

            if (!validated.html || validated.html.trim().length < 100) {
                throw new Error("Model returned empty or too-short HTML for resume.")
            }

            const pdfBuffer = await generatePdfFromHtml(validated.html)
            return pdfBuffer
        } catch (err) {
            const message = formatGeminiError(err)
            console.error(`[generateResumePdf] model ${modelName} failed: ${message}`)
            lastError = err

            // Quota/rate-limit — no point trying more models
            if (
                String(err?.message || "").includes("RESOURCE_EXHAUSTED") ||
                err?.status === 429 ||
                err?.status === 503
            ) {
                break
            }
        }
    }

    const errMsg = formatGeminiError(lastError)
    console.error(`[generateResumePdf] All models failed. Last error: ${errMsg}`)
    throw new Error(`Resume PDF generation failed: ${errMsg}`)
}

// ─────────────────────────────────────────────────────────────
// evaluateInterviewAnswer
// FIX 1: Prompt now uses full JD + role context so feedback is role-specific
// FIX 2: suggestedAnswer is explicitly asked to reference JD technologies
// FIX 3: followUpQuestion must be grounded in the same JD skill being tested
// FIX 4: Errors are logged; fallback is returned with a warning, not silently
// ─────────────────────────────────────────────────────────────
async function evaluateInterviewAnswer({ reportTitle, questionType, question, intention, modelAnswer, candidateAnswer, skillGaps, jobDescription }) {
    const evaluationSchema = z.object({
        score: z.number().min(0).max(100),
        summary: z.string(),
        strengths: z.array(z.string()),
        improvements: z.array(z.string()),
        suggestedAnswer: z.string(),
        followUpQuestion: z.string(),
    })

    const prompt = `
You are a senior interviewer evaluating a candidate's answer for a specific role.

════════════════════════════════════
ROLE CONTEXT:
════════════════════════════════════
Role: ${reportTitle || "Interview Practice"}
Question type: ${questionType || "technical"}
${jobDescription ? `Job Description:\n${jobDescription}` : ""}
Identified skill gaps for this candidate: ${JSON.stringify(skillGaps || [])}

════════════════════════════════════
QUESTION BEING EVALUATED:
════════════════════════════════════
Question: ${question || ""}
What the interviewer is testing (intention): ${intention || ""}
Model answer guidance: ${modelAnswer || ""}

════════════════════════════════════
CANDIDATE'S ANSWER:
════════════════════════════════════
${candidateAnswer || "(no answer provided)"}

════════════════════════════════════
YOUR EVALUATION TASK:
════════════════════════════════════
Evaluate the candidate's answer against the question intention and the role requirements above.

score (0–100):
  - 85–100: answer is complete, well-structured, mentions specific technologies/examples, and has measurable outcomes
  - 65–84: solid answer with minor gaps in depth, examples, or outcomes
  - 40–64: partially addresses the question but lacks structure, specifics, or impact
  - 0–39: off-topic, very thin, or completely missing key points

summary (1–2 sentences):
  Specific assessment of how well this answer fits the role and question — reference the role or question topic directly.

strengths (2–4 items):
  Specific things the candidate did well — reference what they actually said, not generic praise.

improvements (2–4 items):
  Specific gaps vs the question intention and role requirements — name what was missing or underdeveloped.

suggestedAnswer:
  A concise but interview-ready improved answer that:
  - Directly addresses the question intention
  - References specific technologies or methods relevant to this role
  - Follows STAR structure for behavioral, or step-by-step + trade-offs for technical
  - Ends with a measurable outcome
  Minimum 80 words.

followUpQuestion:
  A natural next interview question an interviewer would ask to probe deeper on the same JD skill or topic just discussed.

Rules:
- Do not mention that you are an AI
- Do not include markdown formatting
- Return ONLY valid JSON matching the schema
`

    const heuristicFallback = {
        score: 58,
        summary: "The answer covers the topic at a basic level but needs stronger structure, more depth, and clearer impact.",
        strengths: ["Addresses the question", "Shows some relevant understanding"],
        improvements: ["Add a clearer structure (STAR for behavioral, step-by-step for technical)", "Include a concrete example with specific technologies", "Finish with a measurable outcome"],
        suggestedAnswer: String(modelAnswer || candidateAnswer || "").trim() || "Answer with a clear structure, explain your reasoning and trade-offs, reference specific technologies relevant to the role, and finish with measurable impact.",
        followUpQuestion: "Can you walk me through a specific example where you applied this in a real project?"
    }

    const candidateModels = getCandidateModels()

    for (const modelName of candidateModels) {
        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: zodToJsonSchema(evaluationSchema),
                }
            })

            const parsed = JSON.parse(response.text)
            return evaluationSchema.parse(parsed)
        } catch (err) {
            console.error(`[evaluateInterviewAnswer] model ${modelName} failed:`, formatGeminiError(err))
        }
    }

    console.warn("[evaluateInterviewAnswer] All models failed — returning heuristic fallback.")
    return heuristicFallback
}

// ─────────────────────────────────────────────────────────────
// generatePreparationPlan
// FIX 1: Now accepts jobDescription so plan is anchored to actual JD skills
// FIX 2: Prompt ties every day to a specific JD requirement or skill gap
// FIX 3: Tasks are concrete and JD-specific, not generic advice
// FIX 4: Schema now includes tasks[] so the full plan is returned
// ─────────────────────────────────────────────────────────────
async function generatePreparationPlan({ interviewReport, jobDescription }) {
    const skillGaps = ensureArray(interviewReport.skillGaps)
        .map((gap) => String(gap?.skill || gap || "").trim())
        .filter(Boolean)
    const title = String(interviewReport.title || "Interview Preparation").trim()

    const planSchema = z.array(z.object({
        day: z.number(),
        focus: z.string(),
        tasks: z.array(z.string()),
    }))

    const prompt = `
You are an expert interview coach creating a targeted preparation plan.

════════════════════════════════════
JOB DESCRIPTION:
════════════════════════════════════
${jobDescription || "(not provided — use skill gaps and title below)"}

════════════════════════════════════
ROLE: ${title}
SKILL GAPS TO CLOSE:
${skillGaps.length > 0 ? skillGaps.map((s, i) => `${i + 1}. ${s}`).join("\n") : "No specific gaps identified — reinforce all JD requirements"}
════════════════════════════════════

Create a 5-day preparation plan. Rules:
- Each day must focus on a SPECIFIC skill or technology named in the JD (not generic advice)
- Prioritise days that address the skill gaps listed above
- focus: short heading (5–8 words) naming the specific JD skill for that day
- tasks: exactly 3 concrete action items per day — name specific resources, exercises, or practice activities tied to that JD skill
  Good example: "Implement a JWT refresh token flow in Express and test with Postman"
  Bad example: "Review core concepts" or "Practice interview questions" (too generic)
- Return exactly 5 days

Return ONLY a JSON array — no markdown, no explanation:
[{"day": number, "focus": string, "tasks": [string, string, string]}]
`

    const candidateModels = getCandidateModels()

    for (const modelName of candidateModels) {
        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: zodToJsonSchema(planSchema),
                },
            })

            const parsed = JSON.parse(response.text)
            return planSchema.parse(parsed)
        } catch (err) {
            console.error(`[generatePreparationPlan] model ${modelName} failed:`, formatGeminiError(err))
        }
    }

    // Fallback: build a plan from skill gaps with concrete task descriptions
    console.warn("[generatePreparationPlan] All models failed — using fallback plan.")
    const fallback = []
    const topSkills = skillGaps.slice(0, 5)
    const totalDays = Math.max(3, Math.min(5, topSkills.length || 5))

    for (let i = 0; i < totalDays; i++) {
        const skill = topSkills[i]
        fallback.push({
            day: i + 1,
            focus: skill ? `Revise and practise: ${skill}` : `Review core ${title} fundamentals`,
            tasks: skill
                ? [
                    `Study the fundamentals of ${skill} and how it applies to the ${title} role`,
                    `Build or trace through a hands-on example using ${skill}`,
                    `Prepare two interview answers demonstrating your ${skill} experience with measurable outcomes`,
                ]
                : [
                    `Review the most important technical topics for ${title}`,
                    `Practise explaining your past experience using STAR format`,
                    `Prepare two questions to ask the interviewer about the role and team`,
                ],
        })
    }

    return planSchema.parse(fallback)
}

module.exports = { generateInterviewReport, generateResumePdf, evaluateInterviewAnswer, generatePreparationPlan }