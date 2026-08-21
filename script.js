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
    query: {
        start: '',
        contains: '',
        len: 0,
        constrain: false,
        excludeFound: false
    }
};

/* DOM Caching Helper */
const $ = id => document.getElementById(id);

const UI = {
    hintsInput: $('hints-input'),
    foundInput: $('found-input'),
    wordsCount: $('words-count'),
    wordsTotal: $('words-total'),
    pointsCount: $('points-count'),
    pointsTotal: $('points-total'),
    pangramsCount: $('pangrams-count'),
    pangramsTotal: $('pangrams-total'),
    bingoLabel: $('bingo-label'),
    gridOutput: $('grid-output'),
    twoLetterOutput: $('two-letter-output'),
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
    
    nytLink: $('nyt-link'),
    nytDate: $('nyt-date'),
    
    ignoredCount: $('ignored-count'),
    foundWarning: $('found-warning'),
    qbabmMessage: $('qbabm-message'),
    hintsError: $('hints-error'),
    chevronInd: $('chevron-indicator'),
    rightPaneTitle: $('right-pane-title'),
    
    editCenterUi: $('edit-center-ui'),
    editCenterInput: $('edit-center-input'),
    linkEditCenter: $('link-edit-center')
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
            if (line.match(/^(?:\d+\s+)+[σΣ]/i) || (line.includes('4') && line.includes('5') && line.includes('Σ') && line.match(/\d/))) {
                gridStarted = true;
                p.grid.lengths = line.match(/\d+/g).map(Number);
            }
        } else {
            if (line.includes('Σ') || line.includes('sigma')) break;
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
    const tlMatches = text.matchAll(/([a-z]{2})-(\d+)/g);
    for (const match of tlMatches) {
        p.twoLetter[match[1]] = parseInt(match[2]);
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

/* --- RENDER FUNCTION --- */

function render() {
    // 1. Inputs Sync
    if (UI.hintsInput.value !== localStorage.getItem('workerBeeHints')) {
        localStorage.setItem('workerBeeHints', UI.hintsInput.value);
    }
    if (UI.foundInput.value !== State.foundText) {
        UI.foundInput.value = State.foundText;
        localStorage.setItem('workerBeeFound', State.foundText);
    }
    
    // 2. View Toggle
    if (State.parsed.isLoaded) {
        UI.hintsContainer.classList.add('hidden');
        UI.orbitWrapper.classList.remove('hidden');
        UI.btnEditHints.classList.remove('hidden');
        if (UI.chevronInd) UI.chevronInd.classList.add('hidden');
        
        let dateStr = UI.nytDate.value;
        let formattedDate = dateStr;
        if (dateStr) {
            const dateObj = new Date(dateStr + "T00:00:00");
            formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }).replace(',', '');
        }
        UI.rightPaneTitle.innerText = `Showing hints for ${formattedDate || 'selected date'}`;
    } else {
        UI.hintsContainer.classList.remove('hidden');
        UI.orbitWrapper.classList.add('hidden');
        UI.btnEditHints.classList.add('hidden');
        if (UI.chevronInd) UI.chevronInd.classList.remove('hidden');
        UI.rightPaneTitle.innerText = 'Paste Hints';
    }

    // 3. Hints Error
    if (State.hintsError) {
        UI.hintsError.textContent = State.hintsError;
        UI.hintsError.classList.remove('hidden');
    } else {
        UI.hintsError.classList.add('hidden');
    }

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
    } else {
        UI.ignoredCount.classList.add('hidden');
        UI.foundWarning.classList.add('hidden');
    }

    // 6. Stats & QBABM
    UI.wordsCount.innerText = State.computed.validFoundWords.length;
    UI.wordsTotal.innerText = State.parsed.totals.words || '?';
    UI.pointsCount.innerText = State.computed.score;
    UI.pointsTotal.innerText = State.parsed.totals.points || '?';
    UI.pangramsCount.innerText = State.computed.pangrams;
    UI.pangramsTotal.innerText = State.parsed.totals.pangrams || '?';
    
    if (State.computed.bingoStatus === 'Bingo!') {
        UI.bingoLabel.innerHTML = 'Bingo: <span style="color: #28a745; font-weight: bold;">Bingo!</span>';
    } else if (State.computed.bingoStatus !== 'N/A') {
        UI.bingoLabel.innerHTML = `Bingo: <span style="color: var(--text-color); font-weight: 500;">${State.computed.bingoStatus}</span>`;
    } else {
        UI.bingoLabel.innerHTML = 'Bingo: <span style="color: var(--text-color); font-weight: 500;">N/A</span>';
    }

    if (State.parsed.totals.words > 0 && State.computed.validFoundWords.length >= State.parsed.totals.words) {
        UI.qbabmMessage.classList.remove('qbabm-hidden');
    } else {
        UI.qbabmMessage.classList.add('qbabm-hidden');
    }

    // 7. Grid & Two Letter
    renderGridUI();
    renderTwoLetterUI();
    renderLookupUI();
}

