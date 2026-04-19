import React from 'react'
import '../auth.form.scss'
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../Hooks/useAuth';

const Register = () => {
    const navigate = useNavigate();
    const [username, setUsername] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
    const [errors, setErrors] = React.useState({});
    const [acceptTerms, setAcceptTerms] = React.useState(false);
    const [passwordStrength, setPasswordStrength] = React.useState(0);
    const { loading, register: handleRegister } = useAuth();

    const checkPasswordStrength = (val) => {
        let score = 0;
        if (val.length >= 8) score++;
        if (/[A-Z]/.test(val)) score++;
        if (/[0-9]/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;
        setPasswordStrength(score);
    };

    const validateForm = () => {
        const newErrors = {};
        if (!username) newErrors.username = 'Username is required';
        if (username && username.length < 3) newErrors.username = 'Username must be at least 3 characters';
        if (!email) newErrors.email = 'Email is required';
        if (!password) newErrors.password = 'Password is required';
        if (password && password.length < 6) newErrors.password = 'Password must be at least 6 characters';
        if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
        if (!acceptTerms) newErrors.terms = 'You must accept the terms and conditions';
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
        await handleRegister({ username, email, password });
        navigate('/login');
    }

    const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    const strengthClass = ['', 'weak', 'fair', 'good', 'strong'];

    return (
        <main className="auth-main">
            <div className="auth-container register-container">

                {/* Left Section - Hero */}
                <div className="auth-hero">
                    <div className="hero-content">
                        <div className="logo-section">
                            <div className="logo">
                                <span className="logo-icon">R</span>
                            </div>
                            <h2>Resume AI</h2>
                        </div>
                        <div className="hero-text">
                            <h1>Join Us Today</h1>
                            <p>Start your journey to landing your dream job with AI-powered insights</p>
                        </div>
                        <div className="features-list">
                            <div className="feature-item">
                                <span className="feature-icon">⚡</span>
                                <span>Quick Start</span>
                            </div>
                            <div className="feature-item">
                                <span className="feature-icon">◈</span>
                                <span>Secure &amp; Safe</span>
                            </div>
                            <div className="feature-item">
                                <span className="feature-icon">◎</span>
                                <span>Free Trial</span>
                            </div>
                        </div>
                    </div>
                    <div className="gradient-orb"></div>
                </div>

                {/* Right Section - Form */}
                <div className="form-section">
                    <div className="form-wrapper">
                        <div className="form-header">
                            <h1>Create Account</h1>
                            <p>Join thousands of professionals improving their careers</p>
                        </div>

                        <form onSubmit={handleSubmit} className="auth-form">

                            <div className="input-group">
                                <label htmlFor="username">Full Name</label>
                                <div className="input-wrapper">
                                    <input
                                        onChange={(e) => {
                                            setUsername(e.target.value);
                                            if (errors.username) setErrors({ ...errors, username: '' });
                                        }}
                                        type="text"
                                        id="username"
                                        name="username"
                                        required
                                        placeholder="John Doe"
                                        className={errors.username ? 'error' : ''}
                                    />
                                    <span className="input-icon">◎</span>
                                </div>
                                {errors.username && <span className="error-text">{errors.username}</span>}
                            </div>

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
                                            checkPasswordStrength(e.target.value);
                                            if (errors.password) setErrors({ ...errors, password: '' });
                                        }}
                                        type={showPassword ? 'text' : 'password'}
                                        id="password"
                                        name="password"
                                        required
                                        placeholder="Min. 6 characters"
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
                                {password && (
                                    <div className="password-strength">
                                        <div className="strength-bars">
                                            {[1, 2, 3, 4].map((bar) => (
                                                <div
                                                    key={bar}
                                                    className={`strength-bar ${passwordStrength >= bar ? strengthClass[passwordStrength] : ''}`}
                                                />
                                            ))}
                                        </div>
                                        <span className={`strength-label ${strengthClass[passwordStrength]}`}>
                                            {strengthLabel[passwordStrength]}
                                        </span>
                                    </div>
                                )}
                                {errors.password && <span className="error-text">{errors.password}</span>}
                            </div>

                            <div className="input-group">
                                <label htmlFor="confirmPassword">Confirm Password</label>
                                <div className="input-wrapper">
                                    <input
                                        onChange={(e) => {
                                            setConfirmPassword(e.target.value);
                                            if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
                                        }}
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        required
                                        placeholder="Re-enter password"
                                        className={errors.confirmPassword ? 'error' : ''}
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    >
                                        {showConfirmPassword ? '◉' : '○'}
                                    </button>
                                </div>
                                {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
                            </div>

                            <label className="terms-checkbox">
                                <input
                                    type="checkbox"
                                    checked={acceptTerms}
                                    onChange={(e) => {
                                        setAcceptTerms(e.target.checked);
                                        if (errors.terms) setErrors({ ...errors, terms: '' });
                                    }}
                                />
                                <span>I agree to the <Link to="#" className="link-highlight">Terms &amp; Conditions</Link></span>
                            </label>
                            {errors.terms && <span className="error-text">{errors.terms}</span>}

                            <button className="submit-btn" type="submit" disabled={loading}>
                                {loading ? (
                                    <>
                                        <span className="spinner"></span>
                                        Creating Account...
                                    </>
                                ) : 'Create Account →'}
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
                            <button type="button" className="social-btn github">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                                </svg>
                                GitHub
                            </button>
                        </div>

                        <div className="form-footer">
                            <p>Already have an account? <Link to="/login" className="link-highlight">Login here</Link></p>
                        </div>
                    </div>
                </div>

            </div>
        </main>
    )
}

export default Register