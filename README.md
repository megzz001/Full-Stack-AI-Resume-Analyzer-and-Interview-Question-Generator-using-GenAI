# Full-Stack-AI-Resume-Analyzer-and-Interview-Question-Generator-using-GenAI
A full-stack web application that leverages Generative AI to help job seekers prepare for interviews. Users can upload their resume and a target job description, and the system analyzes both to identify skill gaps, generate interview questions, and create a personalized preparation plan. It also supports secure authentication and future AI-powered resume optimization.

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

## 🛠️ Tech Stack

### Backend:
- Node.js
- Express.js
- MongoDB (Mongoose ODM)
- JWT (Authentication)
- bcryptjs (Password Hashing)
- cookie-parser
- dotenv

### Frontend (Planned):
- React.js
- scss

### AI Integration (Planned):
- Google Gemini API

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
