# SyncPad

SyncPad is a full-stack shared note workspace. Create a pad, share its URL, and edit with other people in real time.

## Features

- Live shared editing over Socket.IO
- Active user presence per pad
- Shareable pad URLs
- Auto-save to MongoDB
- Dark responsive interface
- No account required

## Tech Stack

Frontend: React, Vite, Tailwind CSS, React Router, Socket.IO Client.

Backend: Node.js, Express, Socket.IO, MongoDB with Mongoose, CORS, dotenv.

## Getting Started

Install dependencies with npm install and npm --prefix client install. Configure MONGODB_URI and VITE_API_URL before running locally.

## Verification

Open the same pad in two browser windows, type in one window, and confirm the other window updates with presence changes.