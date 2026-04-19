# Full-Stack-AI-Resume-Analyzer-and-Interview-Question-Generator-using-GenAI
A full-stack web application that leverages Generative AI to help job seekers prepare for interviews. Users can upload their resume and a target job description, and the system analyzes both to identify skill gaps, generate interview questions, and create a personalized preparation plan. It also supports secure authentication and future AI-powered resume optimization.

---
## 📸 Application Preview

### 🔐 Authentication (Signup Page)
![Signup](/assets/register.png)
![Login](/assets/login.png)

### 📊 Generated Reports & History
![Reports](/assets/home.png)

### 🎯 Custom Interview Plan Generator
![Interview Plan](/assets/InterviewQuestion.png)

### 🗺️ Preparation Roadmap
![Preparation Roadmap](/assets/preparation.png)

### 🗺️ Question Structure
![Question](/assets/FullQuestion.png)

### 🛄 Result
![Result](/assets/Result.png)
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

## ⭐ Key Highlights & Features

### 🎯 **AI-Powered Interview Preparation**
- **Smart Resume Analysis**: Extracts and parses PDF resumes using `pdf-parse` v2.4.5 with proper font data handling
- **Intelligent Matching**: Compares candidate profile against job requirements with real-time match scoring (0-100%)
- **Personalized Questions**: Generates 10+ unique technical questions and 3 behavioral questions tailored to the role

### 🔄 **Resilient AI Integration**
- **Multi-Model Fallback Strategy**: Supports Gemini 2.5, 2.0, and 1.5 families with intelligent fallback to ensure reliability
- **Graceful Degradation**: Provides deterministic fallback reports when AI is unavailable, maintaining application uptime
- **Error Recovery**: Comprehensive error handling for API quota limits, model unavailability, and network issues

### 📊 **Comprehensive Skill Analysis**
- **Skill Gap Identification**: Detects 3-5 critical skill gaps with severity levels (low/medium/high)
- **5-Day Preparation Roadmap**: Creates day-by-day study plan with specific focus areas and actionable tasks
- **Intent-Based Learning**: Each question includes interviewer's intent and detailed model answers with trade-offs

### 📝 **Resume Processing & Generation**
- **PDF Resume Upload**: Securely extracts text from PDF files with proper font handling
- **ATS-Friendly Generation**: Creates downloadable, optimized resumes tailored to job descriptions
- **Puppeteer Integration**: Generates high-quality PDF outputs from HTML templates with professional styling

### 🔐 **Enterprise-Grade Security**
- **JWT Authentication**: Secure token-based session management with HttpOnly cookies
- **Password Hashing**: bcryptjs integration for secure credential storage
- **Token Blacklisting**: Logout support with token invalidation mechanism
- **Protected Routes**: All interview operations require authenticated user context

### 💾 **Data Persistence & Management**
- **MongoDB Atlas Integration**: Cloud-based data storage with automatic backups
- **Relational Schema Design**: Properly normalized collections for users, interview reports, and token blacklists
- **Report History**: Full audit trail of all generated interview reports with timestamps
- **Selective Queries**: Optimized database queries with field projection to reduce payload size

### 🎨 **Responsive & Intuitive UI**
- **Multi-Section Navigation**: Tab-based interface for Technical Questions, Behavioral Questions, and Roadmap
- **Expandable Question Cards**: Clean UI for viewing question, intention, and model answer
- **Visual Scoring**: Color-coded match score indicator (green 80+, orange 60-79, red <60)
- **Real-Time State Management**: Context API for seamless data flow between components

### 🛡️ **Data Quality & Normalization**
- **Malformed Data Recovery**: Robust parsing logic for legacy and corrupted data formats
- **Question Merging**: Automatically combines split question/intention/answer entries into coherent cards
- **Skill Gap Parsing**: Handles various JSON and key-value formats for skill data
- **Content Validation**: Ensures no template placeholders or incomplete data in generated reports

### ⚡ **Performance Optimizations**
- **Multipart Form Handling**: Efficient file upload with multer middleware
- **Response Compression**: Selective field projection to minimize API payload
- **Iterative Generation**: Fallback to smaller batch requests (3 technical + 2 behavioral per iteration)
- **Browser Optimization**: Client-side data normalization to reduce server load

### 📱 **Full-Stack Architecture**
- **Stateless API Design**: RESTful endpoints with clear separation of concerns
- **Middleware Pipeline**: Express middleware for authentication, error handling, and validation
- **Controller-Service Pattern**: Clean code organization with business logic separation
- **Zod Validation**: Schema validation for AI responses ensures type safety

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
