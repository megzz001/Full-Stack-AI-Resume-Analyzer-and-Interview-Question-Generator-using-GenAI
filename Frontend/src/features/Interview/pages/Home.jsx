import React, { useState, useRef, useEffect } from 'react'
import "../styles/home.scss"
import { useInterview } from '../hooks/useInterview.js'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/Hooks/useAuth.js'

const Home = () => {

    const { loading, generateReport, reports, getReports } = useInterview()
    const { logout, user } = useAuth()
    const [jobDescription, setJobDescription] = useState("")
    const [selfDescription, setSelfDescription] = useState("")
    const [errorMessage, setErrorMessage] = useState("")
    const [selectedResume, setSelectedResume] = useState(null)
    const resumeInputRef = useRef()

    const navigate = useNavigate()
    const isAuthenticated = Boolean(user)

    const latestReport = reports?.[0]
    const prepScore = latestReport?.matchScore ?? 70

    const handleScrollToForm = () => {
        if (!isAuthenticated) {
            navigate('/login')
            return
        }

        const formSection = document.getElementById('plan-builder')
        if (formSection) {
            formSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }

    const handleScrollToReports = () => {
        const reportsSection = document.getElementById('recent-reports')
        if (reportsSection) {
            reportsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }

    const handleLoginClick = () => {
        navigate('/login')
    }

    const handleSignupClick = () => {
        navigate('/register')
    }

    // Fetch previous interview reports when user logs in
    useEffect(() => {
        if (user) {
            getReports()
        }
    }, [user])

    const handleGenerateReport = async () => {
        if (!isAuthenticated) {
            navigate('/login')
            return
        }

        const resumeFile = resumeInputRef.current.files[0]
        setErrorMessage("")

        if (!jobDescription.trim()) {
            setErrorMessage("Please add the job description.")
            return
        }

        if (!resumeFile && !selfDescription.trim()) {
            setErrorMessage("Please upload a resume PDF or provide a self description.")
            return
        }

        try {
            const data = await generateReport({ jobDescription, selfDescription, resumeFile })
            if (!data?._id) {
                setErrorMessage("Report generation failed. Please try again.")
                return
            }
            navigate(`/interview/${data._id}`)
        } catch (error) {
            setErrorMessage(error.message || "Failed to generate report.")
        }
    }

    const handleResumeChange = (e) => {
        const file = e.target.files?.[0] || null
        setSelectedResume(file)
    }

    const handleLogout = async () => {
        await logout()
        navigate('/login')
    }

    if (loading) {
        return (
            <main className='loading-screen'>
                <div className='loading-screen__badge'>InterviewPro AI</div>
                <h1>Loading your interview plan...</h1>
                <p>Preparing your custom strategy workspace.</p>
            </main>
        )
    }

    return (
        <div className='home-page'>

            <header className='top-bar'>
                <div className='brand-mark'>
                    <span className='material-symbols-outlined'>psychology</span>
                    <span>InterviewPro</span>
                </div>
                {isAuthenticated ? (
                    <button className='top-bar__action' onClick={handleLogout}>Logout</button>
                ) : (
                    <div className='top-bar__actions'>
                        <button className='top-bar__action top-bar__action--ghost' onClick={handleLoginClick} type='button'>Login</button>
                        <button className='top-bar__action' onClick={handleSignupClick} type='button'>Sign Up</button>
                    </div>
                )}
            </header>

            <main className='page-shell'>
                {!isAuthenticated && (
                    <>
                        <section className='hero-section' id='overview'>
                            <div className='hero-section__glow hero-section__glow--one' />
                            <div className='hero-section__glow hero-section__glow--two' />
                            <div className='hero-section__content'>
                                <span className='pill'>
                                    <span className='material-symbols-outlined pill__icon'>auto_awesome</span>
                                    AI-Powered Mentorship
                                </span>
                                <h1>Create Your Custom Interview Plan</h1>
                                <p>
                                    Let our AI analyze job requirements and your profile to build a winning strategy.
                                </p>
                                <div className='hero-actions'>
                                    <button className='primary-action' onClick={handleScrollToForm} type='button'>
                                        {isAuthenticated ? 'Get Started - Build My Plan' : 'Login to Build My Plan'}
                                    </button>
                                    <button className='secondary-action' onClick={handleSignupClick} type='button'>
                                        Sign up free
                                    </button>
                                </div>
                                <div className='social-proof'>
                                    <div className='social-proof__avatars'>
                                        <img alt='User 1' src='https://lh3.googleusercontent.com/aida-public/AB6AXuAnzpI78-7jRfqwoMx7RAgt0qDJMCtYx1Lu4ag5NX3Ra7ntwvGHf7Kbu1J17-QEssZF3TqJEdUzr3xiOpAt8EhtungzZrq2FsrH-Eq7ReKiUz7bnofKe5q-4sMhNFoqBmUhr7yTiupG0mh9sUM8whvnTwbkIL2OH05L_597oqTjSOuqelF-7ybhHO2LqnBHhELaBUnyYZUFj3QIn1g1hHP_VHB-U7oF6ccQMSkCQIM8L_yu_qA8yuiijqLUiKZrQOAGSyDH1jdNsXTn' />
                                        <img alt='User 2' src='https://lh3.googleusercontent.com/aida-public/AB6AXuBB5o0xsuxwSfRjz9T0etw4iAfDEarYHf5w3RJ6C6bKtrGih9IgnZUPPLw1qG7_YPqN91tKTCVX-Ut6gSOFYCU22of7yTxkNQMo0bJ1e4YHrDWRmgaIP6V1wNNqHtTe58WMZNwLeob4AEOjMOY0cYiQ8_MwQ3LXgJs82FYjRKDqKi4fXyHWK7H2dX1u9th8PlOiUJ_kNOjnvnZs6H5ZS-qVoWlkkqXWKNHPut0EyJJAgwlqsZWEGOn8ZMGeYJuLSnvUSwvBhT9XgRZd' />
                                        <img alt='User 3' src='https://lh3.googleusercontent.com/aida-public/AB6AXuAQ0Au1DVrN5VeCGvwCc-h-16VHF64fhhPXVWc_eCPi7VKi0jkU5HJLyfAjIRlZdRXfGB4bMD4jd3VOaQpLXdbst_6eXLY-3pN9OteHDexxGrzigPYXXyuACAiyAK-LEYbMb-lxh4OjMM63MOaVqh_TQTIdwj-BaTGD0Jx4SspFTc_Z12vEdKPzC7Vmcyz0ik5jW88FyIt0w3R-taCJ5Eg-a7m4i0WWtj16ug-DRUsVpCmq8M0dsHJeaRJT4MdJU1Yc1cHH_KkQI-ws' />
                                        <div className='social-proof__count'>+10k</div>
                                    </div>
                                    <p>Join 10,000+ candidates winning their dream jobs.</p>
                                </div>
                            </div>
                        </section>

                        <section className='feature-section' aria-labelledby='precision-preparation'>
                            <h2 id='precision-preparation'>Precision Preparation</h2>
                            <div className='feature-grid'>
                                <article className='feature-card'>
                                    <div className='feature-card__icon feature-card__icon--blue'>
                                        <span className='material-symbols-outlined'>analytics</span>
                                    </div>
                                    <h3>Job Analysis</h3>
                                    <p>We dissect job descriptions to identify the exact skills and keywords recruiters are hunting for.</p>
                                </article>
                                <article className='feature-card'>
                                    <div className='feature-card__icon feature-card__icon--teal'>
                                        <span className='material-symbols-outlined'>person_search</span>
                                    </div>
                                    <h3>Profile Matching</h3>
                                    <p>Sync your LinkedIn or CV to see exactly how you stack up against the role's specific requirements.</p>
                                </article>
                                <article className='feature-card'>
                                    <div className='feature-card__icon feature-card__icon--gold'>
                                        <span className='material-symbols-outlined'>track_changes</span>
                                    </div>
                                    <h3>Personalized Strategy</h3>
                                    <p>Receive a step-by-step roadmap tailored to bridge your gaps and highlight your unique strengths.</p>
                                </article>
                            </div>
                        </section>

                        <section className='insight-section'>
                            <div className='insight-section__badge'>AI Insight</div>
                            <h2>Smart Prep Score</h2>
                            <div className='insight-meter' aria-label={`Smart prep score ${prepScore} percent`}>
                                <svg viewBox='0 0 128 128' aria-hidden='true'>
                                    <circle className='insight-meter__track' cx='64' cy='64' r='56' />
                                    <circle
                                        className='insight-meter__progress'
                                        cx='64'
                                        cy='64'
                                        r='56'
                                        strokeDasharray='351.85'
                                        strokeDashoffset={351.85 - (351.85 * prepScore) / 100}
                                    />
                                </svg>
                                <div className='insight-meter__label'>
                                    <span>{prepScore}%</span>
                                    <small>Ready</small>
                                </div>
                            </div>
                            <p>
                                {latestReport?.title
                                    ? `Focus on the latest plan for ${latestReport.title}. The score reflects your most recent interview analysis.`
                                    : 'Focus on systems design and role-specific keywords. Your personalized analysis will appear after you generate a plan.'}
                            </p>
                        </section>
                    </>
                )}

                <section className='plan-section' id='plan-builder'>
                    <div className='plan-section__header'>
                        <div>
                            <span className='section-kicker'>Plan Builder</span>
                            <h2>Generate Your Interview Strategy</h2>
                        </div>
                        <button className='plan-section__scroll' type='button' onClick={handleScrollToReports}>View recent plans</button>
                    </div>

                    {isAuthenticated ? (
                        <>
                            <div className='plan-card'>
                                <div className='plan-card__column'>
                                    <label className='field-label' htmlFor='jobDescription'>Target Job Description <span>Required</span></label>
                                    <textarea
                                        id='jobDescription'
                                        value={jobDescription}
                                        onChange={(e) => { setJobDescription(e.target.value) }}
                                        className='text-field text-field--large'
                                        placeholder={`Paste the full job description here...\ne.g. 'Senior Frontend Engineer at Google requires proficiency in React, TypeScript, and large-scale system design...'`}
                                        maxLength={5000}
                                    />
                                    <div className='char-counter'>{jobDescription.length} / 5000 chars</div>
                                </div>

                                <div className='plan-card__column'>
                                    <label className='field-label'>Your Profile</label>
                                    <div className='upload-group'>
                                        <label className='upload-card' htmlFor='resume'>
                                            <span className='upload-card__icon material-symbols-outlined'>cloud_upload</span>
                                            <strong>Upload Resume</strong>
                                            <span>PDF. Best results when you upload a full resume.</span>
                                            <input ref={resumeInputRef} onChange={handleResumeChange} hidden type='file' id='resume' name='resume' accept='.pdf' />
                                        </label>
                                        {selectedResume && (
                                            <p className='upload-meta'>Selected: <strong>{selectedResume.name}</strong></p>
                                        )}
                                    </div>
                                    <div className='or-divider'><span>OR</span></div>
                                    <textarea
                                        id='selfDescription'
                                        name='selfDescription'
                                        value={selfDescription}
                                        onChange={(e) => { setSelfDescription(e.target.value) }}
                                        className='text-field text-field--short'
                                        placeholder="Briefly describe your experience, key skills, and years of experience if you don't have a resume handy..."
                                    />
                                    <div className='info-box'>
                                        <span className='material-symbols-outlined'>info</span>
                                        <p>Either a <strong>Resume</strong> or a <strong>Self Description</strong> is required to generate a personalized plan.</p>
                                    </div>
                                </div>
                            </div>

                            <div className='plan-actions'>
                                <span>AI-Powered Strategy Generation • Approx 30s</span>
                                <button onClick={handleGenerateReport} className='generate-btn' type='button'>
                                    <span className='material-symbols-outlined'>auto_awesome</span>
                                    Generate My Interview Strategy
                                </button>
                            </div>

                            {errorMessage && <p className='error-message'>{errorMessage}</p>}
                        </>
                    ) : (
                        <div className='auth-lockup'>
                            <div className='auth-lockup__card'>
                                <span className='material-symbols-outlined'>lock</span>
                                <h3>Login required to generate your report</h3>
                                <p>Sign in or create an account to upload a resume, add your profile, and generate your custom interview strategy.</p>
                                <div className='auth-lockup__actions'>
                                    <button type='button' className='generate-btn' onClick={handleLoginClick}>Login</button>
                                    <button type='button' className='secondary-action' onClick={handleSignupClick}>Sign Up</button>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {isAuthenticated && reports.length > 0 && (
                    <section className='recent-reports' id='recent-reports'>
                        <h2>My Recent Interview Plans</h2>
                        <div className='reports-list'>
                            {reports.map(report => (
                                <article key={report._id} className='report-item' onClick={() => navigate(`/interview/${report._id}`)}>
                                    <div className='report-item__top'>
                                        <h3>{report.title || 'Untitled Position'}</h3>
                                        <span className={`match-score ${report.matchScore >= 80 ? 'score--high' : report.matchScore >= 60 ? 'score--mid' : 'score--low'}`}>{report.matchScore}%</span>
                                    </div>
                                    <p className='report-item__meta'>Generated on {new Date(report.createdAt).toLocaleDateString()}</p>
                                </article>
                            ))}
                        </div>
                    </section>
                )}

                <footer className='page-footer'>
                    <div className='page-footer__brand'>
                        <span className='material-symbols-outlined'>psychology</span>
                        <span>InterviewPro AI</span>
                    </div>
                    <div className='page-footer__links'>
                        <a href='#'>Terms</a>
                        <a href='#'>Privacy</a>
                        <a href='#'>Contact</a>
                    </div>
                    <p>© 2026 InterviewPro AI. All rights reserved.</p>
                </footer>
            </main>

            <nav className='bottom-nav'>
                <button className='bottom-nav__item bottom-nav__item--active' type='button' onClick={handleScrollToForm}>
                    <span className='material-symbols-outlined'>home</span>
                    <span>Home</span>
                </button>
                <button className='bottom-nav__item' type='button' onClick={handleScrollToForm}>
                    <span className='material-symbols-outlined'>assignment</span>
                    <span>Plan</span>
                </button>
                <button className='bottom-nav__item' type='button' onClick={handleScrollToReports}>
                    <span className='material-symbols-outlined'>person</span>
                    <span>Profile</span>
                </button>
            </nav>
        </div>
    )
}

export default Home