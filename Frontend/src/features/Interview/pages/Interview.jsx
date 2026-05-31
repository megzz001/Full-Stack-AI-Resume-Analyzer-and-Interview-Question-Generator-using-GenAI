import React, { useState, useEffect } from 'react'
import '../styles/interview.scss'
import { useInterview } from '../hooks/useInterview.js'
import { useNavigate, useParams } from 'react-router'
import { evaluatePracticeAnswer, updatePreparationProgress } from '../services/interview.api.js'



const NAV_ITEMS = [
    { id: 'technical', label: 'Technical Questions', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>) },
    { id: 'behavioral', label: 'Behavioral Questions', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>) },
    { id: 'roadmap', label: 'Road Map', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>) },
]

function parseCombinedQuestionText(text) {
    const raw = String(text || '').trim()
    if (!raw) return null

    if (!raw.includes('question') || !raw.includes('intention') || !raw.includes('answer')) return null

    const candidate = `${raw.startsWith('{') ? '' : '{'}${raw}${raw.endsWith('}') ? '' : '}'}`
    try {
        const parsed = JSON.parse(candidate)
        return {
            question: String(parsed.question || '').trim(),
            intention: String(parsed.intention || '').trim(),
            answer: String(parsed.answer || '').trim(),
        }
    } catch {
        const match = raw.match(/question"\s*:\s*"([\s\S]*?)"\s*,\s*"intention"\s*:\s*"([\s\S]*?)"\s*,\s*"answer"\s*:\s*"([\s\S]*?)"\s*$/i)
        if (!match) return null
        return {
            question: match[1].trim(),
            intention: match[2].trim(),
            answer: match[3].trim(),
        }
    }
}

function parseLabeledQuestionText(text) {
    const raw = String(text || '').trim()
    if (!raw) return null

    const questionMatch = raw.match(/^(?:q\d+\.?\s*[-:]\s*)?(.*?)(?=\s*-?\s*intention\s*:|\s*-?\s*answer\s*:|$)/is)
    const intentionMatch = raw.match(/intention\s*:\s*([\s\S]*?)(?=\s*-?\s*answer\s*:|$)/i)
    const answerMatch = raw.match(/answer\s*:\s*([\s\S]*?)$/i)

    if (!questionMatch && !intentionMatch && !answerMatch) return null

    const question = String(questionMatch?.[1] || '').replace(/^[-:\s]+/, '').trim()
    const intention = String(intentionMatch?.[1] || '').replace(/^[-:\s]+/, '').trim()
    const answer = String(answerMatch?.[1] || '').replace(/^[-:\s]+/, '').trim()

    if (!question && !intention && !answer) return null

    return { question, intention, answer }
}

function parseObjectLikeString(text) {
    const raw = String(text || '').trim()
    if (!raw) return null

    const candidate = raw.startsWith('{') && raw.endsWith('}')
        ? raw
        : (raw.includes(':') ? `{${raw.replace(/^\{?|\}?$/g, '')}}` : '')

    if (!candidate) return null

    try {
        return JSON.parse(candidate)
    } catch {
        try {
            const normalized = candidate
                .replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":')
                .replace(/:\s*'([^']*)'/g, ': "$1"')
            return JSON.parse(normalized)
        } catch {
            return null
        }
    }
}

function normalizeQuestionItem(item) {
    const questionRaw = String(item?.question || '').trim()
    const combined = parseCombinedQuestionText(item?.question)
    const labeled = combined || parseLabeledQuestionText(item?.question)
    if (labeled && labeled.question) {
        return {
            question: labeled.question,
            intention: labeled.intention || String(item?.intention || '').trim(),
            answer: labeled.answer || String(item?.answer || '').trim(),
        }
    }

    if (questionRaw.toLowerCase() === 'intention' || questionRaw.toLowerCase() === 'answer') {
        const reconstructed = parseCombinedQuestionText(JSON.stringify(item || {}))
        if (reconstructed && reconstructed.question) {
            return {
                question: reconstructed.question,
                intention: reconstructed.intention || String(item?.intention || '').trim(),
                answer: reconstructed.answer || String(item?.answer || '').trim(),
            }
        }
    }

    const intentionRaw = String(item?.intention || '').trim()
    const answerRaw = String(item?.answer || '').trim()

    const labeledIntention = parseLabeledQuestionText(intentionRaw)
    const labeledAnswer = parseLabeledQuestionText(answerRaw)

    return {
        question: questionRaw,
        intention: labeledIntention?.intention || intentionRaw,
        answer: labeledAnswer?.answer || answerRaw,
    }
}

