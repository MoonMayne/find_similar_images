#!/usr/bin/env python3
import sys
import os
from pathlib import Path
import traceback
import threading
import webbrowser
import time
import tkinter as tk
from tkinter import messagebox

# Add error logging to file
LOG_FILE = Path.home() / "FindSimilarImages_error.log"

def log_error(msg):
    with open(LOG_FILE, 'a') as f:
        f.write(f"{msg}\n")

# CRITICAL: Set environment variables BEFORE importing backend modules
if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys._MEIPASS)
else:
    BASE_DIR = Path(__file__).parent

# Set data directory to ~/Library/Application Support/FindSimilarImages
DATA_DIR = Path.home() / "Library" / "Application Support" / "FindSimilarImages"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Override config paths
os.environ['DB_PATH'] = str(DATA_DIR / "app.db")
os.environ['HASH_DB'] = str(DATA_DIR / "hash_cache.json")
os.environ['DATA_DIR'] = str(DATA_DIR)

log_error(f"Set DATA_DIR to: {DATA_DIR}")

# Import backend modules
import uvicorn
from backend.app import app

class FindSimilarImagesApp:
    def __init__(self):
        self.server = None
        self.server_thread = None
        self.server_running = False

        # Create main window
        self.root = tk.Tk()
        self.root.title("Find Similar Images")
        self.root.geometry("400x250")
        self.root.resizable(False, False)

        # Force light background for visibility in both themes
        self.root.configure(bg="#f5f5f5")

        # Configure window to handle close button
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)

        # Title
        title = tk.Label(
            self.root,
            text="Find Similar Images",
            font=("Arial", 18, "bold"),
            pady=20,
            bg="#f5f5f5",
            fg="#1f2937"
        )
        title.pack()

        # Status label
        self.status_label = tk.Label(
            self.root,
            text="Server Status: Starting...",
            font=("Arial", 12),
            bg="#f5f5f5",
            fg="#f59e0b"
        )
        self.status_label.pack(pady=10)

        # Button frame
        button_frame = tk.Frame(self.root, bg="#f5f5f5")
        button_frame.pack(pady=20)

        # Open Browser button (using Label styled as button for color support)
        self.open_button = tk.Label(
            button_frame,
            text="Open in Browser",
            font=("Arial", 12, "bold"),
            bg="#d1d5db",
            fg="#9ca3af",
            width=18,
            height=2,
            relief=tk.RAISED,
            bd=2,
            cursor="arrow"
        )
        self.open_button.grid(row=0, column=0, padx=10)
        self.open_button_enabled = False

        # Add hover effect for Open button
        def on_open_enter(e):
            if self.open_button_enabled:
                self.open_button.config(bg="#0d9488")

        def on_open_leave(e):
            if self.open_button_enabled:
                self.open_button.config(bg="#14b8a6")

        def on_open_click(e):
            if self.open_button_enabled:
                self.open_browser()

        self.open_button.bind("<Enter>", on_open_enter)
        self.open_button.bind("<Leave>", on_open_leave)
        self.open_button.bind("<Button-1>", on_open_click)

        # Quit button (using Label styled as button for color support)
        quit_button = tk.Label(
            button_frame,
            text="Quit",
            font=("Arial", 12, "bold"),
            bg="#ef4444",
            fg="white",
            width=18,
            height=2,
            relief=tk.RAISED,
            bd=2,
            cursor="hand2"
        )
        quit_button.grid(row=0, column=1, padx=10)

        # Add hover effect for Quit button
        def on_quit_enter(e):
            quit_button.config(bg="#dc2626")

        def on_quit_leave(e):
            quit_button.config(bg="#ef4444")

        def on_quit_click(e):
            self.quit_app()

        quit_button.bind("<Enter>", on_quit_enter)
        quit_button.bind("<Leave>", on_quit_leave)
        quit_button.bind("<Button-1>", on_quit_click)

        # Info label
        info = tk.Label(
            self.root,
            text="The web interface will open in your browser.\nYou can close the browser and reopen it anytime.",
            font=("Arial", 10),
            bg="#f5f5f5",
            fg="#6b7280"
        )
        info.pack(pady=10)

        # Start server automatically
        self.start_server()

    def start_server(self):
        """Start uvicorn server in background thread"""
        log_error("Starting server...")

        def run_server():
            config = uvicorn.Config(
                app,
                host="127.0.0.1",
                port=8000,
                log_level="error",
                access_log=False
            )
            self.server = uvicorn.Server(config)
            try:
                self.server.run()
            except Exception as e:
                log_error(f"Server error: {e}")

        self.server_thread = threading.Thread(target=run_server, daemon=True)
        self.server_thread.start()

        # Wait for server to start
        self.root.after(100, self.check_server_ready)

    def check_server_ready(self):
        """Check if server is ready"""
        import socket
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            result = sock.connect_ex(('127.0.0.1', 8000))
            sock.close()

            if result == 0:
                # Server is ready
                self.server_running = True
                self.status_label.config(
                    text="Server Status: Running",
                    fg="#10b981"
                )
                # Enable the open button
                self.open_button_enabled = True
                self.open_button.config(bg="#14b8a6", fg="white", cursor="hand2")
                log_error("Server started successfully")
                # Auto-open browser on first launch
                self.open_browser()
            else:
                # Keep checking
                self.root.after(100, self.check_server_ready)
        except Exception as e:
            log_error(f"Error checking server: {e}")
            self.root.after(100, self.check_server_ready)

    def open_browser(self):
        """Open browser to localhost:8000"""
        log_error("Opening browser...")
        webbrowser.open("http://localhost:8000")

    def quit_app(self):
        """Quit the application"""
        log_error("Quit requested")
        if messagebox.askyesno("Quit", "Are you sure you want to quit Find Similar Images?"):
            log_error("Shutting down...")
            self.root.destroy()
            sys.exit(0)

    def on_closing(self):
        """Handle window close button (same as Quit button)"""
        self.quit_app()

    def run(self):
        """Start the GUI"""
        log_error("Starting GUI...")
        self.root.mainloop()

if __name__ == "__main__":
    try:
        app = FindSimilarImagesApp()
        app.run()
    except Exception as e:
        log_error(f"Fatal error: {e}")
        log_error(traceback.format_exc())
        sys.exit(1)
