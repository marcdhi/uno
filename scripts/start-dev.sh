#!/bin/bash

# Development startup script for the video editing app
# This script starts both the Next.js frontend/API and the Rust video processing server

set -e

echo "🚀 Starting Video Editing App Development Environment"

# Function to cleanup background processes
cleanup() {
    echo "🛑 Shutting down services..."
    if [ ! -z "$RUST_PID" ]; then
        kill $RUST_PID 2>/dev/null || true
    fi
    if [ ! -z "$NEXTJS_PID" ]; then
        kill $NEXTJS_PID 2>/dev/null || true
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust is not installed. Please install Rust from https://rustup.rs/"
    exit 1
fi

# Check if FFmpeg is available
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️  FFmpeg not found. Installing via Homebrew (macOS) or apt (Linux)..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &> /dev/null; then
            brew install ffmpeg
        else
            echo "❌ Please install Homebrew first: https://brew.sh/"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update && sudo apt-get install -y ffmpeg
    else
        echo "❌ Please install FFmpeg manually for your operating system"
        exit 1
    fi
fi

# Start Rust video processing server
echo "🦀 Starting Rust video processing server..."
cd video-processor-rust

# Build in release mode for better performance
echo "🔨 Building Rust server (release mode)..."
cargo build --release

# Start the server in the background
echo "🌟 Starting Rust server on port 3001..."
RUST_LOG=info ./target/release/video-processor &
RUST_PID=$!

# Wait a moment for the server to start
sleep 2

# Check if Rust server is running
if ! curl -s http://localhost:3001/health > /dev/null; then
    echo "❌ Rust server failed to start"
    cleanup
    exit 1
fi

echo "✅ Rust video processing server is running on http://localhost:3001"

# Go back to main directory
cd ..

# Install Node.js dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node.js dependencies..."
    pnpm install
fi

# Start Next.js development server
echo "⚡ Starting Next.js development server..."
RUST_VIDEO_SERVER_URL=http://localhost:3001 pnpm dev &
NEXTJS_PID=$!

echo "✅ Next.js app is starting on http://localhost:3000"
echo ""
echo "🎬 Video Editing App is ready!"
echo "   Frontend: http://localhost:3000"
echo "   Rust API: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for background processes
wait 