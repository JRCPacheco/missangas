document.addEventListener('DOMContentLoaded', () => {
    // ─────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────
    const FIXED_ROWS = 12; // Bead loom always has 12 rows (nylon threads)
    const DEFAULT_CELL_SIZE = 24;

    const state = {
        rows: FIXED_ROWS,
        cols: 20,           // Calculated dynamically; 20 is a safe fallback
        cellSize: DEFAULT_CELL_SIZE,
        colors: [],
        selectedColor: '#f97316',
        tool: 'pencil',
        isDrawing: false,
        startCellIndex: null,
        previewIndices: [],
        history: [],
        historyIndex: -1,
        maxHistory: 30
    };

    // ─────────────────────────────────────────────
    // DOM
    // ─────────────────────────────────────────────
    const els = {
        grid:            document.getElementById('grid-canvas'),
        canvasArea:      document.getElementById('canvas-area'),
        palette:         document.getElementById('palette-grid'),
        threadGuide:     document.getElementById('thread-guide'),
        inputZoom:       document.getElementById('input-zoom'),
        btnZoomIn:       document.getElementById('btn-zoom-in'),
        btnZoomOut:      document.getElementById('btn-zoom-out'),
        toolPencil:      document.getElementById('tool-pencil'),
        toolEraser:      document.getElementById('tool-eraser'),
        toolBucket:      document.getElementById('tool-bucket'),
        toolSquare:      document.getElementById('tool-square'),
        toolCircle:      document.getElementById('tool-circle'),
        toolLine:        document.getElementById('tool-line'),
        btnUndo:         document.getElementById('btn-undo'),
        btnRedo:         document.getElementById('btn-redo'),
        btnMirror:       document.getElementById('action-mirror'),
        btnRotateLeft:   document.getElementById('action-rotate-left'),
        btnRotateRight:  document.getElementById('action-rotate-right'),
        btnClear:        document.getElementById('btn-clear'),
        btnPrint:        document.getElementById('btn-print'),
        btnPdf:          document.getElementById('btn-pdf'),
        btnImportImage:  document.getElementById('btn-import-image'),
        inputImage:      document.getElementById('input-image'),
        clearModal:      document.getElementById('clear-modal'),
        btnCancelClear:  document.getElementById('btn-cancel-clear'),
        btnConfirmClear: document.getElementById('btn-confirm-clear'),
    };

    // ─────────────────────────────────────────────
    // CONSTANTS
    // ─────────────────────────────────────────────
    const PRESET_COLORS = [
        // Greyscale
        '#ffffff', '#f3f4f6', '#9ca3af', '#4b5563', '#111827',
        // Reds/Pinks
        '#fecdd3', '#f43f5e', '#be123c', '#fce7f3', '#ec4899', '#be185d',
        // Oranges/Yellows
        '#ffedd5', '#f97316', '#c2410c', '#fef08a', '#eab308', '#a16207',
        // Greens
        '#dcfce7', '#22c55e', '#15803d', '#ccfbf1', '#14b8a6', '#0f766e',
        // Blues/Purples
        '#e0f2fe', '#3b82f6', '#1d4ed8', '#ede9fe', '#8b5cf6', '#6d28d9'
    ];

    // ─────────────────────────────────────────────
    // DYNAMIC COLUMNS
    // ─────────────────────────────────────────────

    /**
     * Calculates how many columns fit in the canvas area for the current cell size.
     * Preserves the existing drawing data as much as possible.
     */
    function recalcCols(preserveColors = true) {
        const canvasWrapper = els.canvasArea.querySelector('.canvas-wrapper');
        // Account for: sidebar borders, wrapper padding, thread-guide width
        const threadGuideWidth = els.threadGuide.offsetWidth + 8; // gap
        const wrapperPadding = 24; // .canvas-wrapper padding (0.75rem * 2 * 16)
        const availableWidth = els.canvasArea.clientWidth - threadGuideWidth - wrapperPadding - 32; // 2rem padding on canvas-area

        const beadSize = state.cellSize + 3; // cell size + gap (3px from CSS)
        const newCols = Math.max(5, Math.floor(availableWidth / beadSize));

        if (newCols === state.cols) return; // Nothing to do

        if (preserveColors && state.colors.length > 0) {
            migrateColors(state.rows, state.cols, state.rows, newCols);
        }

        state.cols = newCols;
        if (!preserveColors) {
            state.colors = new Array(state.rows * state.cols).fill('#ffffff');
        }

        renderGrid();
    }

    /**
     * Migrates color data when column count changes, anchored to top-left.
     */
    function migrateColors(oldRows, oldCols, newRows, newCols) {
        const oldColors = [...state.colors];
        const newColors = new Array(newRows * newCols).fill('#ffffff');

        for (let y = 0; y < Math.min(oldRows, newRows); y++) {
            for (let x = 0; x < Math.min(oldCols, newCols); x++) {
                newColors[y * newCols + x] = oldColors[y * oldCols + x];
            }
        }
        state.colors = newColors;
    }

    // ─────────────────────────────────────────────
    // THREAD GUIDE (row numbers on the left)
    // ─────────────────────────────────────────────

    function renderThreadGuide() {
        els.threadGuide.innerHTML = '';
        const beadSize = state.cellSize + 3; // cell + gap

        for (let i = 1; i <= state.rows; i++) {
            const span = document.createElement('span');
            span.className = 'thread-number';
            span.textContent = i;
            span.style.height = `${beadSize}px`;
            span.style.width = '20px';
            els.threadGuide.appendChild(span);
        }

        // Update the CSS custom property for the nylon thread lines overlay
        const threadGapSize = beadSize;
        const threadOffset = Math.round(beadSize / 2) + 12; // wrapper padding offset
        document.documentElement.style.setProperty('--cell-gap-size', `${threadGapSize}px`);
        document.documentElement.style.setProperty('--thread-offset', `${threadOffset}px`);
    }

    // ─────────────────────────────────────────────
    // GRID RENDERING
    // ─────────────────────────────────────────────

    function resetGridData() {
        state.rows = FIXED_ROWS;
        state.colors = new Array(state.rows * state.cols).fill('#ffffff');
    }

    function createGridHTML() {
        const beadSize = state.cellSize;
        const gap = 3;

        els.grid.style.gridTemplateColumns = `repeat(${state.cols}, ${beadSize}px)`;
        els.grid.style.gridTemplateRows    = `repeat(${state.rows}, ${beadSize}px)`;
        els.grid.style.gap = `${gap}px`;

        const fragment = document.createDocumentFragment();

        state.colors.forEach((color, index) => {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.style.width  = `${beadSize}px`;
            cell.style.height = `${beadSize}px`;
            cell.style.backgroundColor = color;
            cell.dataset.index = index;
            fragment.appendChild(cell);
        });

        els.grid.innerHTML = '';
        els.grid.appendChild(fragment);
    }

    function renderGrid() {
        createGridHTML();
        renderThreadGuide();
    }

    // ─────────────────────────────────────────────
    // DRAWING
    // ─────────────────────────────────────────────

    function updateCell(index, color) {
        if (index < 0 || index >= state.colors.length) return;
        if (state.colors[index] === color) return;
        state.colors[index] = color;
        const cell = els.grid.children[index];
        if (cell) cell.style.backgroundColor = color;
    }

    function paint(index) {
        const color = state.tool === 'eraser' ? '#ffffff' : state.selectedColor;
        if (state.tool === 'bucket') {
            floodFill(index, color);
            saveHistory();
        } else {
            updateCell(index, color);
        }
    }

    function floodFill(startIndex, replacementColor) {
        const targetColor = state.colors[startIndex];
        if (targetColor === replacementColor) return;

        const queue = [startIndex];
        const visited = new Set();
        let iterations = 0;
        const maxIt = state.rows * state.cols * 2;

        while (queue.length > 0 && iterations < maxIt) {
            iterations++;
            const idx = queue.shift();
            if (visited.has(idx)) continue;
            visited.add(idx);

            if (state.colors[idx] === targetColor) {
                state.colors[idx] = replacementColor;
                const cell = els.grid.children[idx];
                if (cell) cell.style.backgroundColor = replacementColor;

                const x = idx % state.cols;
                const y = Math.floor(idx / state.cols);
                if (y > 0) queue.push(idx - state.cols);
                if (y < state.rows - 1) queue.push(idx + state.cols);
                if (x > 0) queue.push(idx - 1);
                if (x < state.cols - 1) queue.push(idx + 1);
            }
        }
    }

    // Bresenham Line
    function getLineIndices(startIdx, endIdx) {
        const indices = [];
        const w = state.cols;
        let x0 = startIdx % w, y0 = Math.floor(startIdx / w);
        let x1 = endIdx % w,   y1 = Math.floor(endIdx / w);
        const dx = Math.abs(x1-x0), dy = Math.abs(y1-y0);
        const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        while (true) {
            indices.push(y0 * w + x0);
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx)  { err += dx; y0 += sy; }
        }
        return indices;
    }

    function getSquareIndices(startIdx, endIdx) {
        const w = state.cols;
        const x0 = startIdx % w, y0 = Math.floor(startIdx / w);
        const x1 = endIdx % w,   y1 = Math.floor(endIdx / w);
        const minX = Math.min(x0,x1), maxX = Math.max(x0,x1);
        const minY = Math.min(y0,y1), maxY = Math.max(y0,y1);
        const indices = new Set();
        for (let x = minX; x <= maxX; x++) { indices.add(minY*w+x); indices.add(maxY*w+x); }
        for (let y = minY; y <= maxY; y++) { indices.add(y*w+minX); indices.add(y*w+maxX); }
        return Array.from(indices);
    }

    function getCircleIndices(startIdx, endIdx) {
        const w = state.cols;
        const x0 = startIdx % w, y0 = Math.floor(startIdx / w);
        const x1 = endIdx % w,   y1 = Math.floor(endIdx / w);
        const minX = Math.min(x0,x1), maxX = Math.max(x0,x1);
        const minY = Math.min(y0,y1), maxY = Math.max(y0,y1);
        const cx = (minX+maxX)/2, cy = (minY+maxY)/2;
        const rx = (maxX-minX)/2, ry = (maxY-minY)/2;
        if (rx < 0.5 || ry < 0.5) return getSquareIndices(startIdx, endIdx);
        const indices = [];
        const steps = Math.max(rx, ry) * Math.PI * 4;
        for (let i = 0; i < steps; i++) {
            const theta = (i/steps) * Math.PI * 2;
            const px = Math.round(cx + rx * Math.cos(theta));
            const py = Math.round(cy + ry * Math.sin(theta));
            if (px >= 0 && px < w && py >= 0 && py < state.rows) indices.push(py*w+px);
        }
        return [...new Set(indices)];
    }

    function clearPreview() {
        state.previewIndices.forEach(idx => {
            const cell = els.grid.children[idx];
            if (cell) cell.style.backgroundColor = state.colors[idx];
        });
        state.previewIndices = [];
    }

    function drawPreviewShape(currentIdx) {
        clearPreview();
        if (state.startCellIndex === null) return;
        let indices = [];
        if (state.tool === 'line')   indices = getLineIndices(state.startCellIndex, currentIdx);
        if (state.tool === 'square') indices = getSquareIndices(state.startCellIndex, currentIdx);
        if (state.tool === 'circle') indices = getCircleIndices(state.startCellIndex, currentIdx);
        const color = state.selectedColor;
        indices.forEach(idx => {
            const cell = els.grid.children[idx];
            if (cell) cell.style.backgroundColor = color;
        });
        state.previewIndices = indices;
    }

    function commitShape() {
        const color = state.selectedColor;
        state.previewIndices.forEach(idx => {
            state.colors[idx] = color;
            const cell = els.grid.children[idx];
            if (cell) cell.style.backgroundColor = color;
        });
        state.previewIndices = [];
        saveHistory();
    }

    // ─────────────────────────────────────────────
    // TRANSFORMS (operates on state.colors data array)
    // ─────────────────────────────────────────────

    function mirrorGrid() {
        const newColors = [...state.colors];
        for (let y = 0; y < state.rows; y++) {
            for (let x = 0; x < Math.floor(state.cols / 2); x++) {
                const lIdx = y * state.cols + x;
                const rIdx = y * state.cols + (state.cols - 1 - x);
                [newColors[lIdx], newColors[rIdx]] = [newColors[rIdx], newColors[lIdx]];
            }
        }
        state.colors = newColors;
        renderGrid();
        saveHistory();
    }

    /**
     * Rotates the IMAGE DATA (state.colors array), not the DOM element.
     * Since rows are fixed at 12, after a 90° rotation we re-adapt cols.
     * The rotated image's "new height" (which becomes cols) is clamped to available width.
     */
    function rotateGrid(direction) {
        const oldRows = state.rows;
        const oldCols = state.cols;
        const oldColors = [...state.colors];

        // After rotation: new canvas is oldCols × oldRows
        const newRows = oldCols; // This might not equal 12
        const newCols = oldRows;
        const newColors = new Array(newRows * newCols).fill('#ffffff');

        for (let y = 0; y < oldRows; y++) {
            for (let x = 0; x < oldCols; x++) {
                const color = oldColors[y * oldCols + x];
                let nx, ny;
                if (direction === 'right') { // Clockwise
                    nx = oldRows - 1 - y;
                    ny = x;
                } else { // Counter-clockwise
                    nx = y;
                    ny = oldCols - 1 - x;
                }
                newColors[ny * newCols + nx] = color;
            }
        }

        // Apply rotated data at new dimensions temporarily
        state.rows = newRows;
        state.cols = newCols;
        state.colors = newColors;

        // Now crop/pad back to FIXED_ROWS while keeping cols
        clampToFixedRows();

        renderGrid();
        saveHistory();
    }

    /**
     * After a rotation the row count may not be 12.
     * Crop to the first 12 rows (or pad with white if fewer).
     */
    function clampToFixedRows() {
        if (state.rows === FIXED_ROWS) return;

        const clampedColors = new Array(FIXED_ROWS * state.cols).fill('#ffffff');
        for (let y = 0; y < Math.min(state.rows, FIXED_ROWS); y++) {
            for (let x = 0; x < state.cols; x++) {
                clampedColors[y * state.cols + x] = state.colors[y * state.cols + x];
            }
        }
        state.rows = FIXED_ROWS;
        state.colors = clampedColors;
    }

    // ─────────────────────────────────────────────
    // HISTORY
    // ─────────────────────────────────────────────

    function saveHistory() {
        if (state.historyIndex < state.history.length - 1) {
            state.history = state.history.slice(0, state.historyIndex + 1);
        }
        state.history.push({
            colors: [...state.colors],
            rows: state.rows,
            cols: state.cols
        });
        if (state.history.length > state.maxHistory) {
            state.history.shift();
        } else {
            state.historyIndex++;
        }
        saveLocalStorage();
        updateUndoRedoUI();
    }

    function undo() {
        if (state.historyIndex > 0) {
            state.historyIndex--;
            restoreHistoryState(state.history[state.historyIndex]);
        }
    }

    function redo() {
        if (state.historyIndex < state.history.length - 1) {
            state.historyIndex++;
            restoreHistoryState(state.history[state.historyIndex]);
        }
    }

    function restoreHistoryState(h) {
        state.colors = [...h.colors];
        state.rows = h.rows;
        state.cols = h.cols;
        renderGrid();
        saveLocalStorage();
        updateUndoRedoUI();
    }

    function updateUndoRedoUI() {
        els.btnUndo.disabled = state.historyIndex <= 0;
        els.btnUndo.style.opacity = state.historyIndex <= 0 ? 0.4 : 1;
        els.btnRedo.disabled = state.historyIndex >= state.history.length - 1;
        els.btnRedo.style.opacity = state.historyIndex >= state.history.length - 1 ? 0.4 : 1;
    }

    // ─────────────────────────────────────────────
    // LOCAL STORAGE
    // ─────────────────────────────────────────────

    function saveLocalStorage() {
        localStorage.setItem('missangas-v3', JSON.stringify({
            cols: state.cols,
            cellSize: state.cellSize,
            colors: state.colors,
            selectedColor: state.selectedColor
        }));
    }

    function loadState() {
        const saved = localStorage.getItem('missangas-v3');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Rows are always FIXED_ROWS — never load from storage
                state.cols      = parsed.cols      || 20;
                state.cellSize  = parsed.cellSize  || DEFAULT_CELL_SIZE;
                state.colors    = parsed.colors    || [];
                state.selectedColor = parsed.selectedColor || '#f97316';
            } catch (e) {
                console.error('Failed to load save', e);
            }
        }
    }

    // ─────────────────────────────────────────────
    // UI
    // ─────────────────────────────────────────────

    function renderPalette() {
        els.palette.innerHTML = '';
        PRESET_COLORS.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.title = color;
            if (color === state.selectedColor) swatch.classList.add('selected');
            swatch.addEventListener('click', () => selectColor(color));
            els.palette.appendChild(swatch);
        });
    }

    function selectColor(color) {
        state.selectedColor = color;
        Array.from(els.palette.children).forEach(child => {
            child.classList.remove('selected');
            const childHex = rgbToHex(child.style.backgroundColor);
            if (childHex === color) child.classList.add('selected');
        });
        if (state.tool === 'eraser') setTool('pencil');
    }

    function setTool(toolName) {
        state.tool = toolName;
        [
            [els.toolPencil,  'pencil'],
            [els.toolEraser,  'eraser'],
            [els.toolBucket,  'bucket'],
            [els.toolSquare,  'square'],
            [els.toolCircle,  'circle'],
            [els.toolLine,    'line'],
        ].forEach(([el, name]) => el && el.classList.toggle('active', toolName === name));
    }

    function applyZoom(newSize) {
        state.cellSize = Math.min(50, Math.max(10, newSize));
        els.inputZoom.value = state.cellSize;

        // Update cells directly (fast path — no full re-render)
        for (const cell of els.grid.children) {
            cell.style.width  = `${state.cellSize}px`;
            cell.style.height = `${state.cellSize}px`;
        }
        els.grid.style.gridTemplateColumns = `repeat(${state.cols}, ${state.cellSize}px)`;
        els.grid.style.gridTemplateRows    = `repeat(${state.rows}, ${state.cellSize}px)`;
        els.grid.style.gap = '3px';
        renderThreadGuide();
    }

    // ─────────────────────────────────────────────
    // IMAGE IMPORT
    // ─────────────────────────────────────────────

    function processImageToPattern(img) {
        const offscreen = document.createElement('canvas');
        offscreen.width  = state.cols;
        offscreen.height = state.rows;
        const ctx = offscreen.getContext('2d', { willReadFrequently: true });

        const gridRatio = state.cols / state.rows;
        const imgRatio  = img.width / img.height;
        let dw, dh, ox = 0, oy = 0;
        if (imgRatio > gridRatio) { dw = state.cols; dh = dw / imgRatio; oy = (state.rows - dh) / 2; }
        else                      { dh = state.rows; dw = dh * imgRatio; ox = (state.cols - dw) / 2; }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, state.cols, state.rows);
        ctx.drawImage(img, ox, oy, dw, dh);

        const imageData = ctx.getImageData(0, 0, state.cols, state.rows);
        const data = imageData.data;

        const paletteRGB = PRESET_COLORS.map(hex => {
            const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return { hex, r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) };
        });

        const newColors = new Array(state.rows * state.cols).fill('#ffffff');
        for (let i = 0; i < data.length; i += 4) {
            if (data[i+3] < 128) continue;
            let closestHex = '#ffffff', minDist = Infinity;
            const r = data[i], g = data[i+1], b = data[i+2];
            for (const p of paletteRGB) {
                const d = (r-p.r)**2 + (g-p.g)**2 + (b-p.b)**2;
                if (d < minDist) { minDist = d; closestHex = p.hex; }
            }
            newColors[i/4] = closestHex;
        }

        state.colors = newColors;
        renderGrid();
        saveHistory();
    }

    // ─────────────────────────────────────────────
    // EVENTS — Drawing (Mouse)
    // ─────────────────────────────────────────────

    const startDrawing = (e) => {
        state.isDrawing = true;
        const target = e.target;
        if (!target.classList.contains('cell')) return;
        const idx = parseInt(target.dataset.index);
        if (['line','square','circle'].includes(state.tool)) {
            state.startCellIndex = idx;
            paint(idx);
        } else {
            paint(idx);
        }
    };

    const stopDrawing = () => {
        if (!state.isDrawing) return;
        state.isDrawing = false;
        if (['line','square','circle'].includes(state.tool)) {
            if (state.previewIndices.length > 0) commitShape();
            else saveHistory();
            state.startCellIndex = null;
            clearPreview();
        } else if (state.tool !== 'bucket') {
            saveHistory();
        }
    };

    const draw = (e) => {
        if (!state.isDrawing || state.tool === 'bucket') return;
        const target = e.target;
        if (!target.classList.contains('cell')) return;
        const idx = parseInt(target.dataset.index);
        if (['line','square','circle'].includes(state.tool)) drawPreviewShape(idx);
        else paint(idx);
    };

    els.grid.addEventListener('mousedown', startDrawing);
    window.addEventListener('mouseup', stopDrawing);
    els.grid.addEventListener('mouseover', draw);

    // ─────────────────────────────────────────────
    // EVENTS — Drawing (Touch)
    // ─────────────────────────────────────────────

    els.grid.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!target || !target.classList.contains('cell')) return;
        state.isDrawing = true;
        const idx = parseInt(target.dataset.index);
        if (['line','square','circle'].includes(state.tool)) { state.startCellIndex = idx; paint(idx); }
        else paint(idx);
    }, { passive: false });

    els.grid.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!state.isDrawing || state.tool === 'bucket') return;
        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!target || !target.classList.contains('cell')) return;
        const idx = parseInt(target.dataset.index);
        if (['line','square','circle'].includes(state.tool)) drawPreviewShape(idx);
        else paint(idx);
    }, { passive: false });

    window.addEventListener('touchend', stopDrawing);

    // ─────────────────────────────────────────────
    // EVENTS — Tools
    // ─────────────────────────────────────────────

    els.toolPencil.addEventListener('click', () => setTool('pencil'));
    els.toolEraser.addEventListener('click', () => setTool('eraser'));
    els.toolBucket.addEventListener('click', () => setTool('bucket'));
    els.toolSquare.addEventListener('click', () => setTool('square'));
    els.toolCircle.addEventListener('click', () => setTool('circle'));
    els.toolLine.addEventListener('click',   () => setTool('line'));

    els.btnMirror.addEventListener('click',      mirrorGrid);
    els.btnRotateLeft.addEventListener('click',  () => rotateGrid('left'));
    els.btnRotateRight.addEventListener('click', () => rotateGrid('right'));

    // ─────────────────────────────────────────────
    // EVENTS — Undo / Redo / Clear
    // ─────────────────────────────────────────────

    els.btnUndo.addEventListener('click', undo);
    els.btnRedo.addEventListener('click', redo);

    els.btnClear.addEventListener('click', () => els.clearModal.classList.remove('hidden'));
    els.btnCancelClear.addEventListener('click', () => els.clearModal.classList.add('hidden'));
    els.btnConfirmClear.addEventListener('click', () => {
        resetGridData();
        renderGrid();
        saveHistory();
        els.clearModal.classList.add('hidden');
    });
    els.clearModal.addEventListener('click', (e) => {
        if (e.target === els.clearModal) els.clearModal.classList.add('hidden');
    });

    // ─────────────────────────────────────────────
    // EVENTS — Zoom
    // ─────────────────────────────────────────────

    els.inputZoom.addEventListener('input', (e) => applyZoom(parseInt(e.target.value)));

    els.btnZoomIn.addEventListener('click', () => applyZoom(state.cellSize + 2));
    els.btnZoomOut.addEventListener('click', () => applyZoom(state.cellSize - 2));

    // ─────────────────────────────────────────────
    // EVENTS — Image Import
    // ─────────────────────────────────────────────

    els.btnImportImage.addEventListener('click', () => els.inputImage.click());
    els.inputImage.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => processImageToPattern(img);
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    });

    // ─────────────────────────────────────────────
    // EVENTS — Export
    // ─────────────────────────────────────────────

    els.btnPrint.addEventListener('click', () => window.print());

    els.btnPdf.addEventListener('click', async () => {
        const { jsPDF } = window.jspdf;
        const origShadow = els.grid.style.boxShadow;
        els.grid.style.boxShadow = 'none';
        try {
            const canvas = await html2canvas(els.grid, { scale: 2, backgroundColor: '#f5f0e8' });
            els.grid.style.boxShadow = origShadow;
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgProps = pdf.getImageProperties(imgData);
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.text('Padrão de Missanga', 105, 15, { align: 'center' });
            pdf.addImage(imgData, 'PNG', 0, 25, pdfWidth, pdfHeight);
            pdf.save('missangas.pdf');
        } catch (err) {
            console.error(err);
            alert('Erro ao gerar imagem');
        }
    });

    // ─────────────────────────────────────────────
    // RESPONSIVE — ResizeObserver for dynamic columns
    // ─────────────────────────────────────────────

    const resizeObserver = new ResizeObserver(() => {
        recalcCols(true);
    });
    resizeObserver.observe(els.canvasArea);

    // ─────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────

    function rgbToHex(rgb) {
        if (!rgb || rgb === 'rgba(0, 0, 0, 0)') return '#ffffff';
        if (rgb.startsWith('#')) return rgb;
        const m = rgb.match(/\d+/g);
        if (!m) return '#ffffff';
        return '#' + ((1 << 24) + (parseInt(m[0]) << 16) + (parseInt(m[1]) << 8) + parseInt(m[2])).toString(16).slice(1);
    }

    // ─────────────────────────────────────────────
    // INIT
    // ─────────────────────────────────────────────

    function init() {
        loadState();
        state.rows = FIXED_ROWS; // Always enforce 12 rows

        // Validate colors array size
        if (!state.colors || state.colors.length !== state.rows * state.cols) {
            resetGridData();
        }

        renderPalette();
        renderGrid();
        setTool(state.tool);
        updateUndoRedoUI();

        if (state.history.length === 0) saveHistory();

        // After rendering, dynamically compute columns
        // (Delay to allow layout to settle)
        setTimeout(() => recalcCols(true), 100);
    }

    init();
});
