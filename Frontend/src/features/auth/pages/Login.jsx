import React from 'react'
import '../auth.form.scss'
import { Link } from 'react-router'
import { useAuth } from '../Hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const Login = () => {

    const { loading, login: handleLogin } = useAuth();
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const navigate = useNavigate();

    
    const handleSubmit = async (e) =>{
        e.preventDefault();
        await handleLogin({email, password});
        navigate('/'); // Redirect to home page after successful login
    }

    if(loading){
        return <p>Loading...</p>
    }

  return (
    <main>
        <div className="form-container">
            <h1>Login</h1>

            <form onSubmit={handleSubmit} >
                <div className="input-group">
                    <label htmlFor="email">Email</label>
                    <input onChange={(e) => setEmail(e.target.value)} type="email" id="email" name="email" required  placeholder='Enter Your Email'/>
                </div>
                <div className="input-group">
                    <label htmlFor="password">Password</label>
                    <input onChange={(e) => setPassword(e.target.value)} type="password" id="password" name="password" required  placeholder='Enter Your Password'/>
                </div>
                <button className="button primary-button" type="submit" disabled={loading}>
                    {loading ? 'Logging in...' : 'Login'}
                </button>
            </form>

              <p>Don't have an account? <Link to="/register">Register here</Link></p>
        </div>
    </main>
  )
}

export default Login