function renderGridUI() {
    const grid = State.computed.grid;
    if (!grid.lengths.length) {
        UI.gridOutput.innerHTML = '<em>No grid data found</em>';
        return;
    }
    
    let html = '<table><thead><tr><th></th>';
    grid.lengths.forEach(l => html += `<th>${l}</th>`);
    html += '<th>Σ</th></tr></thead><tbody>';

    for (const [letter, counts] of Object.entries(grid.rows)) {
        html += `<tr><th>${letter.toUpperCase()}</th>`;
        let rowSigma = 0;
        
        grid.lengths.forEach(l => {
            const count = counts[l] || 0;
            const origCount = State.parsed.grid.rows[letter]?.[l] || 0;
            if (count > 0) rowSigma += count;

            let tdHtml = '-';
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
        html += `<th class="${rowSigma <= 0 ? 'zero' : ''}">${rowSigma || 0}</th></tr>`;
    }

    html += `<tr><th>Σ</th>`;
    grid.lengths.forEach(l => {
        const cTotal = State.computed.gridColTotals[l] || 0;
        html += `<th class="${cTotal <= 0 ? 'zero' : ''}">${cTotal}</th>`;
    });
    html += `<th class="${State.computed.gridTotalSigma <= 0 ? 'zero' : ''}">${State.computed.gridTotalSigma}</th></tr>`;
    html += '</tbody></table>';
    
    UI.gridOutput.innerHTML = html;
}

function renderTwoLetterUI() {
    const twoLetter = State.computed.twoLetter;
    let html = '';
    let currentLetter = '';
    
    Object.keys(twoLetter).sort().forEach(k => {
        const count = twoLetter[k];
        const clsList = 'two-letter-item ' + (count <= 0 ? 'zero' : 'clickable');
        const onclick = count > 0 ? `onclick="handleTwoLetterClick('${k}')"` : '';
        
        if (currentLetter && currentLetter !== k[0]) html += '<br>';
        currentLetter = k[0];
        
        html += `<span class="${clsList}" ${onclick}>${k.toUpperCase()}-${count}</span>`;
    });
    
    UI.twoLetterOutput.innerHTML = html || '<em>No two-letter data found</em>';
}

function renderLookupUI() {
    const { start, contains, len, constrain, excludeFound } = State.lookup;
    
    if (!start && !contains && !len) {
        UI.queryResults.classList.add('hidden');
        return;
    }
    UI.queryResults.classList.remove('hidden');

    let sourceList = constrain ? State.validDailyWords : State.dictionary;
    if (excludeFound) {
        const foundSet = new Set(State.computed.validFoundWords);
        sourceList = sourceList.filter(w => !foundSet.has(w));
    }
    
    if (!sourceList.length) {
        UI.queryResults.innerHTML = '<em>Awaiting hints, or all valid words are already found!</em>';
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

    UI.queryResults.innerHTML = results.length === 0 
        ? '<em>No matching words found in valid set.</em>' 
        : results.join('<br>');
}

/* --- EVENT HANDLERS (Mutate State -> Render) --- */

async function init() {
    // Dynamic NYT Link
    const d = new Date();
    const defaultDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    UI.nytDate.value = defaultDate;
    updateNytLink(defaultDate);
    
    // Restore raw inputs
    UI.hintsInput.value = localStorage.getItem('workerBeeHints') || '';
    State.foundText = localStorage.getItem('workerBeeFound') || '';

    // Load Dictionary
    try {
        const response = await fetch('words.txt');
        if (!response.ok) throw new Error();
        State.dictionary = (await response.text()).split('\n').map(w => w.trim().toLowerCase()).filter(w => w.length >= 4);
    } catch (e) {
        console.error(e);
        // Fallback or ignore
    }

    // Hydrate State if hints exist
    if (UI.hintsInput.value.trim()) {
        const parsed = parseHintsText(UI.hintsInput.value);
        if (!parsed.error) {
            State.parsed = parsed;
            State.validDailyWords = getValidDailyWords(State.dictionary, parsed.centerLetter, parsed.outerLetters);
        }
    }
    
    State.computed = computeState(State.parsed, State.foundText);
    render();
}

function updateNytLink(dateStr) {
    if (!dateStr) return;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        UI.nytLink.href = `https://www.nytimes.com/${parts[0]}/${parts[1]}/${parts[2]}/crosswords/spelling-bee-forum.html`;
    }
}

// Global UI clicks from dynamic HTML
window.handleGridClick = (letter, len) => {
    State.lookup.start = letter;
    State.lookup.len = len;
    State.lookup.contains = '';
    UI.qStart.value = letter;
    UI.qLength.value = len;
    UI.qContains.value = '';
    render();
};

window.handleTwoLetterClick = (prefix) => {
    State.lookup.start = prefix;
    State.lookup.len = 0;
    State.lookup.contains = '';
    UI.qStart.value = prefix;
    UI.qLength.value = '';
    UI.qContains.value = '';
    render();
};

/* Attach Listeners */
UI.nytDate.addEventListener('change', e => {
    updateNytLink(e.target.value);
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

UI.foundInput.addEventListener('input', e => {
    State.foundText = e.target.value;
    State.computed = computeState(State.parsed, State.foundText);
    render();
});

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
    State.lookup.start = UI.qStart.value.toLowerCase().replace(/[^a-z]/g, '');
    State.lookup.contains = UI.qContains.value.toLowerCase().replace(/[^a-z]/g, '');
    UI.qStart.value = State.lookup.start;
    UI.qContains.value = State.lookup.contains;
    
    let len = parseInt(UI.qLength.value);
    if (UI.qLength.value !== '' && len < 4) { len = 4; UI.qLength.value = 4; }
    State.lookup.len = len || 0;
    
    State.lookup.constrain = UI.cbConstrain.checked;
    State.lookup.excludeFound = UI.cbExcludeFound.checked;
    render();
};

UI.qStart.addEventListener('input', updateLookupState);
UI.qContains.addEventListener('input', updateLookupState);
UI.qLength.addEventListener('input', updateLookupState);
UI.cbConstrain.addEventListener('change', updateLookupState);
UI.cbExcludeFound.addEventListener('change', updateLookupState);

// Bootstrap
init();