function extractTaggedText(value) {
    const raw = String(value || '').trim()
    if (!raw) return null

    const match = raw.match(/^"?(question|intention|answer)"?\s*:\s*"?([\s\S]*?)"?\s*[,]?$/i)
    if (!match) return null

    return {
        tag: String(match[1] || '').toLowerCase(),
        text: String(match[2] || '').trim(),
    }
}

function normalizeQuestionCollection(items) {
    const source = Array.isArray(items) ? items : []
    const merged = []
    let draft = null

    const flushDraft = () => {
        if (!draft) return
        if (draft.question) {
            merged.push({
                question: draft.question,
                intention: draft.intention,
                answer: draft.answer,
            })
        }
        draft = null
    }

    for (const item of source) {
        const fromQuestion = extractTaggedText(item?.question)
        const fromIntention = extractTaggedText(item?.intention)
        const fromAnswer = extractTaggedText(item?.answer)
        const tagged = fromQuestion || fromIntention || fromAnswer

        if (!tagged) {
            flushDraft()
            const normalized = normalizeQuestionItem(item)
            if (normalized.question) merged.push(normalized)
            continue
        }

        if (!draft) {
            draft = { question: '', intention: '', answer: '' }
        }

        if (tagged.tag === 'question') draft.question = tagged.text
        if (tagged.tag === 'intention') draft.intention = tagged.text
        if (tagged.tag === 'answer') draft.answer = tagged.text

        if (draft.question && draft.intention && draft.answer) {
            flushDraft()
        }
    }

    flushDraft()
    return merged
}

function normalizeSkillGapItem(item) {
    if (!item) return null

    if (typeof item === 'string') {
        const parsed = parseObjectLikeString(item)
        if (parsed && typeof parsed === 'object') {
            return normalizeSkillGapItem(parsed)
        }

        const skillMatch = item.match(/"?skill"?\s*:\s*"?([^",}]+(?:\s[^",}]*)?)"?/i)
        const severityMatch = item.match(/"?severity"?\s*:\s*"?(low|medium|high)"?/i)

        if (skillMatch) {
            return {
                skill: String(skillMatch[1] || '').trim(),
                severity: String(severityMatch?.[1] || 'medium').toLowerCase(),
            }
        }

        const plain = String(item).trim()
        return plain ? { skill: plain, severity: 'medium' } : null
    }

    if (typeof item === 'object') {
        const skill = String(item.skill || item.name || '').trim()
        const severityRaw = String(item.severity || 'medium').toLowerCase()
        const severity = ['low', 'medium', 'high'].includes(severityRaw) ? severityRaw : 'medium'
        if (!skill) return null
        return { skill, severity }
    }

    return null
}

