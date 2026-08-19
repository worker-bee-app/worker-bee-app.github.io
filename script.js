let dictionary = [];
let validDailyWords = [];
let parsedState = {
    centerLetter: '',
    outerLetters: [],
    totals: { words: 0, points: 0, pangrams: 0, bingo: false },
    grid: { lengths: [], rows: {} },
    twoLetter: {}
};

const hintsInput = document.getElementById('hints-input');
const foundInput = document.getElementById('found-input');
const wordsCount = document.getElementById('words-count');
const wordsTotal = document.getElementById('words-total');
const pointsCount = document.getElementById('points-count');
const pointsTotal = document.getElementById('points-total');
const pangramsCount = document.getElementById('pangrams-count');
const pangramsTotal = document.getElementById('pangrams-total');
const bingoStatus = document.getElementById('bingo-status');
const gridOutput = document.getElementById('grid-output');
const twoLetterOutput = document.getElementById('two-letter-output');
const qStart = document.getElementById('q-start');
const qContains = document.getElementById('q-contains');
const qLength = document.getElementById('q-length');
const queryResults = document.getElementById('query-results');

const hintsContainer = document.getElementById('hints-container');
const lettersSetup = document.getElementById('letters-setup');
const letterButtons = document.getElementById('letter-buttons');
const btnEditHints = document.getElementById('btn-edit-hints');
const nytLink = document.getElementById('nyt-link');
const nytDate = document.getElementById('nyt-date');
const btnLoadHints = document.getElementById('btn-load-hints');
const btnClearHints = document.getElementById('btn-clear-hints');
const btnClearFound = document.getElementById('btn-clear-found');
const cbConstrain = document.getElementById('cb-constrain');

// Set dynamic NYT Link
const d = new Date();
const m = String(d.getMonth() + 1).padStart(2, '0');
const day = String(d.getDate()).padStart(2, '0');
const defaultDate = `${d.getFullYear()}-${m}-${day}`;
nytDate.value = defaultDate;
updateNytLink(defaultDate);

nytDate.addEventListener('change', (e) => updateNytLink(e.target.value));

function updateNytLink(dateStr) {
    if (!dateStr) return;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        nytLink.href = `https://www.nytimes.com/${parts[0]}/${parts[1]}/${parts[2]}/crosswords/spelling-bee-forum.html`;
    }
}

async function loadDictionary() {
    try {
        const response = await fetch('words.txt');
        if (!response.ok) throw new Error('Dictionary file not found.');
        const text = await response.text();
        dictionary = text.split('\n').map(w => w.trim().toLowerCase()).filter(w => w.length >= 4);
        
        // Restore State
        hintsInput.value = localStorage.getItem('workerBeeHints') || '';
        foundInput.value = localStorage.getItem('workerBeeFound') || '';
        if (hintsInput.value.trim()) parseHints();
        
    } catch (e) {
        console.error(e);
        alert('Failed to load dictionary (requires a local server).');
    }
}

btnLoadHints.addEventListener('click', parseHints);
foundInput.addEventListener('input', updateState);
btnEditHints.addEventListener('click', () => {
    lettersSetup.classList.add('hidden');
    hintsContainer.classList.remove('hidden');
});

btnClearHints.addEventListener('click', () => {
    hintsInput.value = '';
    localStorage.removeItem('workerBeeHints');
    
    // Reset state
    parsedState.grid = { lengths: [], rows: {} };
    parsedState.twoLetter = {};
    parsedState.totals = { words: 0, points: 0, pangrams: 0, bingo: false };
    parsedState.centerLetter = '';
    parsedState.outerLetters = [];
    
    hintsContainer.classList.remove('hidden');
    lettersSetup.classList.add('hidden');
    updateState();
});

btnClearFound.addEventListener('click', () => {
    foundInput.value = '';
    localStorage.removeItem('workerBeeFound');
    updateState();
});

cbConstrain.addEventListener('change', runQuery);

[qStart, qContains].forEach(el => {
    el.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^a-zA-Z]/g, '');
        runQuery();
    });
});
qLength.addEventListener('input', runQuery);

