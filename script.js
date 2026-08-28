/* State Management */
const State = {
    dictionary: [],
    validDailyWords: [],
    
    // Core parsed state from hints text
    parsed: {
        isLoaded: false,
        centerLetter: '',
        outerLetters: [],
        totals: { words: 0, points: 0, pangrams: 0, bingo: false },
        grid: { lengths: [], rows: {} },
        twoLetter: {}
    },
    
    // Computed states (calculated from parsed + found words)
    computed: {
        invalidWords: [],
        validFoundWords: [],
        score: 0,
        pangrams: 0,
        bingoStatus: 'N/A', // 'N/A', 'Bingo!', or missing letters
        grid: { lengths: [], rows: {} },
        twoLetter: {},
        gridColTotals: {},
        gridTotalSigma: 0
    },
    
    // Inputs
    foundText: '',
    lookup: {
        start: '',
        contains: '',
        len: 0,
        constrain: false,
        excludeFound: false
    },
    dismissedAllFound: false
};

/* DOM Caching Helper */
const $ = id => document.getElementById(id);

const UI = {
    hintsInput: $('hints-input'),
    foundInput: $('found-input'),
    wordsCount: $('words-count'),
    wordsCountMob: $('words-count-mob'),
    wordsTotalMob: $('words-total-mob'),
    wordsCountMob: $('words-count-mob'),
    bingoLabelMob: $('bingo-label-mob'),
    wordsTotal: $('words-total'),
    pointsCount: $('points-count'),
    pointsCountMob: $('points-count-mob'),
    pointsTotalMob: $('points-total-mob'),
    pointsTotal: $('points-total'),
    pangramsCount: $('pangrams-count'),
    pangramsCountMob: $('pangrams-count-mob'),
    pangramsTotalMob: $('pangrams-total-mob'),
    pangramsTotal: $('pangrams-total'),
    bingoLabel: $('bingo-label'),
    bingoLabelMob: $('bingo-label-mob'),
    bingoStatusMob: $('bingo-status-mob'),
    gridOutput: $('grid-output'),
    twoLetterOutput: null, // Removed
    luStart: $('lu-start'),
    luContains: $('lu-contains'),
    luLength: $('lu-length'),
    lookupResults: $('lookup-results'),
    cbConstrain: $('cb-constrain'),
    cbExcludeFound: $('cb-exclude-found'),
    
    hintsContainer: $('hints-container'),
    orbitWrapper: $('orbit-wrapper'),
    letterButtons: $('letter-buttons'),
    
    btnLoadHints: $('btn-load-hints'),
    btnEditHints: $('btn-edit-hints'),
    btnClearHints: $('btn-clear-hints'),
    btnClearFound: $('btn-clear-found'),
    btnSaveCenter: $('btn-save-center'),
    
    puzzleLink: $('puzzle-link'),
    puzzleLinkMob: $('puzzle-date') ? $('puzzle-link-mob') : null,
    puzzleDate: $('puzzle-date'),
    puzzleDateMob: $('puzzle-date') ? $('puzzle-date-mob') : null,
    customDateDisplay: $('custom-date-display'),
    customDateDisplayMob: $('custom-date-display-mob'),
    
    ignoredCount: $('ignored-count'),
    foundWarning: $('found-warning'),
    allFoundMessage: $('all-found-message'),
    allFoundMessageMob: $('all-found-message-mob'),
    hintsError: $('hints-error'),
    chevronInd: $('chevron-indicator'),
    chevronIndMob: $('chevron-indicator-mob'),
    rightPaneTitle: $('right-pane-title'),
    
    editCenterUi: $('edit-center-ui'),
    editCenterInput: $('edit-center-input'),
    linkEditCenter: $('link-edit-center'),

    mobFoundInput: $('mob-found-input'),
    mobAllFoundOverlay: $('mob-all-found-overlay'),
    btnCloseAllFound: $('btn-close-all-found'),
    mobWordsFoundLink: $('mob-words-found-link'),
    mobWordsFoundCount: $('mob-words-found-count'),
    mobIgnoredLink: $('mob-ignored-link'),
    mobIgnoredCount: $('mob-ignored-count'),
    btnClearFoundMob: $('btn-clear-found-mob'),
    wordsFoundModal: $('words-found-modal'),
    wordsFoundModalContent: $('words-found-modal-content'),
    wordsFoundModalDisplay: $('words-found-modal-display'),
    btnEditWordsMob: $('btn-edit-words-mob'),
    wordsFoundClose: $('words-found-close'),
    ignoredModal: $('ignored-modal'),
    ignoredModalContent: $('ignored-modal-content'),
    ignoredClose: $('ignored-close')
};

/* --- PURE FUNCTIONS (Logic) --- */

