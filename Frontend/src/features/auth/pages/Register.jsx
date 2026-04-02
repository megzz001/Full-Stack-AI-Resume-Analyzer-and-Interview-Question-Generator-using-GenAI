import React from 'react'
import { useNavigate, Link } from 'react-router-dom';
import {useAuth} from '../Hooks/useAuth';


const Register = () => {
    const navigate = useNavigate();
    const [username, setUsername] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const { loading, register: handleRegister } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        await handleRegister({username, email, password});
        navigate('/login'); // Redirect to login page after successful registration
    }
  
    return (  
    <main>
        <div className="form-container">
            <h1>Register</h1>

            <form onSubmit={handleSubmit} >
                <div className="input-group">
                    <label htmlFor="username">username</label>
                    <input onChange={(e) => {setUsername(e.target.value)}} type="text" id="username" name="username" required placeholder='Enter Your username' />
                </div>
                <div className="input-group">
                    <label htmlFor="email">Email</label>
                    <input onChange={(e) => {setEmail(e.target.value)}} type="email" id="email" name="email" required placeholder='Enter Your Email' />
                </div>
                <div className="input-group">
                    <label htmlFor="password">Password</label>
                    <input onChange={(e) => {setPassword(e.target.value)}} type="password" id="password" name="password" required placeholder='Enter Your Password' />
                </div>
                <button className="button primary-button" type="submit" disabled={loading}>
                    {loading ? 'Registering...' : 'Register'}
                </button>
            </form>

            <p>Already have an account? <Link to="/login">Login here</Link></p>
        </div>
    </main >
  )
}
export default Register