function parseHints() {
    const text = hintsInput.value.toLowerCase();
    localStorage.setItem('workerBeeHints', hintsInput.value);
    
    if (!text.trim()) return;

    // Reset state
    parsedState.grid = { lengths: [], rows: {} };
    parsedState.twoLetter = {};
    parsedState.totals = { words: 0, points: 0, pangrams: 0, bingo: false };
    parsedState.centerLetter = '';
    parsedState.outerLetters = [];

    // Extract Letters
    const lines = text.split('\n').map(l => l.trim());
    for (const line of lines) {
        const letterMatch = line.match(/^([a-z]\s+){6}[a-z]$/i);
        if (letterMatch) {
            const letters = line.replace(/\s+/g, '').split('');
            parsedState.centerLetter = letters[0];
            parsedState.outerLetters = letters.slice(1);
            break;
        }
    }

    // Extract Totals
    const wordsMatch = text.match(/words:\s*(\d+)/i);
    const pointsMatch = text.match(/points:\s*(\d+)/i);
    const pMatch = text.match(/pangrams:\s*(\d+)/i);
    const bMatch = text.match(/bingo/i);
    if (wordsMatch) parsedState.totals.words = parseInt(wordsMatch[1]);
    if (pointsMatch) parsedState.totals.points = parseInt(pointsMatch[1]);
    if (pMatch) parsedState.totals.pangrams = parseInt(pMatch[1]);
    if (bMatch) parsedState.totals.bingo = true;

    // Extract Grid
    let gridStarted = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!gridStarted) {
            if (line.match(/^(?:\d+\s+)+[σΣ]/i) || (line.includes('4') && line.includes('5') && line.includes('Σ'))) {
                gridStarted = true;
                parsedState.grid.lengths = line.match(/\d+/g).map(Number);
            }
        } else {
            if (line.includes('Σ') || line.includes('sigma')) break;
            const rowMatch = line.match(/^([a-z]):\s*(.*)$/i);
            if (rowMatch) {
                const letter = rowMatch[1];
                const parts = rowMatch[2].split(/\s+/);
                parsedState.grid.rows[letter] = {};
                for (let j = 0; j < parsedState.grid.lengths.length; j++) {
                    const val = parts[j];
                    if (val && val !== '-') {
                        parsedState.grid.rows[letter][parsedState.grid.lengths[j]] = parseInt(val) || 0;
                    }
                }
            }
        }
    }

    // Extract Two-Letter List
    const tlMatches = text.matchAll(/([a-z]{2})-(\d+)/g);
    for (const match of tlMatches) {
        parsedState.twoLetter[match[1]] = parseInt(match[2]);
    }

    if (parsedState.centerLetter) {
        hintsContainer.classList.add('hidden');
        lettersSetup.classList.remove('hidden');
        renderLetterButtons();
        prefilterDictionary();
    } else {
        alert(`Could not detect letters. Ensure they are on their own line separated by spaces.`);
    }

    updateState();
}

function renderLetterButtons() {
    const all = [parsedState.centerLetter, ...parsedState.outerLetters];
    letterButtons.innerHTML = '';
    all.forEach(l => {
        const btn = document.createElement('button');
        btn.className = 'letter-btn' + (l === parsedState.centerLetter ? ' center' : '');
        btn.innerText = l;
        btn.onclick = () => {
            parsedState.outerLetters = all.filter(char => char !== l);
            parsedState.centerLetter = l;
            renderLetterButtons();
            prefilterDictionary();
            updateState();
        };
        letterButtons.appendChild(btn);
    });
}

function prefilterDictionary() {
    if (!dictionary.length || !parsedState.centerLetter) return;
    const allLetters = new Set([parsedState.centerLetter, ...parsedState.outerLetters]);
    validDailyWords = dictionary.filter(w => {
        if (!w.includes(parsedState.centerLetter)) return false;
        for (let char of w) {
            if (!allLetters.has(char)) return false;
        }
        return true;
    });
}