function parseHintsText(text) {
    if (!text || !text.trim()) return { error: 'Paste hints to proceed.' };
    
    const p = {
        centerLetter: '',
        outerLetters: [],
        totals: { words: 0, points: 0, pangrams: 0, bingo: false },
        grid: { lengths: [], rows: {} },
        twoLetter: {}
    };

    const lines = text.split('\n').map(l => l.trim().toLowerCase());
    
    // Letters
    for (const line of lines) {
        const letterMatch = line.match(/^([a-z]\s+){6}[a-z]$/i);
        if (letterMatch) {
            const letters = line.replace(/\s+/g, '').split('');
            p.centerLetter = letters[0];
            p.outerLetters = letters.slice(1);
            break;
        }
    }

    // Totals
    const wordsMatch = text.match(/words:\s*(\d+)/i);
    const pointsMatch = text.match(/points:\s*(\d+)/i);
    const pMatch = text.match(/pangrams:\s*(\d+)/i);
    const bMatch = text.match(/bingo/i);
    if (wordsMatch) p.totals.words = parseInt(wordsMatch[1]);
    if (pointsMatch) p.totals.points = parseInt(pointsMatch[1]);
    if (pMatch) p.totals.pangrams = parseInt(pMatch[1]);
    if (bMatch) p.totals.bingo = true;

    // Grid
    let gridStarted = false;
    for (const line of lines) {
        if (!gridStarted) {
            if (line.match(/^(?:\d+\s+)+([σΣ]|tot)/i) || (line.includes('4') && line.includes('5') && (line.includes('Σ') || line.includes('tot')) && line.match(/\d/))) {
                gridStarted = true;
                p.grid.lengths = line.match(/\d+/g).map(Number);
            }
        } else {
            if (line.includes('Σ') || line.includes('sigma') || line.includes('tot')) break;
            const rowMatch = line.match(/^([a-z]):\s*(.*)$/i);
            if (rowMatch) {
                const letter = rowMatch[1];
                const parts = rowMatch[2].split(/\s+/);
                p.grid.rows[letter] = {};
                for (let j = 0; j < p.grid.lengths.length; j++) {
                    const val = parts[j];
                    if (val && val !== '-') {
                        p.grid.rows[letter][p.grid.lengths[j]] = parseInt(val) || 0;
                    }
                }
            }
        }
    }

    // Two Letter
    const tlMatches = text.matchAll(/([a-z]{2})-(\d+)/gi);
    for (const match of tlMatches) {
        p.twoLetter[match[1].toLowerCase()] = parseInt(match[2]);
    }

    const hasLetters = !!p.centerLetter;
    const hasGrid = Object.keys(p.grid.rows).length > 0;
    const hasTwoLetter = Object.keys(p.twoLetter).length > 0;

    if (!hasLetters || !hasGrid || !hasTwoLetter) {
        let missing = [];
        if (!hasLetters) missing.push('letters');
        if (!hasGrid) missing.push('grid');
        if (!hasTwoLetter) missing.push('two letter list');
        return { error: `Validation failed. Missing: ${missing.join(', ')}. Please copy the entire hints section.` };
    }

    p.isLoaded = true;
    return p;
}

function computeState(parsed, foundText) {
    const computed = {
        invalidWords: [],
        validFoundWords: [],
        score: 0,
        pangrams: 0,
        bingoStatus: 'N/A',
        grid: { lengths: [...parsed.grid.lengths], rows: JSON.parse(JSON.stringify(parsed.grid.rows)) },
        twoLetter: { ...parsed.twoLetter },
        gridColTotals: {},
        gridTotalSigma: 0
    };

    if (!parsed.isLoaded) return computed;

    const allLetters = new Set([parsed.centerLetter, ...parsed.outerLetters]);
    const foundWords = foundText.toLowerCase().match(/[a-z]{4,}/g) || [];
    const uniqueFoundWords = [...new Set(foundWords)];

    let tempGrid = JSON.parse(JSON.stringify(parsed.grid));
    let tempTwoLetter = { ...parsed.twoLetter };
    let foundStartLetters = new Set();

    uniqueFoundWords.forEach(w => {
        let reason = null;
        
        const invalidChars = [];
        for (let char of w) {
            if (!allLetters.has(char)) {
                if (!invalidChars.includes(char)) invalidChars.push(char);
            }
        }
        
        if (invalidChars.length > 0) {
            reason = `invalid letter${invalidChars.length > 1 ? 's' : ''} '${invalidChars.join(', ')}'`;
        } else if (!w.includes(parsed.centerLetter)) {
            reason = `missing center '${parsed.centerLetter}'`;
        }
        
        if (!reason) {
            const first = w[0];
            const len = w.length;
            if (!tempGrid.rows[first] || !tempGrid.rows[first][len] || tempGrid.rows[first][len] <= 0) {
                reason = `exceeds grid limits`;
            } else {
                tempGrid.rows[first][len]--;
            }
        }
        
        if (!reason) {
            const prefix = w.substring(0, 2);
            if (!tempTwoLetter[prefix] || tempTwoLetter[prefix] <= 0) {
                reason = `exceeds two letter list limits`;
            } else {
                tempTwoLetter[prefix]--;
            }
        }
        
        if (!reason) {
            computed.validFoundWords.push(w);
            foundStartLetters.add(w[0]);
            
            // Score & Pangram
            if (w.length === 4) computed.score += 1;
            else if (w.length > 4) {
                computed.score += w.length;
                const uniqueChars = new Set(w);
                let isPangram = true;
                for (let l of allLetters) {
                    if (!uniqueChars.has(l)) { isPangram = false; break; }
                }
                if (isPangram) { computed.score += 7; computed.pangrams++; }
            }

            // Decrement remaining states
            computed.grid.rows[w[0]][w.length]--;
            computed.twoLetter[w.substring(0, 2)]--;

        } else {
            computed.invalidWords.push(`${w} (${reason})`);
        }
    });

    // Bingo
    if (parsed.totals.bingo) {
        if (foundStartLetters.size === 7) {
            computed.bingoStatus = 'Bingo!';
        } else {
            const missing = [...allLetters].filter(l => !foundStartLetters.has(l));
            computed.bingoStatus = missing.join(', ').toUpperCase();
        }
    }

    // Grid totals
    for (const [letter, counts] of Object.entries(computed.grid.rows)) {
        computed.grid.lengths.forEach(l => {
            const count = counts[l] || 0;
            if (count > 0) {
                computed.gridColTotals[l] = (computed.gridColTotals[l] || 0) + count;
                computed.gridTotalSigma += count;
            }
        });
    }

    computed.validFoundWords.sort();
    return computed;
}

