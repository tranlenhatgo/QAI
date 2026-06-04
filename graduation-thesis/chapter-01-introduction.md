# Chapter 1: Introduction

## 1.1 Background and Motivation

Online learning platforms give students access to more material than a classroom can provide, but common quiz workflows treat assessment as a fixed sequence of questions. A student answers a quiz, receives a score, and then decides alone what to review next. That workflow does not identify weak topics, schedule review, or connect quiz results with the student's own study materials.

Large Language Models (LLMs) make a more adaptive workflow possible. An LLM-based study coach can explain mistakes, generate practice questions, summarize uploaded notes, and connect past performance with future review. A quiz platform that combines those capabilities with spaced repetition helps students spend more time on material they have not mastered instead of repeating content they already know.

This project addresses that need through QAI, an AI-assisted quiz platform that combines quiz management, AI question generation, conversational study support, retrieval from uploaded materials, progress analytics, and review scheduling.

## 1.2 Problem Statement

Current quiz platforms share five limitations:

1. **Static content delivery**: Students receive predetermined questions that do not respond to their strengths or weaknesses.
2. **Limited feedback**: A typical quiz ends with a score, without guidance on what to study next.
3. **Weak retention support**: Platforms without spaced repetition leave students to manage review timing on their own, which increases forgetting over time.
4. **Poor material integration**: Students cannot use their own PDFs or notes as first-class sources for practice questions and explanations.
5. **Fragmented workflows**: Students switch between separate tools for quiz-taking, study coaching, review scheduling, and progress tracking.

These gaps waste study time. Students need one system that can assess current knowledge, explain mistakes, generate targeted practice, and schedule future review from the same learning record.

## 1.3 Objectives

This thesis presents **QAI**, an AI-Assisted Quiz Platform designed around these objectives:

1. **Develop an intelligent quiz platform** that supports quiz creation, sharing, and real-time gameplay with AI-generated questions.
2. **Implement an AI Study Coach** that gives personalized guidance through natural language conversation and uses tools to search materials, analyze history, and generate practice.
3. **Integrate spaced repetition** through the SM-2 algorithm, so the platform can schedule reviews from demonstrated mastery.
4. **Build a Retrieval-Augmented Generation (RAG) pipeline** that lets students upload study materials and receive questions grounded in their own content.
5. **Design a progress tracking system** that reports learning velocity, mastery by category, study streaks, and weak topics.
6. **Deliver a production-ready system** with three cooperating services: a Spring Boot backend, a Next.js frontend, and a FastAPI AI coach.

## 1.4 Scope

QAI includes these features:

- **Quiz management**: CRUD operations for quizzes and questions, category-based organization, and multi-user quiz rooms.
- **AI question generation**: Question generation from topics, uploaded files, and RAG-indexed materials through local LM Studio inference and the DeepSeek API.
- **Conversational AI coach**: WebSocket-based streaming chat with agentic tool use. The coach can navigate pages, start quizzes, analyze weaknesses, search the web, and retrieve study materials.
- **Spaced repetition engine**: SM-2 scheduling that tracks easiness, interval, and repetitions per category.
- **Progress analytics**: Score trends, mastery breakdown, learning velocity, and study streaks.
- **Document management**: Upload, indexing, and search for study materials through Supabase pgvector embeddings.
- **Notification system**: Review reminders and milestone alerts.

The project implements QAI as a Progressive Web Application (PWA) that students can install on mobile and desktop devices.

## 1.5 Contributions

This work contributes:

1. An integration of agentic LLM tool use with educational assessment, where the AI coach chooses when to search materials, generate practice, or analyze performance.
2. A RAG pipeline for educational content, covering PDF extraction, vector embedding, and similarity-based retrieval during quiz generation.
3. A dual-tier LLM architecture that supports local inference for privacy and offline use, plus cloud inference for higher-quality responses.
4. A three-service system coordinated through REST APIs, WebSocket streaming, and quiz-completion webhooks.

## 1.6 Thesis Organization

The thesis continues as follows:

- **Chapter 2** reviews intelligent tutoring systems, spaced repetition research, LLM-based education tools, and RAG architectures.
- **Chapter 3** presents the requirements analysis, including functional requirements, non-functional requirements, and use case specifications.
- **Chapter 4** details the system design, including architecture, data models, API contracts, AI coach design, and learning algorithms.
- **Chapter 5** describes the implementation of the three services, key technical decisions, and integration patterns.
- **Chapter 6** covers the testing strategy, evaluation methodology, and results.
- **Chapter 7** concludes with achievements, limitations, and future work.