function updateState() {
    localStorage.setItem('workerBeeFound', foundInput.value);

    if (Object.keys(parsedState.twoLetter).length === 0) return;

    const foundText = foundInput.value.toLowerCase();
    const foundWords = foundText.match(/[a-z]{4,}/g) || [];
    const uniqueFoundWords = [...new Set(foundWords)];

    let foundScore = 0;
    let foundPangrams = 0;
    let foundStartLetters = new Set();
    let remGrid = JSON.parse(JSON.stringify(parsedState.grid));
    let remTwoLetter = { ...parsedState.twoLetter };
    const allLetters = new Set([parsedState.centerLetter, ...parsedState.outerLetters]);

    uniqueFoundWords.forEach(w => {
        foundStartLetters.add(w[0]);
        // Points calculation
        if (w.length === 4) foundScore += 1;
        else if (w.length > 4) {
            foundScore += w.length;
            const uniqueChars = new Set(w);
            let isPangram = true;
            for (let l of allLetters) {
                if (!uniqueChars.has(l)) {
                    isPangram = false;
                    break;
                }
            }
            if (isPangram) { foundScore += 7; foundPangrams++; }
        }

        // Decrement Grid
        const first = w[0];
        const len = w.length;
        if (remGrid.rows[first] && remGrid.rows[first][len]) {
            remGrid.rows[first][len]--;
        }

        // Decrement Two-Letter
        const prefix = w.substring(0, 2);
        if (remTwoLetter[prefix]) {
            remTwoLetter[prefix]--;
        }
    });

    wordsCount.innerText = uniqueFoundWords.length;
    wordsTotal.innerText = parsedState.totals.words || '?';
    pointsCount.innerText = foundScore;
    pointsTotal.innerText = parsedState.totals.points || '?';
    pangramsCount.innerText = foundPangrams;
    pangramsTotal.innerText = parsedState.totals.pangrams || '?';

    if (parsedState.totals.bingo) {
        if (foundStartLetters.size === 7) {
            bingoStatus.innerText = '✅ Achieved!';
        } else {
            const missing = [...allLetters].filter(l => !foundStartLetters.has(l));
            bingoStatus.innerText = 'Missing ' + missing.join(', ').toUpperCase();
        }
    } else {
        bingoStatus.innerText = 'N/A';
    }

    renderGrid(remGrid);
    renderTwoLetter(remTwoLetter);
    runQuery();
}

function renderGrid(remGrid) {
    if (!remGrid.lengths.length) {
        gridOutput.innerHTML = '<em>No grid data found</em>';
        return;
    }
    let html = '<table><thead><tr><th></th>';
    remGrid.lengths.forEach(l => html += `<th>${l}</th>`);
    html += '</tr></thead><tbody>';

    for (const [letter, counts] of Object.entries(remGrid.rows)) {
        html += `<tr><th>${letter.toUpperCase()}</th>`;
        remGrid.lengths.forEach(l => {
            const count = counts[l] || 0;
            const tdHtml = count <= 0 ? '-' : count;
            const clsList = (count <= 0 ? 'zero ' : '') + (count > 0 ? 'clickable' : '');
            let onclick = '';
            if (count > 0) {
                onclick = `onclick="qStart.value='${letter}'; qLength.value='${l}'; qContains.value=''; runQuery();"`;
            }
            html += `<td class="${clsList}" ${onclick}>${tdHtml}</td>`;
        });
        html += `</tr>`;
    }
    html += '</tbody></table>';
    gridOutput.innerHTML = html;
}

function renderTwoLetter(remTwoLetter) {
    let html = '';
    const sortedKeys = Object.keys(remTwoLetter).sort();
    sortedKeys.forEach(k => {
        const count = remTwoLetter[k];
        const clsList = 'two-letter-item ' + (count <= 0 ? 'zero' : 'clickable');
        let onclick = '';
        if (count > 0) {
            onclick = `onclick="qStart.value='${k}'; qLength.value=''; qContains.value=''; runQuery();"`;
        }
        html += `<span class="${clsList}" ${onclick}>${k.toUpperCase()}-${count}</span>`;
    });
    twoLetterOutput.innerHTML = html || '<em>No two-letter data found</em>';
}

function runQuery() {
    const start = qStart.value.toLowerCase().trim();
    const contains = qContains.value.toLowerCase().trim();
    const len = parseInt(qLength.value);

    if (!start && !contains && !len) {
        queryResults.classList.add('hidden');
        return;
    }
    
    queryResults.classList.remove('hidden');

    const sourceList = cbConstrain.checked ? validDailyWords : dictionary;
    if (!sourceList.length) {
        queryResults.innerHTML = '<em>Awaiting hints or dictionary...</em>';
        return;
    }

    let results = sourceList.filter(w => {
        if (start && !w.startsWith(start)) return false;
        if (len && w.length !== len) return false;
        if (contains) {
            const chars = contains.split('');
            for (let c of chars) {
                if (!w.includes(c)) return false;
            }
        }
        return true;
    });

    if (results.length === 0) {
        queryResults.innerHTML = '<em>No matching words found in valid set.</em>';
    } else {
        queryResults.innerHTML = results.join('<br>');
    }
}

loadDictionary();