function getValidDailyWords(dictionary, centerLetter, outerLetters) {
    if (!dictionary.length || !centerLetter) return [];
    const allLetters = new Set([centerLetter, ...outerLetters]);
    return dictionary.filter(w => {
        if (!w.includes(centerLetter)) return false;
        for (let char of w) {
            if (!allLetters.has(char)) return false;
        }
        return true;
    });
}

let prevWordsCount = -1;
let prevIgnoredCount = -1;

/* --- RENDER FUNCTION --- */

function render() {
    // 1. Inputs Sync
    if (UI.hintsInput.value !== localStorage.getItem('workerBeeHints')) {
        localStorage.setItem('workerBeeHints', UI.hintsInput.value);
    }
    if (UI.foundInput.value !== State.foundText) {
        UI.foundInput.value = State.foundText;
    }
    if (State.foundText !== localStorage.getItem('workerBeeFound')) {
        localStorage.setItem('workerBeeFound', State.foundText);
    }
    
    // 2. View Toggle
    if (State.parsed.isLoaded) {
        UI.hintsContainer.classList.add('hidden');
        UI.orbitWrapper.classList.remove('hidden');
        if($('sticky-stats')) $('sticky-stats').classList.remove('hidden');
        UI.btnEditHints.classList.remove('hidden');
        if (UI.chevronInd) UI.chevronInd.classList.add('hidden');
        if (UI.chevronIndMob) UI.chevronIndMob.classList.add('hidden');
        
        let dateStr = UI.puzzleDate.value;
        let formattedDate = dateStr;
        if (dateStr) {
            const dateObj = new Date(dateStr + "T00:00:00");
            formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }).replace(',', '');
        }
        UI.rightPaneTitle.innerText = `Showing hints for ${formattedDate || 'selected date'}`;
    } else {
        UI.hintsContainer.classList.remove('hidden');
        UI.orbitWrapper.classList.add('hidden');
        if($('sticky-stats')) $('sticky-stats').classList.add('hidden');
        UI.btnEditHints.classList.add('hidden');
        if (UI.chevronInd) UI.chevronInd.classList.remove('hidden');
        if (UI.chevronIndMob) UI.chevronIndMob.classList.remove('hidden');
        UI.rightPaneTitle.innerText = 'Paste Hints';
    }

    // 3. Hints Error
    if (State.hintsError) {
        UI.hintsError.textContent = State.hintsError;
        UI.hintsError.classList.remove('hidden');
    } else {
        UI.hintsError.classList.add('hidden');
    }

    renderLookupUI(); // Render lookup before the early return!
    if (!State.parsed.isLoaded) return; // Skip remaining render if not loaded

    // 4. Letters
    const allLetters = [State.parsed.centerLetter, ...State.parsed.outerLetters];
    UI.letterButtons.innerHTML = allLetters.map(l => 
        `<div class="linear-letter${l === State.parsed.centerLetter ? ' linear-center' : ''}">${l}</div>`
    ).join('');

    // 5. Ignored / Warnings
    if (State.computed.invalidWords.length > 0) {
        UI.ignoredCount.innerText = `${State.computed.invalidWords.length} ignored`;
        UI.ignoredCount.classList.remove('hidden');
        UI.foundWarning.innerHTML = State.computed.invalidWords.map(w => `<li>${w}</li>`).join('');
        UI.foundWarning.classList.remove('hidden');
        if (UI.mobIgnoredLink) {
            const curIgnored = State.computed.invalidWords.length;
            if (prevIgnoredCount !== -1 && curIgnored > prevIgnoredCount) {
                UI.mobIgnoredCount.classList.remove('pop-anim');
                void UI.mobIgnoredCount.offsetWidth;
                UI.mobIgnoredCount.classList.add('pop-anim');
            }
            UI.mobIgnoredCount.innerText = curIgnored;
            UI.mobIgnoredLink.classList.remove('hidden');
            prevIgnoredCount = curIgnored;
        }
    } else {
        UI.ignoredCount.classList.add('hidden');
        UI.foundWarning.classList.add('hidden');
        if (UI.mobIgnoredLink) {
            UI.mobIgnoredLink.classList.add('hidden');
        }
        prevIgnoredCount = 0;
    }

    // 6. Stats & QBABM
    const curWords = State.computed.validFoundWords.length;
    if (UI.mobWordsFoundCount) {
        if (prevWordsCount !== -1 && curWords > prevWordsCount) {
            UI.mobWordsFoundCount.classList.remove('pop-anim');
            void UI.mobWordsFoundCount.offsetWidth;
            UI.mobWordsFoundCount.classList.add('pop-anim');
        }
        UI.mobWordsFoundCount.innerText = curWords;
        prevWordsCount = curWords;
    }
    UI.wordsCount.innerText = curWords;
    UI.wordsTotal.innerText = State.parsed.totals.words || '?';
    if(UI.wordsTotalMob) UI.wordsTotalMob.innerText = State.parsed.totals.words || '?';
    if(UI.wordsCountMob) UI.wordsCountMob.innerText = State.computed.validFoundWords.length;
    UI.pointsCount.innerText = State.computed.score;
    if(UI.pointsCountMob) UI.pointsCountMob.innerText = State.computed.score;
    UI.pointsTotal.innerText = State.parsed.totals.points || '?';
    if(UI.pointsTotalMob) UI.pointsTotalMob.innerText = State.parsed.totals.points || '?';
    UI.pangramsCount.innerText = State.computed.pangrams;
    if(UI.pangramsCountMob) UI.pangramsCountMob.innerText = State.computed.pangrams;
    UI.pangramsTotal.innerText = State.parsed.totals.pangrams || '?';
    if(UI.pangramsTotalMob) UI.pangramsTotalMob.innerText = State.parsed.totals.pangrams || '?';
    
    if (State.computed.bingoStatus === 'Bingo!') {
        UI.bingoLabel.innerHTML = '<span style="color: #28a745; font-weight: bold;">Bingo!</span>';
        if(UI.bingoStatusMob) UI.bingoStatusMob.innerHTML = '<span style="color: #28a745; font-weight: bold;">Bingo!</span>';
    } else if (State.computed.bingoStatus !== 'N/A') {
        UI.bingoLabel.innerHTML = `Bingo: <span style="color: var(--text-color); font-weight: 500;">${State.computed.bingoStatus}</span>`;
        if(UI.bingoStatusMob) UI.bingoStatusMob.innerHTML = `<span style="color: var(--text-color); font-weight: 500;">${State.computed.bingoStatus}</span>`;
    } else {
        UI.bingoLabel.innerHTML = 'Bingo: <span style="color: var(--text-color); font-weight: 500;">N/A</span>';
        if(UI.bingoStatusMob) UI.bingoStatusMob.innerHTML = '<span style="color: var(--text-color); font-weight: 500;">N/A</span>';
    }

    if (State.parsed.totals.words > 0 && State.computed.validFoundWords.length >= State.parsed.totals.words) {
        UI.allFoundMessage.classList.remove('all-found-hidden');
        if(UI.allFoundMessageMob) UI.allFoundMessageMob.classList.remove('all-found-hidden');
        if(UI.mobAllFoundOverlay && !State.dismissedAllFound) {
            UI.mobAllFoundOverlay.classList.remove('all-found-hidden');
            if(UI.mobFoundInput) UI.mobFoundInput.disabled = true;
        }
    } else {
        State.dismissedAllFound = false; // Reset if words dropped
        UI.allFoundMessage.classList.add('all-found-hidden');
        if(UI.allFoundMessageMob) UI.allFoundMessageMob.classList.add('all-found-hidden');
        if(UI.mobAllFoundOverlay) {
            UI.mobAllFoundOverlay.classList.add('all-found-hidden');
            if(UI.mobFoundInput) UI.mobFoundInput.disabled = false;
        }
    }

    // 7. Grid & Two Letter
    renderGridUI();
}

