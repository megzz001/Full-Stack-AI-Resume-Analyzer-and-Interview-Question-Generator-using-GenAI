import React from 'react'
import '../auth.form.scss'
import { Link } from 'react-router'
import { useAuth } from '../Hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const Login = () => {

    const { loading, login: handleLogin } = useAuth();
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(false);
    const [errors, setErrors] = React.useState({});
    const navigate = useNavigate();

    const validateForm = () => {
        const newErrors = {};
        if (!email) newErrors.email = 'Email is required';
        if (!password) newErrors.password = 'Password is required';
        return newErrors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validationErrors = validateForm();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }
        setErrors({});

        try {
            const userData = await handleLogin({ email, password });
            if (userData?.user) {
                navigate('/', { replace: true });
            }
        } catch (error) {
            setErrors({ password: 'Invalid email or password' });
        }
    }

    return (
        <main className="auth-main">
            <header className="auth-topbar">
                <button className="auth-topbar__back" type="button" onClick={() => navigate(-1)} aria-label="Go back">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div className="auth-topbar__brand">InterviewPro</div>
                <div className="auth-topbar__spacer" />
            </header>

            <div className="auth-container">

                <div className="auth-hero">
                    <div className="hero-content">
                        <div className="logo-section">
                            <div className="logo">
                                <span className="material-symbols-outlined">psychology</span>
                            </div>
                            <h2>InterviewPro</h2>
                        </div>
                    </div>
                    <div className="gradient-orb"></div>
                </div>

                <div className="form-section">
                    <div className="form-wrapper">
                        <div className="form-header">
                            <div className="form-title-icon">
                                <span className="material-symbols-outlined">psychology</span>
                            </div>
                            <h1>Welcome Back</h1>
                            <p>Elevate your career preparation today.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="auth-form">
                            <div className="input-group">
                                <label htmlFor="email">Email Address</label>
                                <div className="input-wrapper">
                                    <input
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            if (errors.email) setErrors({ ...errors, email: '' });
                                        }}
                                        type="email"
                                        id="email"
                                        name="email"
                                        required
                                        placeholder="you@example.com"
                                        className={errors.email ? 'error' : ''}
                                    />
                                    <span className="input-icon">@</span>
                                </div>
                                {errors.email && <span className="error-text">{errors.email}</span>}
                            </div>

                            <div className="input-group">
                                <label htmlFor="password">Password</label>
                                <div className="input-wrapper">
                                    <input
                                        onChange={(e) => {
                                            setPassword(e.target.value);
                                            if (errors.password) setErrors({ ...errors, password: '' });
                                        }}
                                        type={showPassword ? 'text' : 'password'}
                                        id="password"
                                        name="password"
                                        required
                                        placeholder="Enter your password"
                                        className={errors.password ? 'error' : ''}
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? '◉' : '○'}
                                    </button>
                                </div>
                                {errors.password && <span className="error-text">{errors.password}</span>}
                            </div>

                            <div className="form-options">
                                <label className="remember-me">
                                    <input type="checkbox" />
                                    <span>Remember me</span>
                                </label>
                                <Link to="#" className="forgot-password">Forgot password?</Link>
                            </div>

                            <button className="submit-btn" type="submit" disabled={loading}>
                                {loading ? (
                                    <>
                                        <span className="spinner"></span>
                                        Logging in...
                                    </>
                                ) : 'Login'}
                            </button>
                        </form>

                        <div className="divider">
                            <span>or continue with</span>
                        </div>

                        <div className="social-login">
                            <button type="button" className="social-btn google">
                                <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908C16.658 14.18 17.64 11.9 17.64 9.2z" fill="#4285F4" />
                                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
                                    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
                                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
                                </svg>
                                Google
                            </button>
                            <button type="button" className="social-btn linkedin">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                                </svg>
                                LinkedIn
                            </button>
                        </div>

                        <div className="form-footer">
                            <p>Don't have an account? <Link to="/register" className="link-highlight">Sign Up</Link></p>
                        </div>
                    </div>
                </div>

            </div>

            <footer className="auth-footer">
                <div className="auth-footer__brand">InterviewPro</div>
                <p>© 2026 InterviewPro AI. All rights reserved.</p>
                <div className="auth-footer__links">
                    <Link to="#">Terms</Link>
                    <Link to="#">Privacy</Link>
                    <Link to="#">Contact</Link>
                </div>
            </footer>
        </main>
    )
}

export default Login