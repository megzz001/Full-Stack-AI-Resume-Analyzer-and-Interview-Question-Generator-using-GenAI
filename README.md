# Full-Stack-AI-Resume-Analyzer-and-Interview-Question-Generator-using-GenAI
A full-stack web application that leverages Generative AI to help job seekers prepare for interviews. Users can upload their resume and a target job description, and the system analyzes both to identify skill gaps, generate interview questions, and create a personalized preparation plan. It also supports secure authentication and future AI-powered resume optimization.

---
## 🛠️ Tech Stack

### 🚀 Backend
[![Node.js](https://img.shields.io/badge/Node.js-Backend-green)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-Framework-black)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Database-brightgreen)](https://www.mongodb.com/)
[![Mongoose](https://img.shields.io/badge/Mongoose-ODM-red)](https://mongoosejs.com/)
[![JWT](https://img.shields.io/badge/JWT-Auth-orange)](https://jwt.io/)
[![bcryptjs](https://img.shields.io/badge/bcryptjs-Security-blue)](https://www.npmjs.com/package/bcryptjs)
[![cookie-parser](https://img.shields.io/badge/cookie--parser-Middleware-lightgrey)](https://www.npmjs.com/package/cookie-parser)
[![dotenv](https://img.shields.io/badge/dotenv-Config-yellow)](https://www.npmjs.com/package/dotenv)

### 🎨 Frontend
[![React.js](https://img.shields.io/badge/React.js-Frontend-blue)](https://react.dev/)
[![React Router](https://img.shields.io/badge/React_Router-Routing-purple)](https://reactrouter.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-Styling-38B2AC)](https://tailwindcss.com/)

### 🤖 AI Integration
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-AI-orange)](https://ai.google.dev/)
[![Google AI Studio](https://img.shields.io/badge/AI_Studio-Platform-blue)](https://aistudio.google.com/)

---

## 📌 Project Overview

This application is designed to streamline interview preparation using AI. It performs the following:

- 📄 Resume & Job Description Analysis  
- 📊 Skill Gap Identification  
- ❓ Technical & Behavioral Question Generation  
- 🧠 Personalized Preparation Plan Creation  
- 📑 ATS-Friendly Resume Generation *(planned)*  
- 🔐 Secure Authentication using JWT  

---

## 📁 Project Structure

src/
├── controllers/
│ └── auth.controller.js
├── routes/
│ └── auth.routes.js
├── models/
│ └── user.model.js
├── config/
│ └── database.js
├── app.js
└── server.js


---

## ⚙️ Node.js Server Initialization

Initialize project:

```bash
npm init -y
npm install express mongoose dotenv
```
---
## app.js
- Creates Express app instance
- Adds middleware
- Exports app

## 🚀 Server Startup (server.js)

## MongoDB Atlas Setup
- Create cluster (Free Tier - M0)
- Create database user
- Allow network access (0.0.0.0/0 for development)
- Get connection string

## Security Features
- Password hashing using bcrypt
- JWT authentication
- HTTP-only cookies (prevents XSS)
- Environment variables for secrets

## Future Enhancements
- AI Resume Analysis (Gemini API)
- Skill Gap Visualization Dashboard
- ATS Resume Generator
- Mock Interview Simulator
- React Frontend Integration

Author
Megha