function renderGridUI() {
    const grid = State.computed.grid;
    const twoLetter = State.computed.twoLetter;
    
    if (!grid.lengths.length) {
        UI.gridOutput.innerHTML = '<em>No grid data found</em>';
        return;
    }
    
    // Extract unique second letters for bigram columns
    const secondLetters = new Set();
    Object.keys(twoLetter).forEach(k => secondLetters.add(k[1]));
    const slArray = Array.from(secondLetters).sort();
    
    let html = '<div class="grid-legend" style="margin-bottom: 0.75rem; font-size: 0.8rem; display: flex; align-items: center; justify-content: flex-start;">';
    html += '<span style="display:inline-flex; align-items:center; margin-right:1rem;"><span style="display:inline-block; width:16px; height:8px; border-radius:4px; background:#f5f5f5; border:1px solid #ccc; margin-right:6px;"></span> first letter</span>';
    html += '<span style="display:inline-flex; align-items:center; margin-right:1rem;"><span style="display:inline-block; width:16px; height:8px; border-radius:4px; background:#ffffff; border:1px solid #ccc; margin-right:6px;"></span> word length</span>';
    html += '<span style="display:inline-flex; align-items:center; margin-right:1rem;"><span style="display:inline-block; width:16px; height:8px; border-radius:4px; background:#e3f2fd; border:1px solid #ccc; margin-right:6px;"></span> second letter</span>';
    html += '</div>';

    const totalCols = 1 + grid.lengths.length + 1 + slArray.length;
    const maxTableWidth = totalCols * 42;

    html += `<table style="max-width: ${maxTableWidth}px;"><thead>`;
    html += '<tr><th class="first-letter-cell"></th>';
    grid.lengths.forEach(l => html += `<th>${l}</th>`);
    html += '<th class="tot-cell">TOT</th>';
    slArray.forEach(sl => html += `<th class="bigram-cell">${sl.toUpperCase()}</th>`);
    html += '</tr></thead><tbody>';

    for (const [letter, counts] of Object.entries(grid.rows)) {
        html += `<tr><th class="first-letter-cell">${letter.toUpperCase()}</th>`;
        let rowSigma = 0;
        
        // Grid counts
        grid.lengths.forEach(l => {
            const count = counts[l] || 0;
            const origCount = State.parsed.grid.rows[letter]?.[l] || 0;
            if (count > 0) rowSigma += count;

            let tdHtml = '<span class="empty-dash">-</span><span class="empty-dot">.</span>';
            let clsList = '';
            let onclick = '';

            if (origCount > 0) {
                if (count <= 0) {
                    tdHtml = '0';
                    clsList = 'zero';
                } else {
                    tdHtml = count;
                    clsList = 'clickable';
                    onclick = `onclick="handleGridClick('${letter}', ${l})"`;
                }
            }
            html += `<td class="${clsList}" ${onclick}>${tdHtml}</td>`;
        });
        
        // row TOT
        html += `<th class="tot-cell ${rowSigma <= 0 ? 'zero' : ''}">${rowSigma || 0}</th>`;
        
        // Two Letter counts
        slArray.forEach(sl => {
            const bigram = letter + sl;
            const count = twoLetter[bigram];
            const origCount = State.parsed.twoLetter[bigram];
            
            let tdHtml = '<span class="empty-dash">-</span><span class="empty-dot">.</span>';
            let clsList = 'bigram-cell';
            let onclick = '';
            
            if (origCount > 0) {
                if (count <= 0) {
                    tdHtml = '0';
                    clsList += ' zero';
                } else {
                    tdHtml = count;
                    clsList += ' clickable';
                    onclick = `onclick="handleTwoLetterClick('${bigram}')"`;
                }
            }
            html += `<td class="${clsList}" ${onclick}>${tdHtml}</td>`;
        });
        
        html += '</tr>';
    }

    // Bottom TOT row
    html += `<tr><th class="tot-cell">TOT</th>`;
    grid.lengths.forEach(l => {
        const cTotal = State.computed.gridColTotals[l] || 0;
        html += `<th class="tot-cell ${cTotal <= 0 ? 'zero' : ''}">${cTotal}</th>`;
    });
    html += `<th class="tot-cell ${State.computed.gridTotalSigma <= 0 ? 'zero' : ''}">${State.computed.gridTotalSigma}</th>`;
    
    slArray.forEach(() => {
        html += '<th class="bigram-cell empty-dash">-</th>';
    });
    html += '</tr>';
    
    html += '</tbody></table>';
    
    UI.gridOutput.innerHTML = html;
}

