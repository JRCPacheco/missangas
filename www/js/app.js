document.addEventListener('DOMContentLoaded', () => {
    const FIXED_ROWS = 12;
    const DEFAULT_CELL_SIZE = 28;
    const STORAGE_KEY = 'missangas-v3';

    function detectPlatform() {
        const isCapacitor = !!window.Capacitor;
        const userAgent = navigator.userAgent || '';
        const isAndroid = /Android/i.test(userAgent);
        const isAndroidApp = isCapacitor && isAndroid;
        return {
            isCapacitor,
            isAndroid,
            isAndroidApp,
            kind: isAndroidApp ? 'android' : 'web',
        };
    }

    const platform = detectPlatform();
    document.body.classList.add(`is-${platform.kind}`);
    document.body.dataset.platform = platform.kind;

    const PRESET_COLORS = [
        '#ffffff', '#f3f4f6', '#9ca3af', '#4b5563', '#111827',
        '#fecdd3', '#f43f5e', '#be123c', '#fce7f3', '#ec4899', '#be185d',
        '#ffedd5', '#f97316', '#c2410c', '#fef08a', '#eab308', '#a16207',
        '#dcfce7', '#22c55e', '#15803d', '#ccfbf1', '#14b8a6', '#0f766e',
        '#e0f2fe', '#3b82f6', '#1d4ed8', '#ede9fe', '#8b5cf6', '#6d28d9'
    ];

    const SKIN_TONES = {
        light: '#FDDBB4',
        medium: '#C8895A',
        dark: '#7D4E2D',
    };

    const state = {
        rows: FIXED_ROWS,
        cols: 20,
        cellSize: DEFAULT_CELL_SIZE,
        colors: [],
        selectedColor: '#f97316',
        tool: 'pencil',
        skinTone: 'light',
        isDrawing: false,
        startCellIndex: null,
        previewIndices: [],
        history: [],
        historyIndex: -1,
        maxHistory: 30,
    };

    // ─────────────────────────────────────────────
    // DOM
    // ─────────────────────────────────────────────
    const els = {
        grid: document.getElementById('grid-canvas'),
        canvasArea: document.getElementById('canvas-area'),
        palette: document.getElementById('palette-grid'),
        threadGuide: document.getElementById('thread-guide'),
        inputZoom: document.getElementById('input-zoom'),
        btnZoomIn: document.getElementById('btn-zoom-in'),
        btnZoomOut: document.getElementById('btn-zoom-out'),
        toolPencil: document.getElementById('tool-pencil'),
        toolEraser: document.getElementById('tool-eraser'),
        toolBucket: document.getElementById('tool-bucket'),
        toolLine: document.getElementById('tool-line'),
        toolSquare: document.getElementById('tool-square'),
        toolCircle: document.getElementById('tool-circle'),
        btnUndo: document.getElementById('btn-undo'),
        btnRedo: document.getElementById('btn-redo'),
        btnMirror: document.getElementById('action-mirror'),
        btnRotateLeft: document.getElementById('action-rotate-left'),
        btnRotateRight: document.getElementById('action-rotate-right'),
        btnClear: document.getElementById('btn-clear'),
        btnPrint: document.getElementById('btn-print'),
        btnPdf: document.getElementById('btn-pdf'),
        btnSavePng: document.getElementById('btn-save-png'),
        btnImportImage: document.getElementById('btn-import-image'),
        inputImage: document.getElementById('input-image'),
        clearModal: document.getElementById('clear-modal'),
        btnCancelClear: document.getElementById('btn-cancel-clear'),
        btnConfirmClear: document.getElementById('btn-confirm-clear'),
        btnToggleMais: document.getElementById('btn-toggle-mais'),
        maisContent: document.getElementById('mais-content'),
        maisOverlay: document.getElementById('mais-overlay'),
        currentColorSwatch: document.getElementById('current-color-swatch'),
        btnDonation: document.getElementById('btn-donation'),
        donationModal: document.getElementById('donation-modal'),
        btnCloseDonation: document.getElementById('btn-close-donation'),
        platformBanner: document.getElementById('platform-banner'),
    };
    const maisHandle = els.maisContent?.querySelector('.bottom-sheet-handle');

    const ALL_TOOL_BTNS = [
        els.toolPencil, els.toolEraser, els.toolBucket,
        els.toolLine, els.toolSquare, els.toolCircle,
    ].filter(Boolean);

    const SHAPE_TOOLS = new Set(['line', 'square', 'circle']);

    function renderPlatformBanner() {
        if (!els.platformBanner) return;
        if (platform.isAndroidApp) {
            els.platformBanner.textContent = 'A conversao de imagem em padrao de missangas ficara disponivel na versao web do site.';
            els.platformBanner.classList.remove('hidden');
            return;
        }
        els.platformBanner.classList.add('hidden');
        els.platformBanner.textContent = '';
    }

    // ─────────────────────────────────────────────
    // GRADE & COLUNAS
    // ─────────────────────────────────────────────
    function recalcCols(preserveColors = true) {
        const threadW = els.threadGuide.offsetWidth || 30;
        // Desconta padding da canvas-area, canvas-wrapper, borda e gap interno
        const available = els.canvasArea.clientWidth - threadW - 72;
        const beadStep = state.cellSize + 3;
        const newCols = Math.max(8, Math.floor(available / beadStep));

        if (newCols === state.cols && state.colors.length > 0) return;

        const oldCols = state.cols;
        if (preserveColors && state.colors.length > 0) {
            const old = [...state.colors];
            const next = new Array(state.rows * newCols).fill('#ffffff');
            for (let y = 0; y < state.rows; y++)
                for (let x = 0; x < Math.min(oldCols, newCols); x++)
                    next[y * newCols + x] = old[y * oldCols + x];
            state.colors = next;
        } else {
            state.colors = new Array(state.rows * newCols).fill('#ffffff');
        }

        state.cols = newCols;
        renderGrid();
    }

    function renderGrid() {
        const { cellSize, cols, rows, colors } = state;
        els.grid.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
        els.grid.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;

        const frag = document.createDocumentFragment();
        for (let i = 0; i < colors.length; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.style.width = `${cellSize}px`;
            cell.style.height = `${cellSize}px`;
            cell.style.backgroundColor = colors[i];
            cell.dataset.index = i;
            frag.appendChild(cell);
        }
        els.grid.innerHTML = '';
        els.grid.appendChild(frag);
        renderThreadGuide();
    }

    function renderThreadGuide() {
        els.threadGuide.innerHTML = '';
        const gap = state.cellSize + 3;
        for (let i = 1; i <= state.rows; i++) {
            const span = document.createElement('span');
            span.className = 'thread-number';
            span.textContent = i;
            span.style.height = `${gap}px`;
            els.threadGuide.appendChild(span);
        }
        document.documentElement.style.setProperty('--cell-gap-size', `${gap}px`);
        document.documentElement.style.setProperty('--thread-offset',
            `${Math.round(gap / 2) + 12}px`);
    }

    function applyZoom(newSize) {
        state.cellSize = Math.min(80, Math.max(8, Math.round(newSize)));
        els.inputZoom.value = state.cellSize;
        const { cellSize, cols, rows } = state;
        els.grid.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
        els.grid.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;
        for (const cell of els.grid.children) {
            cell.style.width = `${cellSize}px`;
            cell.style.height = `${cellSize}px`;
        }
        renderThreadGuide();
        saveLocalState();
    }

    // ─────────────────────────────────────────────
    // COR ATUAL
    // ─────────────────────────────────────────────
    function updateColorSwatch() {
        if (els.currentColorSwatch)
            els.currentColorSwatch.style.backgroundColor = state.selectedColor;
    }

    // ─────────────────────────────────────────────
    // TOM DE PELE
    // ─────────────────────────────────────────────
    function applySkinTone(key) {
        state.skinTone = key;
        document.documentElement.style.setProperty('--skin-bg', SKIN_TONES[key]);
        document.querySelectorAll('.skin-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.skin === key);
        });
        saveLocalState();
    }

    document.querySelectorAll('.skin-btn').forEach(btn => {
        btn.addEventListener('click', () => applySkinTone(btn.dataset.skin));
    });

    // ─────────────────────────────────────────────
    // BOTTOM SHEET: Mais Ferramentas
    // ─────────────────────────────────────────────
    function openMais() {
        els.maisOverlay.classList.remove('hidden');
        els.maisContent.classList.remove('hidden');
        // Dois frames para garantir que a transição dispare após o display:flex
        requestAnimationFrame(() => requestAnimationFrame(() => {
            els.maisContent.classList.add('open');
        }));
        els.btnToggleMais.classList.add('open');
        els.btnToggleMais.setAttribute('aria-expanded', 'true');
    }

    function closeMais() {
        els.maisContent.classList.remove('open');
        els.btnToggleMais.classList.remove('open');
        els.btnToggleMais.setAttribute('aria-expanded', 'false');
        els.maisContent.addEventListener('transitionend', () => {
            if (!els.maisContent.classList.contains('open')) {
                els.maisContent.classList.add('hidden');
                els.maisOverlay.classList.add('hidden');
            }
        }, { once: true });
    }

    els.btnToggleMais.addEventListener('click', () => {
        els.maisContent.classList.contains('open') ? closeMais() : openMais();
    });

    els.maisOverlay.addEventListener('click', closeMais);
    if (maisHandle) maisHandle.addEventListener('click', closeMais);
    document.addEventListener('mousedown', (event) => {
        if (!els.maisContent.classList.contains('open')) return;
        if (els.maisContent.contains(event.target)) return;
        if (els.btnToggleMais.contains(event.target)) return;
        closeMais();
    });

    // ─────────────────────────────────────────────
    // FERRAMENTAS
    // ─────────────────────────────────────────────
    function paint(index) {
        if (SHAPE_TOOLS.has(state.tool)) return;
        const color = state.tool === 'eraser' ? '#ffffff' : state.selectedColor;
        if (state.tool === 'bucket') { floodFill(index, color); return; }
        if (state.colors[index] !== color) {
            state.colors[index] = color;
            const cell = els.grid.children[index];
            if (cell) cell.style.backgroundColor = color;
        }
    }

    function floodFill(startIndex, replacementColor) {
        const target = state.colors[startIndex];
        if (target === replacementColor) return;
        const queue = [startIndex];
        const visited = new Set();
        const { rows, cols } = state;
        while (queue.length) {
            const idx = queue.shift();
            if (visited.has(idx) || state.colors[idx] !== target) continue;
            visited.add(idx);
            state.colors[idx] = replacementColor;
            const cell = els.grid.children[idx];
            if (cell) cell.style.backgroundColor = replacementColor;
            const x = idx % cols, y = Math.floor(idx / cols);
            if (y > 0) queue.push(idx - cols);
            if (y < rows - 1) queue.push(idx + cols);
            if (x > 0) queue.push(idx - 1);
            if (x < cols - 1) queue.push(idx + 1);
        }
        saveHistory();
    }

    function setTool(toolName) {
        state.tool = toolName;
        ALL_TOOL_BTNS.forEach(btn =>
            btn.classList.toggle('active', btn.id.includes(toolName))
        );
        // Destaca o botão "Mais" quando uma ferramenta de forma está ativa
        els.btnToggleMais.classList.toggle('active', SHAPE_TOOLS.has(toolName));
        clearPreview();
        state.startCellIndex = null;
        // Fecha o sheet ao selecionar uma ferramenta
        if (els.maisContent.classList.contains('open')) closeMais();
    }

    function processImageToPattern(img) {
        const offscreen = document.createElement('canvas');
        offscreen.width = state.cols;
        offscreen.height = state.rows;
        const ctx = offscreen.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
            alert('Nao foi possivel processar a imagem neste navegador.');
            return;
        }

        const gridRatio = state.cols / state.rows;
        const imgRatio = img.width / img.height;
        let drawWidth;
        let drawHeight;
        let offsetX = 0;
        let offsetY = 0;

        if (imgRatio > gridRatio) {
            drawWidth = state.cols;
            drawHeight = drawWidth / imgRatio;
            offsetY = (state.rows - drawHeight) / 2;
        } else {
            drawHeight = state.rows;
            drawWidth = drawHeight * imgRatio;
            offsetX = (state.cols - drawWidth) / 2;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, state.cols, state.rows);
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

        const imageData = ctx.getImageData(0, 0, state.cols, state.rows);
        const { data } = imageData;
        const paletteRGB = PRESET_COLORS.map((hex) => {
            const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return {
                hex,
                r: parseInt(match[1], 16),
                g: parseInt(match[2], 16),
                b: parseInt(match[3], 16),
            };
        });

        const nextColors = new Array(state.rows * state.cols).fill('#ffffff');
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            let closestHex = '#ffffff';
            let minDistance = Infinity;

            for (const paletteColor of paletteRGB) {
                const distance =
                    ((r - paletteColor.r) ** 2) +
                    ((g - paletteColor.g) ** 2) +
                    ((b - paletteColor.b) ** 2);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestHex = paletteColor.hex;
                }
            }

            nextColors[i / 4] = closestHex;
        }

        state.colors = nextColors;
        renderGrid();
        saveHistory();
        saveLocalState();
    }

    // ─────────────────────────────────────────────
    // FERRAMENTAS DE FORMA (Reta / Quadrado / Círculo)
    // ─────────────────────────────────────────────
    function idxToXY(idx) { return { x: idx % state.cols, y: Math.floor(idx / state.cols) }; }
    function xyToIdx(x, y) {
        if (x < 0 || x >= state.cols || y < 0 || y >= state.rows) return -1;
        return y * state.cols + x;
    }

    function getLineIndices(s, e) {
        const a = idxToXY(s), b = idxToXY(e);
        const out = [];
        let dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
        let sx = a.x < b.x ? 1 : -1, sy = a.y < b.y ? 1 : -1;
        let err = dx - dy, x = a.x, y = a.y;
        for (; ;) {
            const i = xyToIdx(x, y); if (i >= 0) out.push(i);
            if (x === b.x && y === b.y) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x += sx; }
            if (e2 < dx) { err += dx; y += sy; }
        }
        return out;
    }

    function getSquareIndices(s, e) {
        const a = idxToXY(s), b = idxToXY(e);
        const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
        const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
        const set = new Set();
        for (let x = x0; x <= x1; x++) {
            [xyToIdx(x, y0), xyToIdx(x, y1)].forEach(i => i >= 0 && set.add(i));
        }
        for (let y = y0 + 1; y < y1; y++) {
            [xyToIdx(x0, y), xyToIdx(x1, y)].forEach(i => i >= 0 && set.add(i));
        }
        return [...set];
    }

    function getCircleIndices(s, e) {
        const a = idxToXY(s), b = idxToXY(e);
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        const rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2;
        const steps = Math.max(60, Math.ceil(2 * Math.PI * Math.max(rx, ry)));
        const set = new Set();
        for (let i = 0; i <= steps; i++) {
            const t = (2 * Math.PI * i) / steps;
            const idx = xyToIdx(Math.round(cx + rx * Math.cos(t)), Math.round(cy + ry * Math.sin(t)));
            if (idx >= 0) set.add(idx);
        }
        return [...set];
    }

    function getShapeIndices(start, end) {
        if (state.tool === 'line') return getLineIndices(start, end);
        if (state.tool === 'square') return getSquareIndices(start, end);
        if (state.tool === 'circle') return getCircleIndices(start, end);
        return [];
    }

    function clearPreview() {
        for (const idx of state.previewIndices) {
            const cell = els.grid.children[idx];
            if (cell) cell.style.backgroundColor = state.colors[idx];
        }
        state.previewIndices = [];
    }

    function drawPreviewShape(indices) {
        clearPreview();
        state.previewIndices = indices;
        const preview = state.selectedColor + 'aa';
        for (const idx of indices) {
            const cell = els.grid.children[idx];
            if (cell) cell.style.backgroundColor = preview;
        }
    }

    function commitShape(indices) {
        clearPreview();
        for (const idx of indices) {
            state.colors[idx] = state.selectedColor;
            const cell = els.grid.children[idx];
            if (cell) cell.style.backgroundColor = state.selectedColor;
        }
        saveHistory();
    }

    // ─────────────────────────────────────────────
    // TRANSFORMAÇÕES
    // ─────────────────────────────────────────────
    function mirrorGrid() {
        const { rows, cols } = state;
        for (let y = 0; y < rows; y++)
            for (let x = 0; x < Math.floor(cols / 2); x++) {
                const a = y * cols + x, b = y * cols + (cols - 1 - x);
                [state.colors[a], state.colors[b]] = [state.colors[b], state.colors[a]];
            }
        renderGrid(); saveHistory();
    }

    function rotateGrid(dir) {
        const { rows, cols } = state;
        const next = new Array(rows * cols).fill('#ffffff');
        for (let y = 0; y < rows; y++)
            for (let x = 0; x < cols; x++) {
                const nx = dir === 'cw' ? rows - 1 - y : y;
                const ny = dir === 'cw' ? x : cols - 1 - x;
                if (nx >= 0 && nx < cols && ny >= 0 && ny < rows)
                    next[ny * cols + nx] = state.colors[y * cols + x];
            }
        state.colors = next;
        renderGrid(); saveHistory();
    }

    // ─────────────────────────────────────────────
    // HISTÓRICO
    // ─────────────────────────────────────────────
    function saveHistory() {
        state.history = state.history.slice(0, state.historyIndex + 1);
        state.history.push({ colors: [...state.colors], cols: state.cols });
        if (state.history.length > state.maxHistory) state.history.shift();
        else state.historyIndex++;
        updateUndoRedo();
        saveLocalState();
    }

    function restoreHistory() {
        const h = state.history[state.historyIndex];
        if (!h) return;
        state.colors = [...h.colors];
        state.cols = h.cols;
        renderGrid(); updateUndoRedo(); saveLocalState();
    }

    function updateUndoRedo() {
        els.btnUndo.disabled = state.historyIndex <= 0;
        els.btnRedo.disabled = state.historyIndex >= state.history.length - 1;
    }

    // ─────────────────────────────────────────────
    // LOCAL STORAGE
    // ─────────────────────────────────────────────
    function saveLocalState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                cols: state.cols, cellSize: state.cellSize,
                colors: state.colors, selectedColor: state.selectedColor,
                skinTone: state.skinTone,
            }));
        } catch (_) { }
    }

    function loadLocalState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (!Array.isArray(data.colors) || !data.cols) return false;
            state.cols = data.cols;
            state.cellSize = data.cellSize || DEFAULT_CELL_SIZE;
            state.colors = data.colors;
            state.selectedColor = data.selectedColor || '#f97316';
            els.inputZoom.value = state.cellSize;
            if (data.skinTone && SKIN_TONES[data.skinTone]) {
                applySkinTone(data.skinTone);
            }
            return true;
        } catch (_) { return false; }
    }

    // ─────────────────────────────────────────────
    // EXPORTAR
    // ─────────────────────────────────────────────
    if (els.btnPrint) {
        els.btnPrint.addEventListener('click', () => window.print());
    }

    if (els.btnPdf) {
        els.btnPdf.addEventListener('click', async () => {
            const JsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
            if (!JsPDF || typeof html2canvas === 'undefined') {
                alert('Biblioteca de PDF não carregada.');
                return;
            }
            els.btnPdf.disabled = true;
            try {
                const canvas = await html2canvas(els.grid, {
                    scale: 2, backgroundColor: SKIN_TONES[state.skinTone],
                    useCORS: true, logging: false,
                });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new JsPDF('l', 'mm', 'a4');
                const pW = pdf.internal.pageSize.getWidth();
                const pH = pdf.internal.pageSize.getHeight();
                const ratio = Math.min((pW - 20) / canvas.width, (pH - 30) / canvas.height);
                const iW = canvas.width * ratio, iH = canvas.height * ratio;
                pdf.setFontSize(13);
                pdf.text('Missangas Jane — Padrão de Pulseira', pW / 2, 11, { align: 'center' });
                pdf.addImage(imgData, 'PNG', (pW - iW) / 2, 18, iW, iH);
                pdf.save('missangas-jane.pdf');
            } catch (err) {
                alert('Erro ao gerar PDF: ' + err.message);
            } finally {
                els.btnPdf.disabled = false;
            }
        });
    }

    if (els.btnSavePng) {
        els.btnSavePng.addEventListener('click', async () => {
            if (typeof html2canvas === 'undefined') return;
            els.btnSavePng.disabled = true;
            try {
                const canvas = await html2canvas(els.grid, {
                    scale: 3, backgroundColor: SKIN_TONES[state.skinTone], logging: false,
                });
                if (navigator.canShare) {
                    canvas.toBlob(async blob => {
                        const file = new File([blob], 'missangas-jane.png', { type: 'image/png' });
                        if (navigator.canShare({ files: [file] })) {
                            await navigator.share({ files: [file], title: 'Padrão de Missangas Jane' });
                            return;
                        }
                        downloadPNG(canvas);
                    }, 'image/png');
                } else {
                    downloadPNG(canvas);
                }
            } finally {
                els.btnSavePng.disabled = false;
            }
        });
    }

    function downloadPNG(canvas) {
        const a = document.createElement('a');
        a.download = 'missangas-jane.png';
        a.href = canvas.toDataURL('image/png');
        a.click();
    }

    // ─────────────────────────────────────────────
    // TOQUE — PINÇA E DESENHO
    // ─────────────────────────────────────────────
    let pinchDist0 = null, pinchZoom0 = null;

    els.canvasArea.addEventListener('touchstart', e => {
        if (e.touches.length === 2) {
            state.isDrawing = false; clearPreview(); state.startCellIndex = null;
            pinchDist0 = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY);
            pinchZoom0 = state.cellSize;
        } else if (e.touches.length === 1) {
            const t = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
            if (!t || !t.classList.contains('cell')) return;
            const idx = parseInt(t.dataset.index);
            if (SHAPE_TOOLS.has(state.tool)) { state.startCellIndex = idx; }
            else { state.isDrawing = true; paint(idx); }
        }
    }, { passive: false });

    els.canvasArea.addEventListener('touchmove', e => {
        e.preventDefault();
        if (e.touches.length === 2 && pinchDist0 !== null) {
            const d = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY);
            applyZoom(pinchZoom0 * (d / pinchDist0));
            return;
        }
        if (e.touches.length !== 1) return;
        const t = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
        if (!t || !t.classList.contains('cell')) return;
        const idx = parseInt(t.dataset.index);
        if (SHAPE_TOOLS.has(state.tool) && state.startCellIndex !== null)
            drawPreviewShape(getShapeIndices(state.startCellIndex, idx));
        else if (state.isDrawing)
            paint(idx);
    }, { passive: false });

    window.addEventListener('touchend', () => {
        pinchDist0 = null;
        if (SHAPE_TOOLS.has(state.tool) && state.startCellIndex !== null && state.previewIndices.length > 0) {
            commitShape([...state.previewIndices]);
            state.startCellIndex = null;
        } else if (state.isDrawing) {
            state.isDrawing = false;
            saveHistory();
        }
    });

    // ─────────────────────────────────────────────
    // MOUSE
    // ─────────────────────────────────────────────
    els.grid.addEventListener('mousedown', e => {
        if (!e.target.classList.contains('cell')) return;
        const idx = parseInt(e.target.dataset.index);
        state.isDrawing = true;
        if (SHAPE_TOOLS.has(state.tool)) state.startCellIndex = idx;
        else paint(idx);
    });

    els.grid.addEventListener('mouseover', e => {
        if (!state.isDrawing || !e.target.classList.contains('cell')) return;
        const idx = parseInt(e.target.dataset.index);
        if (SHAPE_TOOLS.has(state.tool) && state.startCellIndex !== null)
            drawPreviewShape(getShapeIndices(state.startCellIndex, idx));
        else paint(idx);
    });

    window.addEventListener('mouseup', () => {
        if (!state.isDrawing) return;
        if (SHAPE_TOOLS.has(state.tool) && state.startCellIndex !== null && state.previewIndices.length > 0) {
            commitShape([...state.previewIndices]);
            state.startCellIndex = null;
        } else {
            saveHistory();
        }
        state.isDrawing = false;
    });

    // ─────────────────────────────────────────────
    // HANDLERS DOS BOTÕES
    // ─────────────────────────────────────────────
    els.toolPencil.addEventListener('click', () => setTool('pencil'));
    els.toolEraser.addEventListener('click', () => setTool('eraser'));
    els.toolBucket.addEventListener('click', () => setTool('bucket'));
    if (els.toolLine) els.toolLine.addEventListener('click', () => setTool('line'));
    if (els.toolSquare) els.toolSquare.addEventListener('click', () => setTool('square'));
    if (els.toolCircle) els.toolCircle.addEventListener('click', () => setTool('circle'));

    els.btnZoomIn.addEventListener('click', () => applyZoom(state.cellSize + 4));
    els.btnZoomOut.addEventListener('click', () => applyZoom(state.cellSize - 4));
    els.inputZoom.addEventListener('input', e => applyZoom(parseInt(e.target.value)));

    els.btnUndo.addEventListener('click', () => {
        if (state.historyIndex > 0) { state.historyIndex--; restoreHistory(); }
    });
    els.btnRedo.addEventListener('click', () => {
        if (state.historyIndex < state.history.length - 1) { state.historyIndex++; restoreHistory(); }
    });

    if (els.btnMirror) els.btnMirror.addEventListener('click', mirrorGrid);
    if (els.btnRotateLeft) els.btnRotateLeft.addEventListener('click', () => rotateGrid('ccw'));
    if (els.btnRotateRight) els.btnRotateRight.addEventListener('click', () => rotateGrid('cw'));

    els.btnClear.addEventListener('click', () => els.clearModal.classList.remove('hidden'));
    els.btnCancelClear.addEventListener('click', () => els.clearModal.classList.add('hidden'));
    els.btnConfirmClear.addEventListener('click', () => {
        state.colors.fill('#ffffff');
        renderGrid(); saveHistory();
        els.clearModal.classList.add('hidden');
    });

    // Doação
    els.btnDonation.addEventListener('click', () => els.donationModal.classList.remove('hidden'));
    els.btnCloseDonation.addEventListener('click', () => els.donationModal.classList.add('hidden'));

    if (platform.kind === 'web' && els.btnImportImage && els.inputImage) {
        els.btnImportImage.addEventListener('click', () => els.inputImage.click());
        els.inputImage.addEventListener('change', (event) => {
            const [file] = event.target.files || [];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                const img = new Image();
                img.onload = () => processImageToPattern(img);
                img.src = loadEvent.target.result;
            };
            reader.readAsDataURL(file);
            event.target.value = '';
            if (els.maisContent.classList.contains('open')) closeMais();
        });
    }

    // Copiar Pix (com fallback para WebView Android antigo)
    if (els.btnCopyPix) {
        els.btnCopyPix.addEventListener('click', () => {
            const PIX = 'b5ce2235-461f-4581-afdb-3b257fc56d0c';
            const done = () => {
                const orig = els.btnCopyPix.textContent;
                els.btnCopyPix.textContent = 'Copiado! ✓';
                setTimeout(() => { els.btnCopyPix.textContent = orig; }, 2000);
            };
            if (navigator.clipboard && navigator.clipboard.writeText)
                navigator.clipboard.writeText(PIX).then(done).catch(() => fallbackCopy(PIX, done));
            else
                fallbackCopy(PIX, done);
        });
    }

    function fallbackCopy(text, cb) {
        // execCommand mantido como fallback para WebView Android < 93
        const el = document.createElement('textarea');
        el.value = text;
        el.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
        document.body.appendChild(el);
        el.focus(); el.select();
        try { document.execCommand('copy'); cb(); } catch (_) { }
        document.body.removeChild(el);
    }

    // Fechar modais ao clicar no fundo
    document.querySelectorAll('.modal-overlay').forEach(overlay =>
        overlay.addEventListener('click', e => {
            if (e.target === overlay) overlay.classList.add('hidden');
        })
    );

    // ─────────────────────────────────────────────
    // PALETA DE CORES
    // ─────────────────────────────────────────────
    function renderPalette() {
        els.palette.innerHTML = '';
        PRESET_COLORS.forEach(color => {
            const sw = document.createElement('div');
            sw.className = 'color-swatch';
            sw.style.backgroundColor = color;
            if (color === state.selectedColor) sw.classList.add('selected');
            sw.addEventListener('click', () => {
                state.selectedColor = color;
                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
                sw.classList.add('selected');
                updateColorSwatch();
            });
            els.palette.appendChild(sw);
        });
        updateColorSwatch();
    }

    // ─────────────────────────────────────────────
    // RESIZE OBSERVER
    // ─────────────────────────────────────────────
    if (typeof ResizeObserver !== 'undefined') {
        let timer;
        new ResizeObserver(() => {
            clearTimeout(timer);
            timer = setTimeout(() => recalcCols(true), 80);
        }).observe(els.canvasArea);
    } else {
        window.addEventListener('resize', () => recalcCols(true));
    }

    // ─────────────────────────────────────────────
    // ANDROID BACK BUTTON (Capacitor)
    // ─────────────────────────────────────────────
    if (window.Capacitor && window.Capacitor.Plugins.App) {
        const { App } = window.Capacitor.Plugins;
        App.addListener('backButton', () => {
            if (els.maisContent.classList.contains('open')) {
                closeMais();
            } else if (!els.clearModal.classList.contains('hidden')) {
                els.clearModal.classList.add('hidden');
            } else if (!els.donationModal.classList.contains('hidden')) {
                els.donationModal.classList.add('hidden');
            } else {
                // Se nada estiver aberto, minimiza o app
                App.exitApp();
            }
        });
    }

    // ─────────────────────────────────────────────
    // INICIALIZAÇÃO
    // ─────────────────────────────────────────────
    function init() {
        const hasState = loadLocalState();
        if (!hasState)
            state.colors = new Array(state.rows * state.cols).fill('#ffffff');

        renderPalette();   // também chama updateColorSwatch
        renderPlatformBanner();
        renderGrid();
        setTool('pencil');
        updateUndoRedo();
        saveHistory();
        // Aguarda o layout estabilizar antes de calcular colunas
        setTimeout(() => recalcCols(hasState), 160);
    }

    init();
});
