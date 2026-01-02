
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const uploadSection = document.getElementById('upload-section');
const loadingDiv = document.getElementById('loading');
const omrSection = document.getElementById('omr-section');
const omrGrid = document.getElementById('omr-grid');
const gradeBtn = document.getElementById('grade-btn');     // 전체 채점
const checkBtn = document.getElementById('check-btn');     // 중간 채점
const resetBtn = document.getElementById('reset-btn');
const scoreCard = document.getElementById('score-card');
const scoreText = document.getElementById('score-text');
const timerDiv = document.getElementById('timer');
const itemsPerPageSelect = document.getElementById('items-per-page');
const paginationDiv = document.getElementById('pagination');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importInput = document.getElementById('import-input');

// Manual Upload Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const jsonDropZone = document.getElementById('json-drop-zone');
const jsonInput = document.getElementById('json-input');
const copyPromptBtn = document.getElementById('copy-prompt-btn');
const aiPrompt = document.getElementById('ai-prompt');

let currentAnswers = []; // Correct answers from API {no, answer, type}
let userAnswers = {};    // User selected answers { [no]: "value" }
let startTime = null;
let timerInterval = null;
let currentPage = 1;
let itemsPerPage = 10;
let currentFile = null;  // Track current file name for history saving

// --- Helper Functions for Storage ---
const AUTO_SAVE_KEY = 'omr_auto_save';
const HISTORY_KEY = 'omr_history';

function saveState() {
    const state = {
        currentAnswers,
        userAnswers,
        startTime, // Original start time
        currentPage,
        itemsPerPage,
        currentFile,
        timestamp: Date.now() // Save time for reference
    };
    localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem(AUTO_SAVE_KEY);
    if (!saved) return false;

    try {
        const state = JSON.parse(saved);
        if (!state.currentAnswers || !state.currentAnswers.length) return false;

        currentAnswers = state.currentAnswers;
        userAnswers = state.userAnswers || {};
        startTime = state.startTime;
        currentPage = state.currentPage || 1;
        itemsPerPage = state.itemsPerPage || 10;
        currentFile = state.currentFile;

        // Update UI elements
        itemsPerPageSelect.value = itemsPerPage === currentAnswers.length ? 'all' : itemsPerPage;

        uploadSection.classList.add('hidden');
        omrSection.classList.remove('hidden');
        document.getElementById('history-section').classList.add('hidden');

        // Resume Timer
        // Note: The displayed time will jump to include the time elapsed while closed.
        // If we wanted to PAUSE the timer, we'd need to track accumulated time.
        // Assuming "exam" mode, the clock keeps ticking.
        startTimer(startTime);
        timerDiv.classList.remove('display-none');

        renderPage();
        return true;
    } catch (e) {
        console.error("Failed to load state", e);
        return false;
    }
}

// --- History Management (Client-Side) ---
function getHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveToHistory(filename, answers) {
    const history = getHistory();
    // Prevent strict full duplicates? 
    // Or just check filename. User logic (below) checks filename before upload.
    // Here we just add it to top.

    // Check if same file already at top (to prevent spamming if logic fails)
    if (history.length > 0 && history[0].filename === filename) return;

    const newItem = {
        filename,
        answers,
        timestamp: new Date().toLocaleString()
    };

    history.unshift(newItem);
    // Limit to 50
    if (history.length > 50) history.pop();

    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    loadHistoryUI(); // Refresh list
}

function isDuplicateFile(filename) {
    const history = getHistory();
    return history.some(item => item.filename === filename);
}

function loadHistoryUI() {
    const history = getHistory();
    renderHistory(history);
}

// --- Import / Export (Optimized) ---

// Minify Helpers
function minifyAnswers(answers) {
    return answers.map(a => {
        // [no, answer, type_code]
        // type_code: 0=choice(default/missing), 1=descriptive
        const typeCode = a.type === 'descriptive' ? 1 : 0;
        return [a.no, a.answer, typeCode];
    });
}