function renderLookupUI() {
    const { start, contains, len, constrain, excludeFound } = State.lookup;
    
    if (!start && !contains && !len) {
        UI.lookupResults.classList.add('hidden');
        return;
    }
    UI.lookupResults.classList.remove('hidden');

    let sourceList = constrain ? State.validDailyWords : State.dictionary;
    if (excludeFound) {
        const foundSet = new Set(State.computed.validFoundWords);
        sourceList = sourceList.filter(w => !foundSet.has(w));
    }
    
    if (!sourceList.length) {
        UI.lookupResults.innerHTML = '<em>Awaiting hints, or all valid words are already found!</em>';
        return;
    }

    const results = sourceList.filter(w => {
        if (start && !w.startsWith(start)) return false;
        if (len && w.length !== len) return false;
        if (contains) {
            for (let c of contains.split('')) {
                if (!w.includes(c)) return false;
            }
        }
        return true;
    });

    if (results.length === 0) {
        UI.lookupResults.innerHTML = '<em>No matching words found in valid set.</em>';
    } else {
        const MAX_RESULTS = window.innerWidth <= 800 ? 15 : 100;
        const displayResults = results.slice(0, MAX_RESULTS);
        let html = displayResults.map(w => `<span class="dict-clickable" onclick="fetchDefinition('${w}')">${w}</span>`).join(' &middot; ');
        if (results.length > MAX_RESULTS) {
            html += ` <br><em style="color: var(--secondary); font-size: 0.85rem; margin-top: 0.5rem; display: block;">...and ${results.length - MAX_RESULTS} more words. Keep typing to narrow down!</em>`;
        }
        UI.lookupResults.innerHTML = html;
    }
}

