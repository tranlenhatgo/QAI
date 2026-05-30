# Chapter 1: Introduction

## 1.1 Background and Motivation

The modern educational landscape faces significant challenges in maintaining student engagement and ensuring effective knowledge retention. Traditional quiz platforms offer static question banks and linear progression, failing to adapt to individual learning patterns. Meanwhile, advances in Large Language Models (LLMs) and natural language processing have opened unprecedented opportunities for intelligent tutoring systems that can personalize the learning experience.

The proliferation of online learning, accelerated by global events, has created an urgent need for tools that combine assessment with adaptive guidance. Students often lack awareness of their own knowledge gaps, study inefficiently by reviewing already-mastered material, and disengage from platforms that offer no intelligent feedback. These issues motivate the development of an AI-assisted quiz platform that goes beyond simple question-and-answer mechanics.

## 1.2 Problem Statement

Existing quiz platforms suffer from several critical limitations:

1. **Static Content Delivery**: Questions are predetermined and do not adapt to the learner's demonstrated strengths and weaknesses.
2. **Absence of Intelligent Feedback**: After completing a quiz, students receive a score but no actionable guidance on how to improve.
3. **No Long-Term Retention Strategy**: Without spaced repetition scheduling, students forget material rapidly (Ebbinghaus forgetting curve).
4. **Limited Material Integration**: Students cannot leverage their own study materials (PDFs, notes) within the assessment workflow.
5. **Disconnected Learning Experience**: Quiz-taking, study coaching, and progress tracking exist as separate tools rather than an integrated ecosystem.

These gaps result in poor learning outcomes despite significant time investment by students. A system that unifies assessment, AI-driven coaching, and scientifically-grounded retention strategies would represent a meaningful advancement in educational technology.

## 1.3 Objectives

This thesis presents **QAI**, an AI-Assisted Quiz Platform designed to address the identified problems through the following objectives:

1. **Develop an intelligent quiz platform** that supports quiz creation, sharing, and real-time gameplay with AI-generated questions.
2. **Implement an AI Study Coach** that provides personalized, context-aware guidance through natural language conversation, with the ability to use tools (search materials, analyze history, generate practice).
3. **Integrate spaced repetition** using the SM-2 algorithm to optimize review scheduling based on demonstrated mastery.
4. **Build a Retrieval-Augmented Generation (RAG) pipeline** enabling students to upload study materials and receive questions generated from their own content.
5. **Design a progress tracking system** that provides actionable insights into learning velocity, mastery by category, and identified weaknesses.
6. **Deliver a production-ready system** with three cooperating services — Spring Boot backend, Next.js frontend, and FastAPI AI coach — demonstrating modern microservices architecture.

## 1.4 Scope

The system encompasses:

- **Quiz Management**: CRUD operations for quizzes and questions, category-based organization, multi-user quiz rooms.
- **AI Question Generation**: From topics, uploaded files, and RAG-indexed materials using LLM inference (both local via LM Studio and cloud via DeepSeek API).
- **Conversational AI Coach**: WebSocket-based streaming chat with agentic tool use — the AI can navigate pages, start quizzes, analyze weaknesses, search the web, and retrieve study materials.
- **Spaced Repetition Engine**: SM-2 algorithm implementation tracking easiness, interval, and repetitions per category.
- **Progress Analytics**: Score trends, mastery breakdown, learning velocity, study streaks.
- **Document Management**: Upload, index, and search study materials via Supabase pgvector embeddings.
- **Notification System**: Automated review reminders and milestone alerts.

The system is implemented as a Progressive Web Application (PWA), installable on mobile and desktop devices.

## 1.5 Contributions

The primary contributions of this work are:

1. A novel integration of agentic AI (tool-use LLM patterns) with educational assessment, where the AI coach autonomously decides when to search materials, generate practice, or analyze performance.
2. A complete RAG pipeline for educational content — from PDF extraction through vector embedding to similarity-based retrieval during quiz generation.
3. A dual-tier architecture supporting both local LLM inference (for privacy/offline use) and cloud-based inference (for quality), with automatic fallback.
4. Demonstration of a production three-service microservices system coordinated via REST, WebSocket, and webhook patterns.

## 1.6 Thesis Organization

The remainder of this thesis is organized as follows:

- **Chapter 2** reviews related work in intelligent tutoring systems, spaced repetition research, LLM-based education tools, and RAG architectures.
- **Chapter 3** presents the requirements analysis including functional requirements, non-functional requirements, and use case specifications.
- **Chapter 4** details the system design: architecture, data models, API contracts, AI coach design, and learning algorithms.
- **Chapter 5** describes the implementation of all three services, key technical decisions, and integration patterns.
- **Chapter 6** covers the testing strategy, evaluation methodology, and results.
- **Chapter 7** concludes with a summary of achievements, identified limitations, and directions for future work.
