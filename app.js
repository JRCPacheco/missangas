document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    const state = {
        rows: 30, // Changed default to 30
        cols: 20,
        cellSize: 20,
        colors: [], // Array of strings (hex codes)
        selectedColor: '#f97316',
        tool: 'pencil', // 'pencil', 'eraser', 'bucket', 'line'
        isDrawing: false,
        startCellIndex: null, // For line tool
        previewIndices: [], // For line tool preview
        history: [],
        historyIndex: -1,
        maxHistory: 30
    };

    // --- DOM Elements ---
    const els = {
        grid: document.getElementById('grid-canvas'),
        palette: document.getElementById('palette-grid'),
        // customColor element removed
        inputRows: document.getElementById('input-rows'),
        inputCols: document.getElementById('input-cols'),
        inputZoom: document.getElementById('input-zoom'),
        toolPencil: document.getElementById('tool-pencil'),
        toolEraser: document.getElementById('tool-eraser'),
        toolBucket: document.getElementById('tool-bucket'),
        toolSquare: document.getElementById('tool-square'),
        toolCircle: document.getElementById('tool-circle'),
        toolLine: document.getElementById('tool-line'),
        btnUndo: document.getElementById('btn-undo'),
        btnRedo: document.getElementById('btn-redo'),
        btnMirror: document.getElementById('action-mirror'),
        btnRotateLeft: document.getElementById('action-rotate-left'),
        btnRotateRight: document.getElementById('action-rotate-right'),
        btnClear: document.getElementById('btn-clear'),
        btnPrint: document.getElementById('btn-print'),
        btnPdf: document.getElementById('btn-pdf'),
        stepBtns: document.querySelectorAll('.step-btn'),
        
        // New elements
        btnImportImage: document.getElementById('btn-import-image'),
        inputImage: document.getElementById('input-image'),
        btnSettings: document.getElementById('btn-settings'),
        settingsModal: document.getElementById('settings-modal'),
        btnCloseSettings: document.getElementById('btn-close-settings'),
        clearModal: document.getElementById('clear-modal'),
        btnCancelClear: document.getElementById('btn-cancel-clear'),
        btnConfirmClear: document.getElementById('btn-confirm-clear'),
        
        // Collapsibles
        toggleShapes: document.getElementById('toggle-shapes'),
        shapesPanel: document.getElementById('shapes-panel'),
        toggleTransform: document.getElementById('toggle-transform'),
        transformPanel: document.getElementById('transform-panel')
    };

    // --- Constants ---
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

    // --- Initialization ---
    function init() {
        loadState();
        // If loaded state doesn't match dimensions (e.g. corrupted or first run), reset
        if (!state.colors || state.colors.length !== state.rows * state.cols) {
            resetGridData();
        }
        
        renderPalette();
        renderGrid();
        updateUI();
        
        // Initial history save if empty
        if (state.history.length === 0) {
            saveHistory();
        }
    }

    // --- Core Logic ---

    function resetGridData() {
        state.colors = new Array(state.rows * state.cols).fill('#ffffff');
    }

    function createGridHTML() {
        els.grid.style.gridTemplateColumns = `repeat(${state.cols}, ${state.cellSize}px)`;
        els.grid.style.gridTemplateRows = `repeat(${state.rows}, ${state.cellSize}px)`;
        
        const fragment = document.createDocumentFragment();
        
        state.colors.forEach((color, index) => {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.style.width = `${state.cellSize}px`;
            cell.style.height = `${state.cellSize}px`;
            cell.style.backgroundColor = color;
            cell.dataset.index = index;
            fragment.appendChild(cell);
        });
        
        els.grid.innerHTML = '';
        els.grid.appendChild(fragment);
    }

    function renderGrid() {
        createGridHTML();
    }

    function updateCell(index, color) {
        if (index < 0 || index >= state.colors.length) return;
        if (state.colors[index] === color) return;

        state.colors[index] = color;
        const cell = els.grid.children[index];
        if (cell) {
            cell.style.backgroundColor = color;
        }
    }

    function paint(index) {
        const color = state.tool === 'eraser' ? '#ffffff' : state.selectedColor;
        
        if (state.tool === 'bucket') {
            floodFill(index, color);
            saveHistory(); // Bucket is a discrete action, save immediately
        } else if (state.tool === 'line') {
            // Line logic handled in endDrawing/drawPreview
            // This is just single click paint if no drag
            updateCell(index, color);
        } else {
            updateCell(index, color);
            // Pencil/Eraser history is saved on mouseup
        }
    }

    function floodFill(startIndex, replacementColor) {
        const targetColor = state.colors[startIndex];
        if (targetColor === replacementColor) return;

        const queue = [startIndex];
        const visited = new Set();
        
        // Safety break
        let iterations = 0;
        const maxIterations = state.rows * state.cols * 2;

        while (queue.length > 0 && iterations < maxIterations) {
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

                // Neighbors (Up, Down, Left, Right)
                if (y > 0) queue.push(idx - state.cols);
                if (y < state.rows - 1) queue.push(idx + state.cols);
                if (x > 0) queue.push(idx - 1);
                if (x < state.cols - 1) queue.push(idx + 1);
            }
        }
    }

    // Bresenham's Line Algorithm
    function getLineIndices(startIdx, endIdx) {
        const indices = [];
        const w = state.cols;
        
        let x0 = startIdx % w;
        let y0 = Math.floor(startIdx / w);
        let x1 = endIdx % w;
        let y1 = Math.floor(endIdx / w);

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = (x0 < x1) ? 1 : -1;
        const sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        while(true) {
            indices.push(y0 * w + x0);
            
            if ((x0 === x1) && (y0 === y1)) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }
        return indices;
    }

    function getSquareIndices(startIdx, endIdx) {
        const w = state.cols;
        const x0 = startIdx % w;
        const y0 = Math.floor(startIdx / w);
        const x1 = endIdx % w;
        const y1 = Math.floor(endIdx / w);

        const minX = Math.min(x0, x1);
        const maxX = Math.max(x0, x1);
        const minY = Math.min(y0, y1);
        const maxY = Math.max(y0, y1);

        const indices = new Set();
        
        // Top and Bottom
        for (let x = minX; x <= maxX; x++) {
            indices.add(minY * w + x);
            indices.add(maxY * w + x);
        }
        // Left and Right
        for (let y = minY; y <= maxY; y++) {
            indices.add(y * w + minX);
            indices.add(y * w + maxX);
        }
        return Array.from(indices);
    }

    function getCircleIndices(startIdx, endIdx) {
        const w = state.cols;
        const x0 = startIdx % w;
        const y0 = Math.floor(startIdx / w);
        const x1 = endIdx % w;
        const y1 = Math.floor(endIdx / w);

        const minX = Math.min(x0, x1);
        const maxX = Math.max(x0, x1);
        const minY = Math.min(y0, y1);
        const maxY = Math.max(y0, y1);

        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const rx = (maxX - minX) / 2;
        const ry = (maxY - minY) / 2;

        const indices = [];

        // If flattened to a line
        if (rx < 0.5 || ry < 0.5) {
             return getSquareIndices(startIdx, endIdx); 
        }

        // Iterate based on angle
        const steps = Math.max(rx, ry) * Math.PI * 2 * 2; // Oversample
        for (let i = 0; i < steps; i++) {
             const theta = (i / steps) * Math.PI * 2;
             const px = Math.round(cx + rx * Math.cos(theta));
             const py = Math.round(cy + ry * Math.sin(theta));
             if (px >= 0 && px < w && py >= 0 && py < state.rows) {
                 indices.push(py * w + px);
             }
        }
        
        return [...new Set(indices)];
    }

    function clearPreview() {
        if (state.previewIndices.length === 0) return;
        
        state.previewIndices.forEach(idx => {
            const cell = els.grid.children[idx];
            if (cell) {
                // Revert to actual color
                cell.style.backgroundColor = state.colors[idx];
                // cell.classList.remove('preview');
            }
        });
        state.previewIndices = [];
    }

    function drawPreviewShape(currentIdx) {
        clearPreview(); // Clear old preview
        if (state.startCellIndex === null) return;

        let indices = [];
        if (state.tool === 'line') {
            indices = getLineIndices(state.startCellIndex, currentIdx);
        } else if (state.tool === 'square') {
            indices = getSquareIndices(state.startCellIndex, currentIdx);
        } else if (state.tool === 'circle') {
            indices = getCircleIndices(state.startCellIndex, currentIdx);
        }

        const color = state.selectedColor;

        indices.forEach(idx => {
            const cell = els.grid.children[idx];
            if (cell) {
                cell.style.backgroundColor = color;
            }
        });
        state.previewIndices = indices;
    }

    function commitShape() {
        const color = state.selectedColor;
        state.previewIndices.forEach(idx => {
            state.colors[idx] = color;
            const cell = els.grid.children[idx];
            if(cell) cell.style.backgroundColor = color;
        });
        state.previewIndices = [];
        saveHistory();
    }

    function mirrorGrid() {
        const newColors = [...state.colors];
        for (let y = 0; y < state.rows; y++) {
            for (let x = 0; x < Math.floor(state.cols / 2); x++) {
                const leftIdx = y * state.cols + x;
                const rightIdx = y * state.cols + (state.cols - 1 - x);
                
                const temp = newColors[leftIdx];
                newColors[leftIdx] = newColors[rightIdx];
                newColors[rightIdx] = temp;
            }
        }
        state.colors = newColors;
        renderGrid();
        saveHistory();
    }

    function rotateGrid(direction) {
        const oldRows = state.rows;
        const oldCols = state.cols;
        const oldColors = [...state.colors];
        
        const newRows = oldCols;
        const newCols = oldRows;
        const newColors = new Array(newRows * newCols).fill('#ffffff');
        
        for (let y = 0; y < oldRows; y++) {
            for (let x = 0; x < oldCols; x++) {
                const oldIdx = y * oldCols + x;
                const color = oldColors[oldIdx];
                
                let newX, newY;
                
                if (direction === 'right') { // Clockwise
                    newX = oldRows - 1 - y;
                    newY = x;
                } else { // Counter-Clockwise (left)
                    newX = y;
                    newY = oldCols - 1 - x;
                }
                
                const newIdx = newY * newCols + newX;
                newColors[newIdx] = color;
            }
        }
        
        state.rows = newRows;
        state.cols = newCols;
        state.colors = newColors;
        
        renderGrid();
        updateUI();
        saveHistory();
    }

    function handleResize(dRow, dCol) {
        const oldRows = state.rows;
        const oldCols = state.cols;
        const oldColors = [...state.colors];
        
        const newRows = state.rows + dRow;
        const newCols = state.cols + dCol;
        
        if (newRows < 5 || newRows > 50 || newCols < 5 || newCols > 50) return;
        
        state.rows = newRows;
        state.cols = newCols;
        
        // Create new array filled with white
        const newColors = new Array(newRows * newCols).fill('#ffffff');
        
        // Copy existing data to new grid (anchored top-left)
        for (let y = 0; y < Math.min(oldRows, newRows); y++) {
            for (let x = 0; x < Math.min(oldCols, newCols); x++) {
                const oldIndex = y * oldCols + x;
                const newIndex = y * newCols + x;
                newColors[newIndex] = oldColors[oldIndex];
            }
        }
        
        state.colors = newColors;
        renderGrid();
        updateUI();
        saveHistory();
    }

    // --- History (Undo/Redo) ---
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
            restoreState(state.history[state.historyIndex]);
        }
    }

    function redo() {
        if (state.historyIndex < state.history.length - 1) {
            state.historyIndex++;
            restoreState(state.history[state.historyIndex]);
        }
    }

    function restoreState(historyState) {
        state.colors = [...historyState.colors];
        state.rows = historyState.rows;
        state.cols = historyState.cols;
        
        renderGrid();
        updateUI(); // Updates inputs
        saveLocalStorage();
        updateUndoRedoUI();
    }

    function updateUndoRedoUI() {
        els.btnUndo.disabled = state.historyIndex <= 0;
        els.btnUndo.style.opacity = state.historyIndex <= 0 ? 0.5 : 1;
        
        els.btnRedo.disabled = state.historyIndex >= state.history.length - 1;
        els.btnRedo.style.opacity = state.historyIndex >= state.history.length - 1 ? 0.5 : 1;
    }

    // --- Local Storage ---
    function saveLocalStorage() {
        const data = {
            rows: state.rows,
            cols: state.cols,
            cellSize: state.cellSize,
            colors: state.colors,
            selectedColor: state.selectedColor
        };
        localStorage.setItem('missangas-v2', JSON.stringify(data));
    }

    function loadState() {
        const saved = localStorage.getItem('missangas-v2');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                state.rows = parsed.rows || 30; // Default updated
                state.cols = parsed.cols || 20;
                state.cellSize = parsed.cellSize || 20;
                state.colors = parsed.colors || [];
                state.selectedColor = parsed.selectedColor || '#f97316';
            } catch (e) {
                console.error("Failed to load save", e);
            }
        }
    }

    // --- UI Rendering ---
    function renderPalette() {
        els.palette.innerHTML = '';
        PRESET_COLORS.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            // Add tooltip or title
            swatch.title = color;
            
            if (color === state.selectedColor) swatch.classList.add('selected');
            
            swatch.addEventListener('click', () => {
                selectColor(color);
            });
            
            els.palette.appendChild(swatch);
        });
        
        // els.customColor.value = state.selectedColor; // Removed
    }

    function selectColor(color) {
        state.selectedColor = color;
        
        Array.from(els.palette.children).forEach(child => {
            child.classList.remove('selected');
            // Check rough equality
            if (child.style.backgroundColor === hexToRgb(color) || 
                rgbToHex(child.style.backgroundColor) === color ||
                child.style.backgroundColor === color) {
                child.classList.add('selected');
            }
        });
        
        // els.customColor.value = color; // Removed
        
        if (state.tool === 'eraser') {
            setTool('pencil');
        }
    }

    function setTool(toolName) {
        state.tool = toolName;
        els.toolPencil.classList.toggle('active', toolName === 'pencil');
        els.toolEraser.classList.toggle('active', toolName === 'eraser');
        els.toolBucket.classList.toggle('active', toolName === 'bucket');
        els.toolSquare.classList.toggle('active', toolName === 'square');
        els.toolCircle.classList.toggle('active', toolName === 'circle');
        els.toolLine.classList.toggle('active', toolName === 'line');
    }

    function updateUI() {
        els.inputRows.value = state.rows;
        els.inputCols.value = state.cols;
        els.inputZoom.value = state.cellSize;
        setTool(state.tool);
    }

    // --- Event Listeners ---

    // Drawing
    const startDrawing = (e) => {
        state.isDrawing = true;
        const target = e.target;
        if (target.classList.contains('cell')) {
            const idx = parseInt(target.dataset.index);
            
            if (['line', 'square', 'circle'].includes(state.tool)) {
                state.startCellIndex = idx;
                paint(idx); // Paint start point
            } else {
                paint(idx);
            }
        }
    };

    const stopDrawing = () => {
        if (state.isDrawing) {
            state.isDrawing = false;
            
            if (['line', 'square', 'circle'].includes(state.tool)) {
                if (state.previewIndices.length > 0) {
                    commitShape();
                } else {
                    // Just a dot
                    saveHistory();
                }
                state.startCellIndex = null;
                clearPreview(); // Cleanup just in case
            } else if (state.tool !== 'bucket') {
                saveHistory();
            }
        }
    };

    const draw = (e) => {
        if (!state.isDrawing) return;
        if (state.tool === 'bucket') return;

        const target = e.target;
        if (target.classList.contains('cell')) {
            const idx = parseInt(target.dataset.index);
            
            if (['line', 'square', 'circle'].includes(state.tool)) {
                drawPreviewShape(idx);
            } else {
                paint(idx);
            }
        }
    };

    // Mouse
    els.grid.addEventListener('mousedown', startDrawing);
    window.addEventListener('mouseup', stopDrawing);
    els.grid.addEventListener('mouseover', draw);

    // Touch
    els.grid.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        if (target && target.classList.contains('cell')) {
            // Manually trigger start
            state.isDrawing = true;
            const idx = parseInt(target.dataset.index);
            if (['line', 'square', 'circle'].includes(state.tool)) {
                state.startCellIndex = idx;
                paint(idx);
            } else {
                paint(idx);
            }
        }
    }, { passive: false });

    els.grid.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!state.isDrawing || state.tool === 'bucket') return;

        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        if (target && target.classList.contains('cell')) {
            const idx = parseInt(target.dataset.index);
            if (['line', 'square', 'circle'].includes(state.tool)) {
                drawPreviewShape(idx);
            } else {
                paint(idx);
            }
        }
    }, { passive: false });

    window.addEventListener('touchend', stopDrawing);

    // Control bindings (custom inputs removed)
    // els.customColor.addEventListener('input', (e) => selectColor(e.target.value));

    els.toolPencil.addEventListener('click', () => setTool('pencil'));
    els.toolEraser.addEventListener('click', () => setTool('eraser'));
    els.toolBucket.addEventListener('click', () => setTool('bucket'));
    els.toolSquare.addEventListener('click', () => setTool('square'));
    els.toolCircle.addEventListener('click', () => setTool('circle'));
    els.toolLine.addEventListener('click', () => setTool('line'));
    
    els.btnMirror.addEventListener('click', mirrorGrid);
    els.btnRotateLeft.addEventListener('click', () => rotateGrid('left'));
    els.btnRotateRight.addEventListener('click', () => rotateGrid('right'));

    els.btnUndo.addEventListener('click', undo);
    els.btnRedo.addEventListener('click', redo);
    els.btnClear.addEventListener('click', () => {
        els.clearModal.classList.remove('hidden');
    });

    els.btnCancelClear.addEventListener('click', () => {
        els.clearModal.classList.add('hidden');
    });

    els.btnConfirmClear.addEventListener('click', () => {
        resetGridData();
        renderGrid();
        saveHistory();
        els.clearModal.classList.add('hidden');
    });
    
    // --- Image Import Logic ---
    els.btnImportImage.addEventListener('click', () => {
        els.inputImage.click();
    });

    els.inputImage.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                processImageToPattern(img);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
        
        // Reset input so the same file can be selected again if needed
        e.target.value = '';
    });

    function processImageToPattern(img) {
        // Create an off-screen canvas with dimensions matching the grid
        const canvas = document.createElement('canvas');
        canvas.width = state.cols;
        canvas.height = state.rows;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // Calculate aspect ratio "contain" fit
        const gridRatio = state.cols / state.rows;
        const imgRatio = img.width / img.height;
        
        let drawWidth, drawHeight, offsetX = 0, offsetY = 0;

        if (imgRatio > gridRatio) {
            // Image is wider than the grid (relative to their aspect ratios)
            drawWidth = state.cols;
            drawHeight = state.cols / imgRatio;
            offsetY = (state.rows - drawHeight) / 2;
        } else {
            // Image is taller than the grid
            drawHeight = state.rows;
            drawWidth = state.rows * imgRatio;
            offsetX = (state.cols - drawWidth) / 2;
        }

        // Fill background with white (for transparent areas or letterboxing)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, state.cols, state.rows);

        // Draw the image, scaled to fit inside the grid while maintaining aspect ratio
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

        // Get the pixel data from the canvas
        const imageData = ctx.getImageData(0, 0, state.cols, state.rows);
        const data = imageData.data;

        // Convert PRESET_COLORS from hex strings to RGB objects once for faster comparison
        const paletteRGB = PRESET_COLORS.map(hex => {
            // hexToRgb returns string like "rgb(r, g, b)"
            const rgbStr = hexToRgb(hex);
            const rgbValues = rgbStr.match(/\d+/g);
            return {
                hex: hex,
                r: parseInt(rgbValues[0]),
                g: parseInt(rgbValues[1]),
                b: parseInt(rgbValues[2])
            };
        });

        const newColors = new Array(state.rows * state.cols).fill('#ffffff');

        // Iterate through each pixel (each pixel takes 4 indices: R, G, B, A)
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            const gridIndex = i / 4;

            // Handle transparency: ignore fully transparent pixels (keep them white/eraser color)
            if (a < 128) {
                newColors[gridIndex] = '#ffffff';
                continue;
            }

            // Find the closest palette color
            let closestHex = '#ffffff';
            let minDistance = Infinity;

            for (const pColor of paletteRGB) {
                // Euclidean distance squared is sufficient for comparison
                const diffR = r - pColor.r;
                const diffG = g - pColor.g;
                const diffB = b - pColor.b;
                const distSq = (diffR * diffR) + (diffG * diffG) + (diffB * diffB);

                if (distSq < minDistance) {
                    minDistance = distSq;
                    closestHex = pColor.hex;
                }
            }

            newColors[gridIndex] = closestHex;
        }

        // Apply new colors to state
        state.colors = newColors;
        renderGrid();
        saveHistory(); // Save to history to allow Undo
    }

    // Settings and Collapsibles
    els.btnSettings.addEventListener('click', () => {
        els.settingsModal.classList.remove('hidden');
    });
    
    els.btnCloseSettings.addEventListener('click', () => {
        els.settingsModal.classList.add('hidden');
    });
    
    els.settingsModal.addEventListener('click', (e) => {
        if (e.target === els.settingsModal) {
            els.settingsModal.classList.add('hidden');
        }
    });
    
    els.clearModal.addEventListener('click', (e) => {
        if (e.target === els.clearModal) {
            els.clearModal.classList.add('hidden');
        }
    });

    function togglePanel(panel, titleEl) {
        panel.classList.toggle('hidden');
        const icon = titleEl.querySelector('i');
        if (panel.classList.contains('hidden')) {
            icon.setAttribute('data-lucide', 'chevron-down');
        } else {
            icon.setAttribute('data-lucide', 'chevron-up');
        }
        lucide.createIcons();
    }

    els.toggleShapes.addEventListener('click', () => togglePanel(els.shapesPanel, els.toggleShapes));
    els.toggleTransform.addEventListener('click', () => togglePanel(els.transformPanel, els.toggleTransform));

    // Steppers
    els.stepBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.currentTarget.dataset.action; // use currentTarget for button
            if (action === 'inc-rows') handleResize(1, 0);
            if (action === 'dec-rows') handleResize(-1, 0);
            if (action === 'inc-cols') handleResize(0, 1);
            if (action === 'dec-cols') handleResize(0, -1);
        });
    });

    els.inputZoom.addEventListener('input', (e) => {
        state.cellSize = parseInt(e.target.value);
        // Direct DOM update for performance
        const cells = els.grid.children;
        for (let cell of cells) {
            cell.style.width = `${state.cellSize}px`;
            cell.style.height = `${state.cellSize}px`;
        }
        els.grid.style.gridTemplateColumns = `repeat(${state.cols}, ${state.cellSize}px)`;
        els.grid.style.gridTemplateRows = `repeat(${state.rows}, ${state.cellSize}px)`;
    });

    // Export
    els.btnPrint.addEventListener('click', () => window.print());
    
    els.btnPdf.addEventListener('click', async () => {
        const { jsPDF } = window.jspdf;
        
        const originalShadow = els.grid.style.boxShadow;
        els.grid.style.boxShadow = 'none';
        
        try {
            const canvas = await html2canvas(els.grid, {
                scale: 2,
                backgroundColor: '#ffffff'
            });
            
            els.grid.style.boxShadow = originalShadow;

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgProps = pdf.getImageProperties(imgData);
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            
            pdf.text("Padrão de Missanga", 105, 15, { align: "center" });
            pdf.addImage(imgData, 'PNG', 0, 25, pdfWidth, pdfHeight);
            pdf.save('missangas.pdf');
        } catch (err) {
            console.error(err);
            alert("Erro ao gerar PDF");
        }
    });

    // Helpers
    function hexToRgb(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})` : hex;
    }
    
    function rgbToHex(rgb) {
        if (!rgb || rgb === 'rgba(0, 0, 0, 0)') return '#ffffff';
        if (rgb.startsWith('#')) return rgb;
        const rgbValues = rgb.match(/\d+/g);
        if (!rgbValues) return '#ffffff';
        return "#" + ((1 << 24) + (parseInt(rgbValues[0]) << 16) + (parseInt(rgbValues[1]) << 8) + parseInt(rgbValues[2])).toString(16).slice(1);
    }

    init();
});