/* --- EVENT HANDLERS (Mutate State -> Render) --- */

function formatCustomDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const d = date.getDate();
    const m = date.toLocaleString('default', { month: 'short' });
    const y = date.getFullYear();
    return `${d} ${m} ${y}`;
}

async function init() {
    // Dynamic Puzzle Link
    const d = new Date();
    const defaultDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    UI.puzzleDate.value = defaultDate;
    if (UI.customDateDisplay) UI.customDateDisplay.innerText = formatCustomDate(defaultDate);
    if(UI.puzzleDateMob) {
        UI.puzzleDateMob.value = defaultDate;
        if (UI.customDateDisplayMob) UI.customDateDisplayMob.innerText = formatCustomDate(defaultDate);
    }
    updatePuzzleLink(defaultDate);
    
    // Restore raw inputs
    UI.hintsInput.value = localStorage.getItem('workerBeeHints') || '';
    State.foundText = localStorage.getItem('workerBeeFound') || '';
    if(UI.foundInput) UI.foundInput.value = State.foundText;

    // Fast initial hydrate & render (NO DICTIONARY YET)
    if (UI.hintsInput.value.trim()) {
        const parsed = parseHintsText(UI.hintsInput.value);
        if (!parsed.error) {
            State.parsed = parsed;
            // validDailyWords will be empty array for now
        }
    }
    State.computed = computeState(State.parsed, State.foundText);
    render();
    
    // Enable CSS transitions after initial synchronous render
    setTimeout(() => document.body.classList.add('loaded'), 10);

    // Async Load Dictionary in the background
    try {
        const response = await fetch('words.txt');
        if (!response.ok) throw new Error();
        State.dictionary = (await response.text()).split('\n').map(w => w.trim().toLowerCase()).filter(w => w.length >= 4);
        
        // Once dictionary is loaded, populate valid words and re-render
        if (State.parsed.isLoaded) {
            State.validDailyWords = getValidDailyWords(State.dictionary, State.parsed.centerLetter, State.parsed.outerLetters);
            render();
        }
    } catch (e) {
        console.error(e);
    }
}

function updatePuzzleLink(dateStr) {
    if (!dateStr) return;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const url = `https://www.nytimes.com/${parts[0]}/${parts[1]}/${parts[2]}/crosswords/spelling-bee-forum.html`;
        UI.puzzleLink.href = url;
        if(UI.puzzleLinkMob) UI.puzzleLinkMob.href = url;
    }
}

// Global UI clicks from dynamic HTML
window.handleGridClick = (letter, len) => {
    State.lookup.start = letter;
    State.lookup.len = len;
    State.lookup.contains = '';
    UI.luStart.value = letter;
    UI.luLength.value = len;
    UI.luContains.value = '';
    render();
};

window.handleTwoLetterClick = (prefix) => {
    State.lookup.start = prefix;
    State.lookup.len = 0;
    State.lookup.contains = '';
    UI.luStart.value = prefix;
    UI.luLength.value = '';
    UI.luContains.value = '';
    render();
};

/* Attach Listeners */
UI.puzzleDate.addEventListener('change', e => {
    updatePuzzleLink(e.target.value);
    if (UI.customDateDisplay) UI.customDateDisplay.innerText = formatCustomDate(e.target.value);
    render(); 
});

UI.btnLoadHints.addEventListener('click', () => {
    const parsed = parseHintsText(UI.hintsInput.value);
    if (parsed.error) {
        State.hintsError = parsed.error;
    } else {
        State.hintsError = null;
        State.parsed = parsed;
        State.validDailyWords = getValidDailyWords(State.dictionary, parsed.centerLetter, parsed.outerLetters);
        State.computed = computeState(State.parsed, State.foundText);
    }
    render();
});

UI.btnEditHints.addEventListener('click', () => {
    State.parsed.isLoaded = false; // Just toggle view
    render();
});

UI.btnClearHints.addEventListener('click', () => {
    UI.hintsInput.value = '';
    State.hintsError = null;
    State.parsed = { isLoaded: false, centerLetter: '', outerLetters: [], totals: { words: 0, points: 0, pangrams: 0, bingo: false }, grid: { lengths: [], rows: {} }, twoLetter: {} };
    State.computed = computeState(State.parsed, State.foundText);
    render();
});