function expandAnswers(minifiedAnswers) {
    return minifiedAnswers.map(a => {
        // [no, answer, type_code]
        return {
            no: a[0],
            answer: a[1],
            type: a[2] === 1 ? 'descriptive' : 'choice'
        };
    });
}

function minifyState(state) {
    if (!state) return null;
    return {
        ca: minifyAnswers(state.currentAnswers), // currentAnswers
        ua: state.userAnswers,                   // userAnswers (already compact {id:val})
        st: state.startTime,                     // startTime
        cp: state.currentPage,                   // currentPage
        ipp: state.itemsPerPage,                 // itemsPerPage
        cf: state.currentFile,                   // currentFile
        ts: state.timestamp                      // timestamp
    };
}

function expandState(minifiedState) {
    if (!minifiedState) return null;
    // Check if it's legacy (has currentAnswers key)
    if (minifiedState.currentAnswers) return minifiedState;

    return {
        currentAnswers: expandAnswers(minifiedState.ca),
        userAnswers: minifiedState.ua,
        startTime: minifiedState.st,
        currentPage: minifiedState.cp,
        itemsPerPage: minifiedState.ipp,
        currentFile: minifiedState.cf,
        timestamp: minifiedState.ts
    };
}

function minifyHistory(history) {
    return history.map(item => ({
        f: item.filename,
        t: item.timestamp,
        a: minifyAnswers(item.answers)
    }));
}

function expandHistory(minifiedHistory) {
    return minifiedHistory.map(item => {
        // Legacy check
        if (item.filename) return item;
        return {
            filename: item.f,
            timestamp: item.t,
            answers: expandAnswers(item.a)
        };
    });
}