// ── Sub-components ────────────────────────────────────────────────────────────
const QuestionCard = ({ item, index }) => {
    const [open, setOpen] = useState(false)
    const normalized = normalizeQuestionItem(item)

    return (
        <div className='q-card'>
            <div className='q-card__header' onClick={() => setOpen(o => !o)}>
                <span className='q-card__index'>Q{index + 1}</span>
                <p className='q-card__question'>{normalized.question}</p>
                <span className={`q-card__chevron ${open ? 'q-card__chevron--open' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </span>
            </div>
            {open && (
                <div className='q-card__body'>
                    <p className='q-card__line'>
                        <span className='q-card__tag q-card__tag--intention'>Intention</span>
                        <span>{normalized.intention}</span>
                    </p>
                    <p className='q-card__line'>
                        <span className='q-card__tag q-card__tag--answer'>Model Answer</span>
                        <span>{normalized.answer}</span>
                    </p>
                </div>
            )}
        </div>
    )
}

const RoadMapDay = ({ day, index, reportId, refreshReport }) => {
    const storageKey = `roadmapProgress:${reportId}`
    const [completed, setCompleted] = useState(Boolean(day?.completed))

    useEffect(() => {
        // prefer server value when present; otherwise fallback to localStorage
        if (typeof day?.completed === 'boolean') {
            setCompleted(Boolean(day.completed))
            return
        }
        try {
            const raw = localStorage.getItem(storageKey)
            if (!raw) return
            const arr = JSON.parse(raw)
            if (Array.isArray(arr) && typeof arr[index] === 'boolean') setCompleted(Boolean(arr[index]))
        } catch (e) {
            // ignore
        }
    }, [storageKey, index, day])

    const toggle = async () => {
        const next = !completed
        // optimistic UI
        setCompleted(next)

        try {
            await updatePreparationProgress({ interviewReportId: reportId, dayIndex: index, completed: next })
            // refresh the full report so other components get updated
            if (typeof refreshReport === 'function') await refreshReport(reportId)
            // keep a local fallback copy as well
            try {
                const raw = localStorage.getItem(storageKey)
                const arr = raw ? JSON.parse(raw) : []
                arr[index] = next
                localStorage.setItem(storageKey, JSON.stringify(arr))
            } catch (e) { }
        } catch (err) {
            // revert optimistic UI and fallback to local storage
            setCompleted(!next)
            try {
                const raw = localStorage.getItem(storageKey)
                const arr = raw ? JSON.parse(raw) : []
                arr[index] = !next
                localStorage.setItem(storageKey, JSON.stringify(arr))
            } catch (e) { }
            window.alert(err?.message || 'Failed to save progress to server. Progress was not saved.')
        }
    }

    const progressPercent = typeof day?.progress === 'number' ? Math.max(0, Math.min(100, day.progress)) : (completed ? 100 : (day?.completed === false ? 0 : (day?.estimatedProgress || 0)))

    return (
        <div className={`roadmap-day ${completed ? 'roadmap-day--completed' : ''}`}>
            <div className='roadmap-day__timeline'>
                <div className='roadmap-day__marker'>
                    <label className='roadmap-day__checkbox'>
                        <input type='checkbox' checked={completed} onChange={toggle} />
                        <span />
                    </label>
                </div>

                <article className='roadmap-day__card glass-card'>
                    <div className='roadmap-day__header'>
                        <div>
                            <div className='roadmap-day__kicker'>DAY {day.day || (index + 1)}</div>
                            <h3 className='roadmap-day__focus'>{day.focus}</h3>
                            {day.summary && <p className='roadmap-day__summary'>{day.summary}</p>}
                        </div>

                        <div>
                            {completed && <span className='roadmap-day__badge roadmap-day__badge--progress'>COMPLETED</span>}
                        </div>
                    </div>

                    {/* optional meta and progress */}
                    <div className='roadmap-day__meta'>
                        {day.duration && <span className='roadmap-day__time'>{day.duration}</span>}
                    </div>

                    <div className='roadmap-day__progress'>
                        <div className='roadmap-day__progress-bar' role='progressbar' aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
                            <span style={{ width: `${progressPercent}%` }} />
                        </div>
                        <div className='roadmap-day__progress-label'>{progressPercent}% Progress</div>
                    </div>
                </article>
            </div>
        </div>
    )
}

const buildPracticeStartIndex = (questions, skillGaps = []) => {
    if (!Array.isArray(questions) || questions.length === 0) return 0

    const prioritySkills = skillGaps
        .map(gap => String(gap?.skill || '').trim().toLowerCase())
        .filter(Boolean)

    const mongoIndex = questions.findIndex(question => /mongo(db)?|index|schema|query/i.test(question.question))
    if (mongoIndex >= 0) return mongoIndex

    for (const skill of prioritySkills) {
        const skillIndex = questions.findIndex(question => question.question.toLowerCase().includes(skill))
        if (skillIndex >= 0) return skillIndex
    }

    return 0
}

// ── Main Component ────────────────────────────────────────────────────────────
const Interview = () => {
    const [activeNav, setActiveNav] = useState('technical')
    const [practiceActive, setPracticeActive] = useState(false)
    const [practiceMode, setPracticeMode] = useState('technical')
    const [practiceIndex, setPracticeIndex] = useState(0)
    const [practiceAnswer, setPracticeAnswer] = useState('')
    const [practiceFeedback, setPracticeFeedback] = useState(null)
    const [practiceLoading, setPracticeLoading] = useState(false)
    const [planLoading, setPlanLoading] = useState(false)
    const { report, getReportById, loading, getResumePdf, deleteReport } = useInterview()
    const { interviewId } = useParams()
    const navigate = useNavigate()

    const handleDeleteReport = async () => {
        const shouldDelete = window.confirm('Delete this report permanently from database?')
        if (!shouldDelete) return

        try {
            await deleteReport(interviewId)
            navigate('/')
        } catch (error) {
            window.alert(error.message || 'Failed to delete report')
        }
    }

    useEffect(() => {
        if (interviewId) {
            getReportById(interviewId)
        }
    }, [interviewId])



    if (loading || !report) {
        return (
            <main className='loading-screen'>
                <h1>Loading your interview plan...</h1>
            </main>
        )
    }

    const scoreColor =
        report.matchScore >= 80 ? 'score--high' :
            report.matchScore >= 60 ? 'score--mid' : 'score--low'

    const normalizedSkillGaps = (Array.isArray(report.skillGaps) ? report.skillGaps : [])
        .map(normalizeSkillGapItem)
        .filter(Boolean)

    const technicalQuestions = normalizeQuestionCollection(report.technicalQuestions)
    const behavioralQuestions = normalizeQuestionCollection(report.behavioralQuestions)
    const roadmapSteps = Array.isArray(report.preparationPlan) ? report.preparationPlan : []
    const currentPracticeQuestions = practiceMode === 'behavioral' ? behavioralQuestions : technicalQuestions
    const currentPracticeQuestion = currentPracticeQuestions[practiceIndex] || currentPracticeQuestions[0] || null
    const mentorPrimaryFocus = roadmapSteps[0]?.focus || normalizedSkillGaps[0]?.skill || 'system design efficiency'
    const mentorSecondaryFocus = normalizedSkillGaps[0]?.skill || 'system design efficiency'
    const mentorGuidance = `Based on current market trends for Senior Full-stack roles, ${mentorPrimaryFocus.toLowerCase()} is the fastest way to raise your interview readiness.`

    const handleStartSimulation = () => {
        const nextMode = activeNav === 'behavioral' ? 'behavioral' : 'technical'
        setPracticeMode(nextMode)
        setPracticeIndex(buildPracticeStartIndex(nextMode === 'behavioral' ? behavioralQuestions : technicalQuestions, normalizedSkillGaps))
        setPracticeAnswer('')
        setPracticeFeedback(null)
        setPracticeActive(true)
        setActiveNav(nextMode)
    }

    const handleExploreDetailedGuide = () => {
        const nextMode = 'technical'
        setPracticeMode(nextMode)
        setPracticeIndex(buildPracticeStartIndex(technicalQuestions, normalizedSkillGaps))
        setPracticeAnswer('')
        setPracticeFeedback(null)
        setPracticeActive(true)
        setActiveNav(nextMode)
    }

    const handleGeneratePlan = async () => {
        if (!report?._id) return
        try {
            setPlanLoading(true)
            await import('../services/interview.api.js').then(m => m.generatePreparationPlan({ interviewReportId: report._id }))
            // refresh report
            await getReportById(report._id)
            setActiveNav('roadmap')
        } catch (err) {
            window.alert(err?.message || 'Failed to generate preparation plan')
        } finally {
            setPlanLoading(false)
        }
    }

    const handleSubmitPracticeAnswer = async () => {
        if (!currentPracticeQuestion || !practiceAnswer.trim()) {
            return
        }

        try {
            setPracticeLoading(true)
            const response = await evaluatePracticeAnswer({
                interviewReportId: interviewId,
                questionType: practiceMode,
                questionIndex: practiceIndex,
                answer: practiceAnswer,
            })

            setPracticeFeedback(response.evaluation)
        } catch (error) {
            window.alert(error.message || 'Failed to evaluate your answer.')
        } finally {
            setPracticeLoading(false)
        }
    }

    const handleNextPracticeQuestion = () => {
        const nextIndex = practiceIndex + 1
        if (nextIndex < currentPracticeQuestions.length) {
            setPracticeIndex(nextIndex)
            setPracticeAnswer('')
            setPracticeFeedback(null)
            return
        }

        setPracticeActive(false)
        setPracticeAnswer('')
        setPracticeFeedback(null)
        setPracticeIndex(0)
    }


    return (
        <div className='report-page'>
            <header className='report-topbar'>
                <button className='report-topbar__icon-btn' type='button' onClick={() => navigate(-1)} aria-label='Go back'>
                    <span className='material-symbols-outlined'>arrow_back</span>
                </button>
                <h1>Interview Report</h1>
                <button className='report-topbar__icon-btn' type='button' aria-label='Share report'>
                    <span className='material-symbols-outlined'>share</span>
                </button>
            </header>

            <div className='report-tabs'>
                {NAV_ITEMS.map(item => (
                    <button
                        key={item.id}
                        className={`report-tabs__item ${activeNav === item.id ? 'report-tabs__item--active' : ''}`}
                        onClick={() => setActiveNav(item.id)}
                        type='button'
                    >
                        <span className='report-tabs__icon'>{item.icon}</span>
                        <span>{item.label.replace(' Questions', '')}</span>
                    </button>
                ))}
            </div>

            <div className='report-shell'>
                <aside className='report-drawer'>
                    <div className='report-drawer__section-title'>SECTIONS</div>
                    <nav className='report-drawer__nav'>
                        {NAV_ITEMS.map(item => (
                            <button
                                key={item.id}
                                className={`report-drawer__item ${activeNav === item.id ? 'report-drawer__item--active' : ''}`}
                                onClick={() => setActiveNav(item.id)}
                                type='button'
                            >
                                <span className='report-drawer__icon'>{item.icon}</span>
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </nav>

                    <div className='report-drawer__actions'>
                        <button
                            onClick={() => { getResumePdf(interviewId) }}
                            className='report-action report-action--primary'
                            type='button'
                        >
                            Download Resume
                        </button>
                        <button
                            onClick={handleDeleteReport}
                            className='report-action report-action--danger'
                            type='button'
                        >
                            Delete Report
                        </button>
                    </div>
                </aside>

                <main className='report-main'>
                    <div className='report-summary-grid'>
                        <section className='summary-card summary-card--score'>
                            <h2>Match Score</h2>
                            <div className={`summary-score ${scoreColor}`}>
                                <div className='summary-score__ring' aria-hidden='true'>
                                    <span />
                                </div>
                                <div className='summary-score__value'>
                                    <strong>{report.matchScore}%</strong>
                                </div>
                            </div>
                            <p className='summary-card__caption'>Strong match for this role</p>
                        </section>

                        <section className='summary-card summary-card--gaps'>
                            <h2>Skill Gaps</h2>
                            <div className='summary-gaps'>
                                {normalizedSkillGaps.map((gap, i) => (
                                    <span key={i} className={`summary-tag summary-tag--${gap.severity}`}>
                                        {gap.skill}
                                    </span>
                                ))}
                                {normalizedSkillGaps.length > 0 && (
                                    <span className='summary-tag summary-tag--muted'>
                                        + {Math.max(0, normalizedSkillGaps.length - 3)} more minor gaps
                                    </span>
                                )}
                            </div>
                            <div className='summary-coach'>
                                <div className='summary-coach__icon'>
                                    <span className='material-symbols-outlined'>lightbulb</span>
                                </div>
                                <p>
                                    AI Coach: Focus on {normalizedSkillGaps[0]?.skill || 'the largest gap'} to bridge the primary architecture gap.
                                </p>
                            </div>
                        </section>
                    </div>

                    <section className='report-section'>
                        <div className='report-section__header'>
                            <div>
                                <h2>
                                    {activeNav === 'technical'
                                        ? 'Technical Questions'
                                        : activeNav === 'behavioral'
                                            ? 'Behavioral Questions'
                                            : 'Preparation Road Map'}
                                </h2>
                                <span className='report-section__count'>
                                    {activeNav === 'technical'
                                        ? `${technicalQuestions.length} questions`
                                        : activeNav === 'behavioral'
                                            ? `${behavioralQuestions.length} questions`
                                            : `${report.preparationPlan.length}-day plan`}
                                </span>
                            </div>
                            <button className='report-section__filter' type='button'>
                                Filter <span className='material-symbols-outlined'>filter_list</span>
                            </button>
                        </div>

                        {activeNav === 'technical' && (
                            <div className='report-list'>
                                {technicalQuestions.map((q, i) => (
                                    <QuestionCard key={i} item={q} index={i} />
                                ))}
                            </div>
                        )}

                        {activeNav === 'behavioral' && (
                            <div className='report-list'>
                                {behavioralQuestions.map((q, i) => (
                                    <QuestionCard key={i} item={q} index={i} />
                                ))}
                            </div>
                        )}

                        {activeNav === 'roadmap' && (
                            <>
                                <section className='roadmap-hero'>
                                    <h2>Your Preparation Path</h2>
                                    <p>
                                        We&apos;ve prepared a compact plan focused on revising matching skills and closing identified gaps.
                                    </p>
                                    <div style={{ marginTop: '0.6rem' }}>
                                        <button className='report-action report-action--primary' type='button' onClick={handleGeneratePlan} disabled={planLoading}>
                                            {planLoading ? 'Generating...' : 'Auto-generate Plan'}
                                        </button>
                                    </div>
                                </section>

                                <div className='roadmap-list'>
                                    {roadmapSteps.map((day, index) => (
                                        <RoadMapDay key={day.day || index} day={day} index={index} reportId={report._id} refreshReport={getReportById} />
                                    ))}
                                </div>

                                <section className='mentor-card'>
                                    <div className='mentor-card__inner'>
                                        <div className='mentor-card__profile'>
                                            <div className='mentor-card__avatar'>
                                                <span className='material-symbols-outlined'>psychology</span>
                                            </div>
                                            <div>
                                                <p className='mentor-card__label'>Mentor Insight</p>
                                                <p className='mentor-card__name'>Confidence Coach AI</p>
                                            </div>
                                        </div>
                                        <h4>"Focus on the MongoDB indexing first."</h4>
                                        <p>{mentorGuidance}</p>
                                        <button className='mentor-card__button' type='button' onClick={handleExploreDetailedGuide}>
                                            Explore Detailed Guide
                                            <span className='material-symbols-outlined'>arrow_forward</span>
                                        </button>
                                    </div>
                                </section>
                            </>
                        )}

                        {activeNav !== 'roadmap' && !practiceActive && (
                            <div className='practice-card'>
                                <div className='practice-card__content'>
                                    <h3>Ready to Practice?</h3>
                                    <p>Start an AI mock interview based on these specific technical questions to refine your answers.</p>
                                    <button className='practice-card__button' type='button' onClick={handleStartSimulation}>Start Simulation</button>
                                </div>
                                <div className='practice-card__icon' aria-hidden='true'>
                                    <span className='material-symbols-outlined'>video_chat</span>
                                </div>
                            </div>
                        )}

                        {practiceActive && activeNav !== 'roadmap' && currentPracticeQuestion && (
                            <section className='practice-session'>
                                <div className='practice-session__header'>
                                    <div>
                                        <span className='practice-session__kicker'>Live AI Practice</span>
                                        <h3>{practiceMode === 'behavioral' ? 'Behavioral Interview' : 'Technical Interview'}</h3>
                                    </div>
                                    <button type='button' className='practice-session__close' onClick={() => setPracticeActive(false)}>
                                        <span className='material-symbols-outlined'>close</span>
                                    </button>
                                </div>

                                <div className='practice-session__question'>
                                    <span className='practice-session__index'>Q{practiceIndex + 1}</span>
                                    <div>
                                        <p className='practice-session__label'>Question</p>
                                        <h4>{currentPracticeQuestion.question}</h4>
                                        <p className='practice-session__intention'>{currentPracticeQuestion.intention}</p>
                                    </div>
                                </div>

                                <label className='practice-session__field'>
                                    <span>Your Answer</span>
                                    <textarea
                                        value={practiceAnswer}
                                        onChange={(e) => setPracticeAnswer(e.target.value)}
                                        placeholder='Speak as if you are in the interview. Include context, action, and measurable result.'
                                        rows={6}
                                    />
                                </label>

                                <div className='practice-session__actions'>
                                    <button
                                        type='button'
                                        className='practice-session__submit'
                                        onClick={handleSubmitPracticeAnswer}
                                        disabled={practiceLoading || !practiceAnswer.trim()}
                                    >
                                        {practiceLoading ? 'Evaluating...' : 'Submit Answer'}
                                    </button>

                                    {practiceFeedback && (
                                        <button type='button' className='practice-session__next' onClick={handleNextPracticeQuestion}>
                                            {practiceIndex + 1 < currentPracticeQuestions.length ? 'Next Question' : 'Finish Practice'}
                                        </button>
                                    )}
                                </div>

                                {practiceFeedback && (
                                    <div className='practice-session__feedback'>
                                        <div className='practice-session__score'>
                                            <strong>{practiceFeedback.score}%</strong>
                                            <span>AI Score</span>
                                        </div>
                                        <p className='practice-session__summary'>{practiceFeedback.summary}</p>
                                        <div className='practice-session__list'>
                                            <div>
                                                <h5>Strengths</h5>
                                                <ul>
                                                    {practiceFeedback.strengths?.map((item, index) => <li key={index}>{item}</li>)}
                                                </ul>
                                            </div>
                                            <div>
                                                <h5>Improve</h5>
                                                <ul>
                                                    {practiceFeedback.improvements?.map((item, index) => <li key={index}>{item}</li>)}
                                                </ul>
                                            </div>
                                        </div>
                                        <div className='practice-session__suggestion'>
                                            <h5>Suggested Answer</h5>
                                            <p>{practiceFeedback.suggestedAnswer}</p>
                                        </div>
                                        <div className='practice-session__followup'>
                                            <span className='material-symbols-outlined'>psychology_alt</span>
                                            <p>{practiceFeedback.followUpQuestion}</p>
                                        </div>
                                    </div>
                                )}
                            </section>
                        )}
                    </section>
                </main>
            </div>

            <nav className='report-bottom-nav'>
                <button type='button' className='report-bottom-nav__item' onClick={() => setActiveNav('technical')}>
                    <span className='material-symbols-outlined'>dashboard</span>
                    <span>Dashboard</span>
                </button>
                <button type='button' className='report-bottom-nav__item' onClick={() => setActiveNav('behavioral')}>
                    <span className='material-symbols-outlined'>video_chat</span>
                    <span>Interviews</span>
                </button>
                <button type='button' className='report-bottom-nav__item report-bottom-nav__item--active' onClick={() => setActiveNav('roadmap')}>
                    <span className='material-symbols-outlined'>analytics</span>
                    <span>Reports</span>
                </button>
                <button type='button' className='report-bottom-nav__item' onClick={() => navigate('/')}>
                    <span className='material-symbols-outlined'>person</span>
                    <span>Profile</span>
                </button>
            </nav>
        </div>
    )
}

export default Interview