UI.wordsFoundModalContent.addEventListener('input', e => {
    const normalized = e.target.value.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ');
    if (normalized !== e.target.value) {
        e.target.value = normalized;
    }
    State.foundText = e.target.value.toLowerCase().replace(/[^a-z\s]/g, '');
    if (UI.foundInput) UI.foundInput.value = State.foundText;
    State.computed = computeState(State.parsed, State.foundText);
    render();
});

if (UI.btnEditWordsMob) {
    UI.btnEditWordsMob.addEventListener('click', () => {
        const isEditing = !UI.wordsFoundModalContent.classList.contains('hidden');
        if (isEditing) {
            UI.wordsFoundModalContent.classList.add('hidden');
            UI.wordsFoundModalDisplay.innerText = State.foundText || 'No words entered yet.';
            UI.wordsFoundModalDisplay.classList.remove('hidden');
            UI.btnEditWordsMob.innerText = 'Edit';
        } else {
            UI.wordsFoundModalDisplay.classList.add('hidden');
            UI.wordsFoundModalContent.classList.remove('hidden');
            UI.btnEditWordsMob.innerText = 'Done';
            UI.wordsFoundModalContent.focus();
        }
    });
}

UI.foundInput.addEventListener('input', e => {
    // Normalize input: replace all newlines and multiple spaces with a single space
    const normalized = e.target.value.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ');
    if (normalized !== e.target.value) {
        e.target.value = normalized;
    }
    State.foundText = e.target.value;
    State.computed = computeState(State.parsed, State.foundText);
    render();
});

if (UI.mobFoundInput) {
    const handleMobInput = (e) => {
        const val = e.target.value;
        if (e.key === 'Enter' || e.type === 'blur' || val.includes(' ') || val.includes(',') || val.includes('\n')) {
            const clean = val.replace(/[\r\n,]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
            if (clean) {
                const wordsToAdd = clean.split(/\s+/);
                const currentWords = State.foundText.split(/\s+/).filter(w=>w);
                for (let w of wordsToAdd) {
                    if (!currentWords.includes(w)) {
                        currentWords.push(w);
                    }
                }
                State.foundText = currentWords.join(' ');
                
                if (UI.foundInput) UI.foundInput.value = State.foundText;
                State.computed = computeState(State.parsed, State.foundText);
                e.target.value = '';
                render();
            }
        }
    };
    UI.mobFoundInput.addEventListener('input', handleMobInput);
    UI.mobFoundInput.addEventListener('blur', handleMobInput);
    UI.mobFoundInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleMobInput(e);
    });
}

if (UI.btnCloseAllFound) {
    UI.btnCloseAllFound.addEventListener('click', () => {
        State.dismissedAllFound = true;
        if (UI.mobAllFoundOverlay) UI.mobAllFoundOverlay.classList.add('all-found-hidden');
        if (UI.mobFoundInput) UI.mobFoundInput.disabled = false;
    });
}

UI.btnClearFound.addEventListener('click', () => {
    State.foundText = '';
    State.computed = computeState(State.parsed, State.foundText);
    render();
});

// Edit Center UI Flow
UI.linkEditCenter.addEventListener('click', e => {
    e.preventDefault();
    UI.editCenterUi.classList.toggle('hidden');
    if (!UI.editCenterUi.classList.contains('hidden')) {
        UI.editCenterInput.value = '';
        UI.editCenterInput.focus();
    }
});

UI.btnSaveCenter.addEventListener('click', () => {
    let newCenter = UI.editCenterInput.value.toLowerCase().trim();
    if (newCenter && /^[a-z]$/.test(newCenter)) {
        const all = [State.parsed.centerLetter, ...State.parsed.outerLetters];
        if (all.includes(newCenter)) {
            State.parsed.outerLetters = all.filter(char => char !== newCenter);
            State.parsed.centerLetter = newCenter;
            State.validDailyWords = getValidDailyWords(State.dictionary, State.parsed.centerLetter, State.parsed.outerLetters);
            State.computed = computeState(State.parsed, State.foundText);
            render();
        }
    }
    UI.editCenterUi.classList.add('hidden');
});

UI.editCenterInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') UI.btnSaveCenter.click();
    if (e.key === 'Escape') UI.editCenterUi.classList.add('hidden');
});

// Query Listeners
const updateLookupState = () => {
    const cleanStart = UI.luStart.value.replace(/[^a-zA-Z]/g, '');
    if(UI.luStart.value !== cleanStart) UI.luStart.value = cleanStart;
    State.lookup.start = cleanStart.toLowerCase();
    const cleanContains = UI.luContains.value.replace(/[^a-zA-Z]/g, '');
    if(UI.luContains.value !== cleanContains) UI.luContains.value = cleanContains;
    State.lookup.contains = cleanContains.toLowerCase();
    
    
    let len = parseInt(UI.luLength.value);
    State.lookup.len = len || 0;
    
    State.lookup.constrain = UI.cbConstrain.checked;
    State.lookup.excludeFound = UI.cbExcludeFound.checked;
    render();
};

UI.luLength.addEventListener('blur', () => {
    let len = parseInt(UI.luLength.value);
    if (UI.luLength.value !== '' && len < 4) {
        UI.luLength.value = 4;
        updateLookupState();
    }
});

