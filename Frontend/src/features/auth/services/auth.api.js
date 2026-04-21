import axios from "axios";
import { API_BASE_URL } from "../../../config/api.js";

const api = axios.create({
    baseURL: `${API_BASE_URL}/api/auth`,
    withCredentials: true
});

export async function register({ username, email, password }) {

    try {
        const response = await api.post('/register', {
            username,
            email,
            password
        });
        return response.data;
    } catch (error) {
        console.error('Error registering user:', error);
        throw error;
    }
}

export async function login({ email, password }) {
    try {
        const response = await api.post('/login', {
            email,
            password
        });
        return response.data;
    } catch (error) {
        console.error('Error logging in:', error);
        throw error;
    }
}

export async function logout() {
    try {
        const response = await api.post('/logout');
        return response.data;
    } catch (error) {
        console.error('Error logging out:', error);
        throw error;
    }
}

export async function getMe() {
    try {
        const response = await api.get('/get-me');
        return response.data;
    } catch (error) {
        console.error('Error fetching current user due to :', error);
        throw error;
    }
}