function exportData() {
    const history = getHistory();
    const autoSaveStr = localStorage.getItem(AUTO_SAVE_KEY);
    const autoSave = autoSaveStr ? JSON.parse(autoSaveStr) : null;

    // Create optimized object
    const data = {
        v: 2, // Version 2 (Optimized)
        ts: new Date().toISOString(),
        h: minifyHistory(history),
        s: minifyState(autoSave)
    };

    // Remove whitespace from stringify (null, 0)
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    a.download = `ansomr_backup_${dateStr}_min.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const raw = JSON.parse(e.target.result);

            // Normalize Data (Handle V1 Legacy and V2 Optimized)
            let history = [];
            let autoSave = null;

            if (raw.v === 2 || raw.h) {
                // V2 Optimized
                history = expandHistory(raw.h || []);
                autoSave = expandState(raw.s);
            } else {
                // V1 Legacy or raw backup
                history = raw.history || [];
                autoSave = raw.autoSave || null;
            }

            if (!history.length && !autoSave) {
                // Try parsing as standard history array if all else fails
                if (Array.isArray(raw)) {
                    history = raw;
                } else {
                    alert('올바르지 않은 백업 파일입니다.');
                    return;
                }
            }

            // Merge History
            if (history.length > 0) {
                const currentHistory = getHistory();
                const newItems = history.filter(newItem =>
                    !currentHistory.some(existing => existing.filename === newItem.filename)
                );

                const merged = [...newItems, ...currentHistory].slice(0, 50);
                localStorage.setItem(HISTORY_KEY, JSON.stringify(merged));
            }

            // Restore Auto Save
            if (autoSave) {
                if (confirm('진행 중이던 작업(자동 저장)도 복구하시겠습니까?\n현재 진행 중인 내용은 덮어씌워집니다.')) {
                    localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(autoSave));
                    loadState(); // Refresh UI immediately (timer, answers etc)
                }
            }

            loadHistoryUI(); // Refresh list
            alert('데이터 복구가 완료되었습니다.');

        } catch (error) {
            console.error(error);
            alert('파일을 읽는 중 오류가 발생했습니다.');
        }
    };
    reader.readAsText(file);
}

// --- Event Listeners ---
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleUpload(e.target.files[0]);
});

itemsPerPageSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    itemsPerPage = val === 'all' ? currentAnswers.length : parseInt(val);
    currentPage = 1;
    saveState(); // Auto-save preference
    renderPage();
});

exportBtn.addEventListener('click', exportData);
importBtn.addEventListener('click', () => importInput.click());
importInput.addEventListener('change', (e) => {
    if (e.target.files.length) importData(e.target.files[0]);
    e.target.value = ''; // Reset
});

gradeBtn.addEventListener('click', gradeTotal);
checkBtn.addEventListener('click', gradeIntermediate);
resetBtn.addEventListener('click', resetUI);

// --- Manual Upload & Tab Logic ---

// Tabs
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// Copy Prompt
if (copyPromptBtn && aiPrompt) {
    copyPromptBtn.addEventListener('click', () => {
        aiPrompt.select();
        document.execCommand('copy'); // Legacy but widely supported for simple text areas
        // navigator.clipboard.writeText(aiPrompt.value); // Modern way

        // Visual Feedback
        const originalText = copyPromptBtn.textContent;
        copyPromptBtn.textContent = '✅ 복사됨';
        setTimeout(() => {
            copyPromptBtn.textContent = originalText;
        }, 2000);
    });
}

// JSON Drop Zone
if (jsonDropZone && jsonInput) {
    jsonDropZone.addEventListener('click', () => jsonInput.click());
    jsonDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        jsonDropZone.classList.add('dragover');
    });
    jsonDropZone.addEventListener('dragleave', () => jsonDropZone.classList.remove('dragover'));
    jsonDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        jsonDropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleManualUpload(e.dataTransfer.files[0]);
    });
    jsonInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleManualUpload(e.target.files[0]);
    });
}

function handleManualUpload(file) {
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        alert('JSON 파일만 업로드 가능합니다.');
        return;
    }

    // Client-side Duplicate Check
    if (isDuplicateFile(file.name)) {
        alert('이미 존재하는 파일입니다.');
        highlightHistoryItem(file.name);
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const raw = JSON.parse(e.target.result);

            // Validate Structure
            if (!Array.isArray(raw)) {
                throw new Error("JSON 루트는 배열이어야 합니다.");
            }

            if (raw.length === 0) {
                throw new Error("비어있는 배열입니다.");
            }

            const isValid = raw.every(item => 'no' in item && 'answer' in item);
            if (!isValid) {
                throw new Error("각 항목은 'no'와 'answer' 키를 포함해야 합니다.");
            }

            // Success loading manual data
            currentAnswers = raw.map(item => ({
                no: item.no,
                answer: item.answer,
                type: item.type || 'choice' // Default to choice if missing
            }));

            currentFile = file.name;

            // Initialize user answers
            userAnswers = {};
            currentAnswers.forEach(a => userAnswers[a.no] = null);

            // Switch UI
            uploadSection.classList.add('hidden');
            omrSection.classList.remove('hidden');
            document.getElementById('history-section').classList.add('hidden');

            // Save History
            saveToHistory(currentFile, currentAnswers);

            // Start Timer
            startTime = Date.now();
            startTimer(startTime);
            timerDiv.classList.remove('display-none');

            // Save State
            saveState();

            // Render
            currentPage = 1;
            renderPage();

        } catch (error) {
            console.error(error);
            alert(`올바르지 않은 JSON 파일입니다: ${error.message}`);
        }
    };
    reader.readAsText(file);
}

// --- Core Functions ---

async function handleUpload(file) {
    if (file.type !== 'application/pdf') {
        alert('PDF 파일만 업로드 가능합니다.');
        return;
    }

    // Client-side Duplicate Check
    if (isDuplicateFile(file.name)) {
        alert('이미 존재하는 파일입니다.');
        highlightHistoryItem(file.name);
        return; // Stop upload
    }

    dropZone.classList.add('hidden');
    loadingDiv.classList.remove('hidden');

    const formData = new FormData();
    formData.append('file', file);

    // Clear previous logs if any (now just showing loading screen)

    try {
        const response = await fetch('/api/analyze', { method: 'POST', body: formData });
        const data = await response.json();

        if (data.status === 'success') {
            currentAnswers = data.answers;
            currentFile = file.name;

            // Initialize user answers
            userAnswers = {};
            currentAnswers.forEach(a => userAnswers[a.no] = null);

            uploadSection.classList.add('hidden');
            omrSection.classList.remove('hidden');
            document.getElementById('history-section').classList.add('hidden');

            // Save to History (Client-Side)
            saveToHistory(currentFile, currentAnswers);

            // Start Timer (New Session)
            startTime = Date.now();
            startTimer(startTime);
            timerDiv.classList.remove('display-none');

            // Save Initial State
            saveState();

            // Render First Page
            currentPage = 1;
            renderPage();

        } else {
            // Server duplicate check is removed, but just in case of other errors
            if (data.code === 'DUPLICATE') {
                // Should be caught by client-side check, but fallback
                alert(data.message);
                highlightHistoryItem(data.filename);
                resetUI();
            } else {
                alert('분석 실패: ' + data.message);
                resetUI();
            }
        }
    } catch (error) {
        console.error('Error:', error);
        alert('서버 오류가 발생했습니다.');
        resetUI();
    }
}

function highlightHistoryItem(filename) {
    const items = document.querySelectorAll('.history-item');
    for (const item of items) {
        const nameSpan = item.querySelector('.history-name');
        if (nameSpan && nameSpan.textContent === filename) {
            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
            item.classList.add('highlight');
            setTimeout(() => {
                item.classList.remove('highlight');
            }, 2000); // Remove after 2 seconds
            break;
        }
    }
}

function startTimer(initialStartTime) {
    startTime = initialStartTime || Date.now();

    // Clear existing if multiple calls
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        const now = Date.now();
        const diff = now - startTime;
        const totalSeconds = Math.floor(diff / 1000);

        const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const s = String(totalSeconds % 60).padStart(2, '0');

        timerDiv.textContent = `${h}:${m}:${s}`;

        // We generally don't need to save timer every second to localStorage (too many writes?)
        // But we DO need to save other state.
        // Let's rely on saving at key points or maybe every 10-30s if desired.
        // For now, let's just stick to interaction-based saving + periodic check logic if requested.
        // The user asked for "auto save".
        // Let's just update the state here? No, better not hammer localStorage 1/sec.
        // The startTime is constant, so `saveState` persists the START time. 
        // When we reload, we calc diff from that start time. So we don't need to update storage every second.
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function renderPage() {
    omrGrid.innerHTML = '';

    // Calculate slice
    const info = getPaginationInfo();
    const pageAnswers = currentAnswers.slice(info.startIndex, info.endIndex);

    pageAnswers.forEach(item => {
        const row = document.createElement('div');
        row.className = 'omr-row';
        row.dataset.no = item.no;

        const isDescriptive = item.type === 'descriptive';
        let inputHtml = '';

        if (isDescriptive) {
            inputHtml = `<span class="desc-label">서술형 (자동 채점 불가)</span>`;
        } else {
            // 5-choice bubbles
            inputHtml = `<div class="omr-bubbles">`;
            for (let i = 1; i <= 5; i++) {
                const isChecked = userAnswers[item.no] == i ? 'checked' : '';
                inputHtml += `
                    <label class="bubble-container">
                        <input type="radio" name="q_${item.no}" value="${i}" ${isChecked} onclick="handleAnswerClick(${item.no}, ${i}, this)">
                        <span class="bubble">${i}</span>
                    </label>
                `;
            }
            inputHtml += `</div>`;
        }

        row.innerHTML = `
            <span class="q-num">${item.no}</span>
            <div class="input-area">
                ${inputHtml}
                <span class="feedback"></span>
            </div>
        `;
        omrGrid.appendChild(row);
    });

    renderPaginationControls(info.totalPages);
}

function handleAnswerClick(questionNo, value, inputElement) {
    // Reset Row UI
    const row = inputElement.closest('.omr-row');
    if (row) {
        row.classList.remove('correct', 'wrong');
        const feedback = row.querySelector('.feedback');
        if (feedback) feedback.innerHTML = '';
    }

    if (userAnswers[questionNo] == value) {
        // Already selected -> Deselect
        userAnswers[questionNo] = null;
        inputElement.checked = false;
    } else {
        // Select
        userAnswers[questionNo] = value;
    }
    saveState(); // Auto-save on answer change
}

function getPaginationInfo() {
    const total = currentAnswers.length;
    let limit = itemsPerPage === 'all' ? total : itemsPerPage;
    if (limit === 'all') limit = total; // safety

    const totalPages = Math.ceil(total / limit);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * limit;
    const endIndex = Math.min(startIndex + limit, total);

    return { startIndex, endIndex, totalPages, limit };
}

function renderPaginationControls(totalPages) {
    paginationDiv.innerHTML = '';
    if (totalPages <= 1) return;

    // Previous
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '<';
    prevBtn.className = 'page-btn';
    prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; renderPage(); } };
    paginationDiv.appendChild(prevBtn);

    // Page Numbers (simple version)
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        btn.onclick = () => { currentPage = i; renderPage(); };
        paginationDiv.appendChild(btn);
    }

    // Next
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '>';
    nextBtn.className = 'page-btn';
    nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; renderPage(); } };
    paginationDiv.appendChild(nextBtn);
}

// --- Grading Logic ---

function gradeIntermediate() {
    // Only grade what's on the screen (or everything? User likely wants to check current answers)
    // "Intermediate" usually implies checking what I've done so far.
    // Let's grade everything answering so far, but show feedback MAINLY on valid items.
    // Actually, to give immediate feedback, let's grade the CURRENT PAGE visibly.

    const rows = document.querySelectorAll('.omr-row');
    rows.forEach(row => {
        const no = parseInt(row.dataset.no);
        const answerData = currentAnswers.find(a => a.no === no);
        const userAnswer = userAnswers[no];
        const feedback = row.querySelector('.feedback');

        // Reset styles first
        row.classList.remove('correct', 'wrong');
        feedback.innerHTML = ''; // Clear previous content
        feedback.className = 'feedback';

        // Clear bubble highlights
        const bubbles = row.querySelectorAll('.bubble');
        bubbles.forEach(b => b.classList.remove('answer-bubble'));

        if (answerData.type !== 'descriptive' && userAnswer) {
            const correctAnswer = String(answerData.answer).trim();
            if (String(userAnswer) === correctAnswer) {
                row.classList.add('correct');
                feedback.innerHTML = '<span class="mark-icon check">O</span>';
                feedback.classList.add('correct-text');
            } else {
                row.classList.add('wrong');
                feedback.innerHTML = '<span class="mark-icon cross">X</span> ';

                // Create Show Answer Button
                const showBtn = document.createElement('button');
                showBtn.textContent = '정답 보기';
                showBtn.className = 'show-answer-btn';
                showBtn.onclick = () => {
                    feedback.innerHTML = `<span class="mark-icon cross">X</span> 정답: ${correctAnswer}`;
                    feedback.className = 'feedback wrong-text';

                    // Highlight correct bubble
                    const correctInput = row.querySelector(`input[value="${correctAnswer}"]`);
                    if (correctInput) {
                        const bubble = correctInput.nextElementSibling;
                        if (bubble) bubble.classList.add('answer-bubble');
                    }
                };
                feedback.appendChild(showBtn);
            }
        }
    });
}

function gradeTotal() {
    stopTimer();

    let score = 0;
    let gradedCount = 0;
    let totalQuestions = currentAnswers.length;

    // Verify all logic
    currentAnswers.forEach(item => {
        if (item.type !== 'descriptive') {
            const correct = String(item.answer).trim();
            const user = userAnswers[item.no];
            if (user && String(user) === correct) {
                score++;
            }
            // Count all multiple choice as graded items
            gradedCount++;
        }
    });

    const percentage = gradedCount > 0 ? Math.round((score / gradedCount) * 100) : 0;

    // Update Score Text: "Correct / Total"
    scoreText.textContent = `${score} / ${gradedCount}`;

    // Update Subtext: "Percentage%"
    const scoreSubtext = document.getElementById('score-subtext');
    if (scoreSubtext) {
        scoreSubtext.textContent = `(${percentage}%)`;
    }

    scoreCard.classList.remove('hidden');

    // Show feedback on current page (visual confirmation)
    gradeIntermediate();

    window.scrollTo({ top: 0, behavior: 'smooth' });
    alert(`채점 완료! 정답 개수: ${score}/${gradedCount} (${percentage}%)`);
}

function resetUI() {
    stopTimer();
    timerDiv.textContent = "00:00:00";
    timerDiv.classList.add('display-none');

    // Clear saved state
    localStorage.removeItem(AUTO_SAVE_KEY);

    fileInput.value = '';
    currentAnswers = [];
    userAnswers = {};
    currentFile = null;

    dropZone.classList.remove('hidden');
    loadingDiv.classList.add('hidden');
    uploadSection.classList.remove('hidden');
    document.getElementById('history-section').classList.remove('hidden'); // Show history again
    omrSection.classList.add('hidden');
    scoreCard.classList.add('hidden');
    omrGrid.innerHTML = '';

    // Refresh history (UI)
    loadHistoryUI();
}

// History Functions (Legacy fetch removed)
// function fetchHistory() ... removed

function renderHistory(history) {
    const listDiv = document.getElementById('history-list');
    listDiv.innerHTML = '';

    if (!history || history.length === 0) {
        listDiv.innerHTML = '<p class="empty-msg">기록이 없습니다.</p>';
        return;
    }

    history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.onclick = () => loadFromHistory(item);

        div.innerHTML = `
            <div class="history-info">
                <span class="history-name">${item.filename}</span>
                <span class="history-date">${item.timestamp}</span>
            </div>
            <div class="history-arrow">➡️</div>
        `;
        listDiv.appendChild(div);
    });
}

function loadFromHistory(item) {
    currentAnswers = item.answers;
    userAnswers = {};
    currentFile = item.filename;

    currentAnswers.forEach(a => userAnswers[a.no] = null);

    // Update UI
    uploadSection.classList.add('hidden');
    document.getElementById('history-section').classList.add('hidden'); // Hide history
    omrSection.classList.remove('hidden');

    // Start Timer (New Session from history load)
    startTime = Date.now();
    startTimer(startTime);
    timerDiv.classList.remove('display-none');

    // Save this new state
    saveState();

    // Render First Page
    currentPage = 1;
    renderPage();
}

// Initial Load
loadHistoryUI();
loadState(); // Check if there's an active session

// --- Parallax Effect ---
function initParallax() {
    const parallaxBgs = document.querySelectorAll('.parallax-bg');

    let centerX = window.innerWidth / 2;
    let centerY = window.innerHeight / 2;

    function updateParallax(clientX, clientY) {
        const offsetX = (clientX - centerX);
        const offsetY = (clientY - centerY);

        // Move background blobs
        parallaxBgs.forEach(el => {
            const speed = parseFloat(el.dataset.speed) || 0.02;
            const x = offsetX * speed;
            const y = offsetY * speed;
            el.style.transform = `translate(${x}px, ${y}px)`;
        });
    }

    // Mouse movement
    document.addEventListener('mousemove', (e) => {
        requestAnimationFrame(() => updateParallax(e.clientX, e.clientY));
    });

    // Touch movement
    document.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            requestAnimationFrame(() => updateParallax(touch.clientX, touch.clientY));
        }
    }, { passive: true });

    // Reset on window resize
    window.addEventListener('resize', () => {
        centerX = window.innerWidth / 2;
        centerY = window.innerHeight / 2;
    });
}

// Initialize parallax on load
initParallax();