UI.luStart.addEventListener('input', updateLookupState);
UI.luContains.addEventListener('input', updateLookupState);
UI.luLength.addEventListener('input', updateLookupState);
UI.cbConstrain.addEventListener('change', updateLookupState);
UI.cbExcludeFound.addEventListener('change', updateLookupState);

// Bootstrap
init();



/* --- Dictionary API Logic --- */
const dictModal = document.getElementById('dict-modal');
const dictWord = document.getElementById('dict-word');
const dictPhonetic = document.getElementById('dict-phonetic');
const dictMeanings = document.getElementById('dict-meanings');
const dictError = document.getElementById('dict-error');
const dictClose = document.getElementById('dict-close');

if (dictClose) {
    dictClose.addEventListener('click', () => dictModal.classList.add('hidden'));
}
if (dictModal) {
    dictModal.addEventListener('click', (e) => {
        if (e.target === dictModal) dictModal.classList.add('hidden');
    });
}

async function fetchDefinition(word) {
    if (!dictModal) return;
    dictModal.classList.remove('hidden');
    dictWord.innerText = word;
    dictPhonetic.innerText = "Loading...";
    dictMeanings.innerHTML = "";
    dictError.classList.add('hidden');
    
    try {
        const res = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${word}`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        
        if (!data.en || data.en.length === 0) throw new Error("No English definitions found");
        
        dictPhonetic.innerText = ""; // Phonetic text not reliably provided in this API endpoint
        
        let meaningsHtml = '<ul class="dict-defs">';
        data.en.forEach(m => {
            if (m.definitions && m.definitions.length > 0) {
                // Strip HTML tags from Wiktionary response
                const rawDef = m.definitions[0].definition;
                const cleanDef = rawDef.replace(/<[^>]+>/g, '');
                meaningsHtml += `<li class="dict-meaning">
                    <span class="dict-part">${m.partOfSpeech}</span>
                    <div>${cleanDef}</div>
                </li>`;
            }
        });
        meaningsHtml += '</ul>';
        dictMeanings.innerHTML = meaningsHtml;
        
    } catch (e) {
        dictPhonetic.innerText = "";
        dictError.classList.remove('hidden');
    }
}

if (UI.puzzleDateMob) {
    UI.puzzleDateMob.addEventListener('change', (e) => {
        UI.puzzleDate.value = e.target.value;
        if (UI.customDateDisplayMob) UI.customDateDisplayMob.innerText = formatCustomDate(e.target.value);
        if (UI.customDateDisplay) UI.customDateDisplay.innerText = formatCustomDate(e.target.value);
        updatePuzzleLink(e.target.value);
    });
}

const btnHowToMob = document.getElementById('btn-how-to-mob');
const howToModal = document.getElementById('how-to-modal');
const howToClose = document.getElementById('how-to-close');

if (btnHowToMob) {
    btnHowToMob.addEventListener('click', (e) => {
        e.preventDefault();
        howToModal.classList.remove('hidden');
    });
}

if (howToClose) {
    howToClose.addEventListener('click', () => {
        howToModal.classList.add('hidden');
    });
}

window.addEventListener('click', (e) => {
    if (e.target === howToModal) {
        howToModal.classList.add('hidden');
    }
    if (UI.wordsFoundModal && e.target === UI.wordsFoundModal) {
        UI.wordsFoundModal.classList.add('hidden');
    }
    if (UI.ignoredModal && e.target === UI.ignoredModal) {
        UI.ignoredModal.classList.add('hidden');
    }
});

// Mobile Clear Found
if (UI.btnClearFoundMob) {
    UI.btnClearFoundMob.addEventListener('click', () => {
        State.foundText = '';
        if (UI.foundInput) UI.foundInput.value = '';
        State.computed = computeState(State.parsed, State.foundText);
        render();
    });
}

// Words Found Modal
if (UI.mobWordsFoundLink) {
    UI.mobWordsFoundLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (UI.wordsFoundModalContent.value !== State.foundText) {
            UI.wordsFoundModalContent.value = State.foundText;
        }
        UI.wordsFoundModalDisplay.innerText = State.foundText || 'No words entered yet.';
        UI.wordsFoundModal.classList.remove('hidden');
    });
}
if (UI.wordsFoundClose) {
    UI.wordsFoundClose.addEventListener('click', () => {
        UI.wordsFoundModal.classList.add('hidden');
    });
}

// Ignored Words Modal
if (UI.mobIgnoredLink) {
    UI.mobIgnoredLink.addEventListener('click', (e) => {
        e.preventDefault();
        UI.ignoredModalContent.innerHTML = UI.foundWarning.innerHTML || '<li>No words ignored.</li>';
        UI.ignoredModal.classList.remove('hidden');
    });
}
if (UI.ignoredClose) {
    UI.ignoredClose.addEventListener('click', () => {
        UI.ignoredModal.classList.add('hidden');
    });
}
