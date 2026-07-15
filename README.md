# 🎙️ VerbaGreen – AI Voice Grammar Checker

An AI-powered **Voice Grammar Checker** that allows users to speak naturally, automatically corrects grammar using the **Groq AI API**, and reads the corrected sentence back using **Text-to-Speech**.


---

# 🌟 Features

## 🎤 Voice Recognition

* One-click microphone recording
* Real-time speech-to-text conversion
* Live transcript display
* Start and stop recording
* Graceful microphone permission handling
* Browser Speech Recognition API integration

---

## 🤖 AI Grammar Correction

Powered by **Groq AI** using:

```text
Model: llama-3.3-70b-versatile
```

The AI automatically corrects:

* Grammar
* Punctuation
* Capitalization
* Spelling mistakes
* Sentence structure

while preserving the original meaning of the text.

---

## 🔊 Text-to-Speech

After grammar correction, VerbaGreen can speak the corrected sentence aloud.

### Controls

* ▶️ Play
* ⏸️ Pause
* 🔄 Resume
* ⏹️ Stop

### Customization

* Voice selector
* Volume control
* Speech rate adjustment
* Pitch adjustment

---

## ✍️ Manual Input Mode

Users can also:

* Type text manually
* Correct grammar without using the microphone
* Speak the corrected text
* Clear text instantly

---

## 📊 Live Statistics

For both original and corrected text, VerbaGreen displays:

* Character count
* Word count
* Reading time
* Speaking time

---

## 📜 Session History

Every grammar check is stored locally in the browser.

Each history item includes:

* Date and time
* Original text
* Corrected text
* Replay functionality
* Copy button
* Delete option

---

## 📥 Export & Sharing

Users can:

* Copy corrected text
* Download as TXT
* Download as PDF
* Share using the Web Share API (supported browsers)

---

## ⚙️ Engine Settings

The Settings panel includes:

* Groq API Key configuration
* Show/Hide API Key
* Save API key locally
* Delete API key
* API connection testing
* API status indicator

**No API key is hardcoded.**

---

# 🎨 User Interface

VerbaGreen features a modern and responsive design with:

* Glassmorphism UI
* Animated backgrounds
* Smooth transitions
* Mobile-first design
* Dark and Light themes
* AI processing animations
* Microphone recording animations
* Beautiful typography

---

# 🛠️ Tech Stack

| Technology           | Usage                 |
| -------------------- | --------------------- |
| HTML5                | Structure             |
| CSS3                 | Styling               |
| Vanilla JavaScript   | Application Logic     |
| Web Speech API       | Speech Recognition    |
| Speech Synthesis API | Text-to-Speech        |
| Fetch API            | API Communication     |
| Groq API             | AI Grammar Correction |
| Local Storage        | Settings & History    |

---

# 🚀 Getting Started

## Clone the Repository

```bash
git clone https://github.com/your-username/VerbaGreen.git
```

---

# ⚠️ Error Handling

VerbaGreen gracefully handles:

* Empty input
* Microphone permission denied
* Unsupported browsers
* Invalid API key
* Network failures
* API rate limits
* Speech recognition errors
* Speech synthesis failures
* AI timeout issues

---

# 🔒 Privacy & Security

* No backend server is used.
* API keys remain in the user's browser.
* Voice recordings are never stored.
* Session history remains completely local.
* No user data is sent anywhere except to the Groq API for grammar correction.

---

# 📱 Responsive Design

Optimized for:

* 💻 Desktop
* 📱 Mobile
* 📟 Tablet

---

# 🔮 Future Enhancements

* Multi-language support
* Grammar explanation mode
* Export history to CSV
* Progressive Web App (PWA)
* Cloud synchronization
* Offline grammar correction
* Speech translation support
