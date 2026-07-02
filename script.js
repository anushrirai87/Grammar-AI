/**
 * VerbaGreen - AI Voice Grammar Checker
 * Engine Core: Vanilla JS + Web Speech API + Groq Serverless API Integration
 */

document.addEventListener("DOMContentLoaded", () => {
    
    // --- Application State Manager ---
    const State = {
        isRecording: false,
        recognition: null,
        speechUtterance: null,
        apiKey: localStorage.getItem("groq_api_key") || "",
        history: JSON.parse(localStorage.getItem("verbagreen_history")) || [],
        theme: localStorage.getItem("verbagreen_theme") || "light"
    };

    // --- DOM Elements Indexing ---
    const themeToggle = document.getElementById("theme-toggle");
    const micBtn = document.getElementById("mic-btn");
    const recordingStatus = document.getElementById("recording-status");
    const liveTranscript = document.getElementById("live-transcript");
    const originalText = document.getElementById("original-text");
    const clearOriginalBtn = document.getElementById("clear-original");
    const correctBtn = document.getElementById("correct-btn");
    const aiLoading = document.getElementById("ai-loading");
    
    const correctedSection = document.getElementById("corrected-section");
    const correctedText = document.getElementById("corrected-text");
    
    const voiceSelect = document.getElementById("voice-select");
    const volumeSlider = document.getElementById("volume-slider");
    const rateSlider = document.getElementById("rate-slider");
    const pitchSlider = document.getElementById("pitch-slider");
    const volVal = document.getElementById("vol-val");
    const rateVal = document.getElementById("rate-val");
    const pitchVal = document.getElementById("pitch-val");

    const speakBtn = document.getElementById("speak-btn");
    const pauseBtn = document.getElementById("pause-btn");
    const resumeBtn = document.getElementById("resume-btn");
    const stopBtn = document.getElementById("stop-btn");
    
    const copyBtn = document.getElementById("copy-btn");
    const downloadTxtBtn = document.getElementById("download-txt");
    const downloadPdfBtn = document.getElementById("download-pdf");
    const clearAllBtn = document.getElementById("clear-all");
    
    const historyList = document.getElementById("history-list");
    const clearHistoryBtn = document.getElementById("clear-history");
    
    const settingsModal = document.getElementById("settings-modal");
    const openSettingsBtn = document.getElementById("open-settings");
    const closeSettingsBtn = document.getElementById("close-settings");
    const apiKeyInput = document.getElementById("api-key-input");
    const toggleKeyVisibility = document.getElementById("toggle-key-visibility");
    const apiStatusBadge = document.getElementById("api-status");
    const deleteKeyBtn = document.getElementById("delete-key-btn");
    const testKeyBtn = document.getElementById("test-key-btn");
    const saveKeyBtn = document.getElementById("save-key-btn");

    const origMetrics = document.getElementById("original-metrics");
    const corrMetrics = document.getElementById("corrected-metrics");

    // --- Core Initializations ---
    initializeTheme();
    initializeSpeechRecognition();
    initializeSpeechSynthesis();
    renderHistory();
    updateApiStatusDisplay();

    // --- Theme Control Engine ---
    function initializeTheme() {
        document.documentElement.setAttribute("data-theme", State.theme);
        updateThemeIcon();
        themeToggle.addEventListener("click", () => {
            State.theme = State.theme === "light" ? "dark" : "light";
            document.documentElement.setAttribute("data-theme", State.theme);
            localStorage.setItem("verbagreen_theme", State.theme);
            updateThemeIcon();
        });
    }

    function updateThemeIcon() {
        const icon = themeToggle.querySelector("i");
        if (State.theme === "dark") {
            icon.className = "fa-solid fa-sun";
        } else {
            icon.className = "fa-solid fa-moon";
        }
    }

    // --- Web Speech API: Recognition Setup ---
    function initializeSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            recordingStatus.textContent = "Web Speech API recognition unsupported in this browser.";
            micBtn.disabled = true;
            return;
        }

        State.recognition = new SpeechRecognition();
        State.recognition.continuous = true;
        State.recognition.interimResults = true;
        State.recognition.lang = "en-US";

        State.recognition.onstart = () => {
            State.isRecording = true;
            micBtn.classList.add("recording");
            recordingStatus.textContent = "Listening... Press button to finalize transmission.";
            liveTranscript.classList.remove("hidden");
        };

        State.recognition.onresult = (event) => {
            let interimTranscript = "";
            let finalTranscript = "";

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (finalTranscript) {
                originalText.value = (originalText.value + " " + finalTranscript).trim();
                calculateTextMetrics(originalText, origMetrics);
            }
            liveTranscript.textContent = interimTranscript || "Listening seamlessly...";
        };

        State.recognition.onerror = (e) => {
            console.error("Speech recognition anomaly detected: ", e.error);
            stopRecordingSession();
        };

        State.recognition.onend = () => {
            stopRecordingSession();
        };

        micBtn.addEventListener("click", () => {
            if (!State.isRecording) {
                State.recognition.start();
            } else {
                State.recognition.stop();
            }
        });
    }

    function stopRecordingSession() {
        State.isRecording = false;
        micBtn.classList.remove("recording");
        recordingStatus.textContent = "Recording terminated. Transcript buffered.";
        liveTranscript.classList.add("hidden");
        liveTranscript.textContent = "";
    }

    // --- Web Speech API: Synthesis (TTS) Hub ---
    function initializeSpeechSynthesis() {
        if (!window.speechSynthesis) return;

        function populateVoiceMatrix() {
            const voices = window.speechSynthesis.getVoices();
            voiceSelect.innerHTML = "";
            voices.forEach((voice) => {
                const option = document.createElement("option");
                option.value = voice.name;
                option.textContent = `${voice.name} (${voice.lang})`;
                if (voice.default) option.selected = true;
                voiceSelect.appendChild(option);
            });
        }

        populateVoiceMatrix();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = populateVoiceMatrix;
        }

        // Configuration Control Hookups
        volumeSlider.addEventListener("input", (e) => { volVal.textContent = e.target.value; updateLiveUtteranceMetrics(); });
        rateSlider.addEventListener("input", (e) => { rateVal.textContent = e.target.value; updateLiveUtteranceMetrics(); });
        pitchSlider.addEventListener("input", (e) => { pitchVal.textContent = e.target.value; });

        // Media Action Triggers
        speakBtn.addEventListener("click", speakCorrectedTextData);
        pauseBtn.addEventListener("click", () => window.speechSynthesis.pause());
        resumeBtn.addEventListener("click", () => window.speechSynthesis.resume());
        stopBtn.addEventListener("click", () => window.speechSynthesis.cancel());

        // Pipeline Status Handlers
        setInterval(() => {
            if (window.speechSynthesis.speaking) {
                speakBtn.disabled = true;
                stopBtn.disabled = false;
                if (window.speechSynthesis.paused) {
                    pauseBtn.disabled = true;
                    resumeBtn.disabled = false;
                } else {
                    pauseBtn.disabled = false;
                    resumeBtn.disabled = true;
                }
            } else {
                speakBtn.disabled = false;
                pauseBtn.disabled = true;
                resumeBtn.disabled = true;
                stopBtn.disabled = true;
            }
        }, 150);
    }

    function speakCorrectedTextData() {
        window.speechSynthesis.cancel(); // Flush queues
        const textToSpeak = correctedText.value.trim();
        if (!textToSpeak) return;

        State.speechUtterance = new SpeechSynthesisUtterance(textToSpeak);
        const selectedVoiceName = voiceSelect.value;
        const voices = window.speechSynthesis.getVoices();
        State.speechUtterance.voice = voices.find(v => v.name === selectedVoiceName);

        State.speechUtterance.volume = parseFloat(volumeSlider.value);
        State.speechUtterance.rate = parseFloat(rateSlider.value);
        State.speechUtterance.pitch = parseFloat(pitchSlider.value);

        window.speechSynthesis.speak(State.speechUtterance);
    }

    // --- Groq Processing Layer ---
    correctBtn.addEventListener("click", async () => {
        const text = originalText.value.trim();
        if (!text) {
            alert("Provide source statement inputs before invoking correction execution.");
            return;
        }
        if (!State.apiKey) {
            alert("No API cloud authentication vector set. Access system settings configuration menu.");
            openSettingsModal();
            return;
        }

        aiLoading.classList.remove("hidden");
        correctBtn.disabled = true;

        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${State.apiKey}`
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [{
                        role: "user",
                        content: `Correct the grammar, punctuation, spelling, capitalization, and sentence structure of the following text. Preserve the original meaning exactly. Return ONLY the corrected sentence without explanations.\n\nText: "${text}"`
                    }],
                    temperature: 0.1
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || "Communication malfunction sustained.");
            }

            const payload = await response.json();
            const resultText = payload.choices[0].message.content.replace(/^["']|["']$/g, '').trim();

            // Populate persistent workspace architecture
            correctedText.value = resultText;
            correctedSection.classList.remove("hidden");
            calculateTextMetrics(correctedText, corrMetrics);
            
            // Push mutation track metrics into historical index
            pushHistoryLog(text, resultText);

        } catch (error) {
            alert(`Execution Exception: ${error.message}`);
        } finally {
            aiLoading.classList.add("hidden");
            correctBtn.disabled = false;
        }
    });

    // --- Analytical Calculations Matrix ---
    function calculateTextMetrics(textareaElem, metricsBlock) {
        const value = textareaElem.value;
        const charCount = value.length;
        const wordCount = value.trim() === "" ? 0 : value.trim().split(/\s+/).length;
        
        metricsBlock.querySelector("span:nth-child(1) .count").textContent = charCount;
        metricsBlock.querySelector("span:nth-child(2) .count").textContent = wordCount;

        // Populate reading/speaking expectations inside corrected output view matrix
        if (metricsBlock.id === "corrected-metrics") {
            const readingTimeSeconds = Math.ceil((wordCount / 200) * 60);
            const speakingTimeSeconds = Math.ceil((wordCount / 130) * 60);
            metricsBlock.querySelector("span:nth-child(3) .count").textContent = `${readingTimeSeconds}s`;
            metricsBlock.querySelector("span:nth-child(4) .count").textContent = `${speakingTimeSeconds}s`;
        }
    }

    function updateLiveUtteranceMetrics() {
        calculateTextMetrics(correctedText, corrMetrics);
        const currentWordCount = correctedText.value.trim().split(/\s+/).length;
        if(correctedText.value.trim() === "") return;
        const baseRate = parseFloat(rateSlider.value);
        const realTimeSpeakingSecs = Math.ceil(((currentWordCount / 130) * 60) / baseRate);
        corrMetrics.querySelector("span:nth-child(4) .count").textContent = `${realTimeSpeakingSecs}s`;
    }

    // Interactive Listener Interfaces for Metrics Syncing
    originalText.addEventListener("input", () => calculateTextMetrics(originalText, origMetrics));
    correctedText.addEventListener("input", () => {
        calculateTextMetrics(correctedText, corrMetrics);
        updateLiveUtteranceMetrics();
    });

    // --- Structural Content Downloader & Exporter Suite ---
    copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(correctedText.value);
        const originalIcon = copyBtn.innerHTML;
        copyBtn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
        setTimeout(() => copyBtn.innerHTML = originalIcon, 2000);
    });

    downloadTxtBtn.addEventListener("click", () => {
        const text = correctedText.value;
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `VerbaGreen-Correction-${Date.now()}.txt`;
        link.click();
    });

    downloadPdfBtn.addEventListener("click", () => {
        const element = document.createElement("div");
        element.style.padding = "30px";
        element.style.color = "#1f2937";
        element.style.fontFamily = "Helvetica, Arial, sans-serif";
        element.innerHTML = `
            <h1 style="color:#064e3b;border-bottom:2px solid #10b981;padding-bottom:10px;">VerbaGreen Grammar Audit Report</h1>
            <p style="margin-top:20px;"><b>Generated Stamp:</b> ${new Date().toLocaleString()}</p>
            <div style="margin-top:25px;background:#f3f4f6;padding:15px;border-radius:8px;">
                <h3 style="color:#b91c1c;margin-bottom:5px;">Original Input:</h3>
                <p style="font-style:italic;">"${originalText.value}"</p>
            </div>
            <div style="margin-top:20px;background:#e6f4ea;padding:15px;border-radius:8px;border-left:5px solid #10b981;">
                <h3 style="color:#064e3b;margin-bottom:5px;">Corrected Output:</h3>
                <p style="font-size:1.1rem;font-weight:500;">"${correctedText.value}"</p>
            </div>
        `;
        const options = {
            margin: 1,
            filename: `VerbaGreen-Report-${Date.now()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().set(options).from(element).save();
    });

    // --- Auxiliary UI Functional Mechanics ---
    clearOriginalBtn.addEventListener("click", () => {
        originalText.value = "";
        calculateTextMetrics(originalText, origMetrics);
    });

    clearAllBtn.addEventListener("click", () => {
        correctedText.value = "";
        correctedSection.classList.add("hidden");
        window.speechSynthesis.cancel();
    });

    // --- Persistent Transactional History Layer ---
    function pushHistoryLog(original, corrected) {
        const snapshot = {
            id: Date.now(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            original,
            corrected
        };
        State.history.unshift(snapshot);
        if (State.history.length > 25) State.history.pop(); // Cap length boundary conditions
        localStorage.setItem("verbagreen_history", JSON.stringify(State.history));
        renderHistory();
    }

    function renderHistory() {
        if (State.history.length === 0) {
            historyList.innerHTML = `<div class="empty-history-state">No recorded events yet.</div>`;
            return;
        }
        historyList.innerHTML = "";
        State.history.forEach((item) => {
            const block = document.createElement("div");
            block.className = "history-item";
            block.innerHTML = `
                <span class="history-time"><i class="fa-solid fa-clock"></i> ${item.timestamp}</span>
                <p class="history-orig">"${item.original}"</p>
                <p class="history-corr">"${item.corrected}"</p>
            `;
            block.addEventListener("click", () => {
                originalText.value = item.original;
                correctedText.value = item.corrected;
                correctedSection.classList.remove("hidden");
                calculateTextMetrics(originalText, origMetrics);
                calculateTextMetrics(correctedText, corrMetrics);
            });
            historyList.appendChild(block);
        });
    }

    clearHistoryBtn.addEventListener("click", () => {
        State.history = [];
        localStorage.removeItem("verbagreen_history");
        renderHistory();
    });

    // --- System Control Modal Infrastructure ---
    openSettingsBtn.addEventListener("click", openSettingsModal);
    closeSettingsBtn.addEventListener("click", closeSettingsModal);
    window.addEventListener("click", (e) => { if (e.target === settingsModal) closeSettingsModal(); });

    function openSettingsModal() {
        apiKeyInput.value = State.apiKey;
        settingsModal.classList.remove("hidden");
    }
    function closeSettingsModal() { settingsModal.classList.add("hidden"); }

    toggleKeyVisibility.addEventListener("click", () => {
        const type = apiKeyInput.type === "password" ? "text" : "password";
        apiKeyInput.type = type;
        toggleKeyVisibility.querySelector("i").className = type === "password" ? "fa-solid fa-eye" : "fa-solid fa-eye-slash";
    });

    saveKeyBtn.addEventListener("click", () => {
        State.apiKey = apiKeyInput.value.trim();
        localStorage.setItem("groq_api_key", State.apiKey);
        updateApiStatusDisplay();
        closeSettingsModal();
    });

    deleteKeyBtn.addEventListener("click", () => {
        State.apiKey = "";
        apiKeyInput.value = "";
        localStorage.removeItem("groq_api_key");
        updateApiStatusDisplay();
        closeSettingsModal();
    });

    testKeyBtn.addEventListener("click", async () => {
        const testKey = apiKeyInput.value.trim();
        if (!testKey) { alert("Enter a signature token sequence to execute diagnostic test."); return; }
        
        testKeyBtn.disabled = true;
        apiStatusBadge.className = "badge";
        apiStatusBadge.textContent = "Validating...";
        
        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${testKey}`
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [{ role: "user", content: "Ping" }],
                    max_tokens: 5
                })
            });
            if(response.ok) {
                apiStatusBadge.className = "badge badge-success";
                apiStatusBadge.textContent = "Authorized";
            } else {
                throw new Error("Handshake Rejected");
            }
        } catch(e) {
            apiStatusBadge.className = "badge badge-error";
            apiStatusBadge.textContent = "Verification Failed";
        } finally {
            testKeyBtn.disabled = false;
        }
    });

    function updateApiStatusDisplay() {
        if (State.apiKey) {
            apiStatusBadge.className = "badge badge-success";
            apiStatusBadge.textContent = "Configured Keys Saved";
        } else {
            apiStatusBadge.className = "badge badge-error";
            apiStatusBadge.textContent = "Unconfigured";
        }
    }
});