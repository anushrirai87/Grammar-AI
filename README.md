You are an expert Full Stack Web Developer, UI/UX Designer, and AI Integration Engineer.

Create a fully responsive Voice Grammar Checker web application using only HTML, CSS, and Vanilla JavaScript (no React, Node.js, Express, PHP, or any backend). The application must use the Groq API to check grammar and generate corrected text.

Objective

The website should allow users to:

Speak into their microphone.
Convert speech into text using the browser's Speech Recognition API.
Send the transcribed text to the Groq AI API.
Receive grammatically corrected text.
Display the corrected sentence.
Convert the corrected sentence back into natural speech using the browser's Speech Synthesis API.
Allow users to listen to the corrected sentence.
Tech Stack
HTML5
CSS3
Vanilla JavaScript (ES6)
Web Speech API
SpeechRecognition
SpeechSynthesis
Fetch API
Groq API

No frameworks.

UI Requirements

Create a modern AI interface with:

Glassmorphism design
Animated gradient background
Responsive layout
Rounded cards
Beautiful typography
Dark/Light mode toggle
Smooth hover animations
Mobile friendly
Loading animations
Success animations
Error messages
Microphone animation while recording
AI typing effect while waiting
Features
1. Voice Recognition
Large microphone button
Start Recording
Stop Recording
Live transcript
Real-time speech recognition
Auto punctuation when possible
Handle recognition errors gracefully
2. Grammar Checking

Send the transcript to the Groq API.

Use a prompt similar to:

"Correct the grammar, punctuation, capitalization, spelling, and sentence structure of the following text. Keep the meaning exactly the same. Return only the corrected sentence."

Display:

Original Text

Corrected Text

Highlight changes elegantly.

3. Text-to-Speech

After AI returns the corrected sentence:

Automatically speak it.

Also include:

Play button
Pause
Resume
Stop
Voice selector
Speech rate slider
Pitch slider
Volume slider
4. Manual Mode

Allow users to type text manually.

Buttons:

Check Grammar
Speak Corrected Text
Clear
5. AI Settings

Create a Settings modal containing:

Groq API Key input
Show/Hide API Key
Save in localStorage
Remove API Key
API Connection Status
Test API button

Never hardcode the API key.

6. History

Save previous grammar checks locally.

Each history item should contain:

Date
Original text
Corrected text
Replay button
Copy button
Delete button
7. Copy & Download

Allow users to:

Copy corrected text
Download as TXT
Download as PDF
Share using Web Share API (if supported)
8. Statistics

Show:

Words
Characters
Reading time
Speaking time
Number of corrections
9. Accessibility
Keyboard navigation
ARIA labels
High contrast support
Screen reader compatibility
Large touch targets
Error Handling

Handle:

Empty input
No microphone permission
Unsupported browser
Invalid API key
Rate limit
Network failure
AI timeout
Speech synthesis errors

Display friendly messages.

Folder Structure
VoiceGrammarChecker/
│
├── index.html
├── style.css
├── script.js
├── assets/
│   ├── icons/
│   └── sounds/
├── README.md
Code Requirements
Well-commented code
Modular JavaScript
Async/Await
Clean architecture
No inline CSS
No inline JavaScript
Use Fetch API for Groq requests
Store settings using localStorage
Responsive for desktop, tablet, and mobile
Groq API

Use:

Model:

llama-3.3-70b-versatile

Endpoint:

https://api.groq.com/openai/v1/chat/completions

Use the standard OpenAI-compatible request format.

Final Output

Generate a complete, production-ready project with:

Professional UI
Fully working HTML, CSS, and JavaScript
No placeholder functions
No missing logic
No syntax errors
Proper comments
Responsive design
Fully integrated Speech-to-Text, Groq AI grammar correction, and Text-to-Speech
Ready to run by simply opening index.html (after entering a valid Groq API key).