document.addEventListener('DOMContentLoaded', () => {
    // Elementos
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const editorContainer = document.getElementById('editor-container');
    const watermarkTextInput = document.getElementById('watermark-text');
    const opacitySlider = document.getElementById('opacity-slider');
    const opacityValue = document.getElementById('opacity-value');
    const colorBtns = document.querySelectorAll('.color-btn');
    const processBtn = document.getElementById('process-btn');
    const resetAppBtn = document.getElementById('reset-app-btn');
    const previewContainer = document.getElementById('preview-container');
    const hintPopup = document.getElementById('censorship-hint');
    const closeHintBtn = document.getElementById('close-hint');

    // Estado
    let editorCanvases = []; // Almacena objetos { canvas, ctx, originalImage, history, brushColor }
    let currentWatermarkColor = '#ff0000'; // Rojo por defecto para la marca
    let hintShown = false;

    // Colores disponibles para censura
    const brushColors = [
        { color: '#000000', name: 'Negro' },
        { color: '#ffffff', name: 'Blanco' },
        { color: '#dedede', name: 'Gris' } // Color típico de DNI
    ];

    // Event Listeners

    // Hint Popup Clean up
    if (closeHintBtn) {
        closeHintBtn.addEventListener('click', () => {
            if (hintPopup) hintPopup.classList.remove('show');
        });
    }

    // Arrastrar y Soltar
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    dropZone.addEventListener('click', () => {
        if (editorCanvases.length === 0) fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Controles
    opacitySlider.addEventListener('input', (e) => {
        opacityValue.textContent = `${e.target.value}%`;
    });

    colorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            colorBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentWatermarkColor = btn.dataset.color;
        });
    });

    processBtn.addEventListener('click', () => {
        if (editorCanvases.length === 0) {
            alert('Por favor, selecciona al menos una imagen.');
            return;
        }
        processImages();
    });

    if (resetAppBtn) {
        resetAppBtn.addEventListener('click', () => {
            // Reiniciar estado
            editorCanvases = [];
            fileInput.value = ''; // Limpiar input file

            // Limpiar UI
            editorContainer.innerHTML = '';
            editorContainer.style.display = 'none';
            previewContainer.innerHTML = '';

            // Mostrar zona de carga
            dropZone.style.display = 'block';

            // NO reseteamos hintShown para no molestar, o si el usuario quiere verlo de nuevo?
            // Dejamos hintShown como está (solo se muestra una vez por sesión como requested "cuando cargues la imagen")
            // Si el usuario quiere verlo cada vez que carga una imagen nueva, deberíamos resetearlo:
            // hintShown = false; 
            // Interpretación: "cuando cargues la imagen debe salir un popup" -> maybe every time a new image is loaded phase?
            // Dejaré que se muestre de nuevo si se reinicia la app.
            hintShown = false;
        });
    }

    // Funciones
    function handleFiles(files) {
        const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

        if (validFiles.length === 0) return;

        editorContainer.style.display = 'flex';
        dropZone.style.display = 'none';

        validFiles.forEach(file => {
            createEditorCanvas(file);
        });

        // Mostrar Popup si no se ha mostrado aún
        if (!hintShown && hintPopup) {
            showHint();
            hintShown = true;
        }
    }

    function showHint() {
        hintPopup.classList.add('show');
        // Ocultar automáticamente después de 5 segundos
        setTimeout(() => {
            hintPopup.classList.remove('show');
        }, 5000);
    }

    function createEditorCanvas(file) {
        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            // Crear elementos DOM
            const card = document.createElement('div');
            card.className = 'editor-card';

            const wrapper = document.createElement('div');
            wrapper.className = 'canvas-wrapper';

            const canvas = document.createElement('canvas');
            canvas.className = 'editor-canvas';

            const controls = document.createElement('div');
            controls.className = 'editor-controls';

            // Controles de Pincel (Colores)
            const brushControls = document.createElement('div');
            brushControls.className = 'brush-controls';

            let currentBrushColor = '#000000'; // Default black

            brushColors.forEach(brush => {
                const btn = document.createElement('button');
                btn.className = `brush-color-btn ${brush.color === '#000000' ? 'active' : ''}`;
                btn.style.backgroundColor = brush.color;
                btn.title = `Pincel ${brush.name}`;
                if (brush.color === '#ffffff') btn.style.border = '1px solid #ccc';

                btn.addEventListener('click', () => {
                    // Actualizar UI
                    brushControls.querySelectorAll('.brush-color-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    // Actualizar estado del pincel para este canvas
                    currentBrushColor = brush.color;
                    canvasState.brushColor = currentBrushColor;
                });

                brushControls.appendChild(btn);
            });

            const resetBtn = document.createElement('button');
            resetBtn.className = 'secondary-btn';
            resetBtn.textContent = 'Restaurar Original';
            resetBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12"/></svg> Restaurar Original`;

            wrapper.appendChild(canvas);
            controls.appendChild(brushControls);
            controls.appendChild(resetBtn);
            card.appendChild(wrapper);
            card.appendChild(controls);
            editorContainer.appendChild(card);

            // Configurar Canvas
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            // Estado del canvas
            const canvasState = {
                canvas,
                ctx,
                originalImage: img,
                fileName: file.name,
                brushColor: '#000000'
            };
            editorCanvases.push(canvasState);

            // Configurar dibujo (Censura)
            setupDrawing(canvas, ctx, canvasState);

            // Configurar Botón Reset
            resetBtn.addEventListener('click', () => {
                ctx.drawImage(img, 0, 0); // Redibujar imagen limpia
            });

            URL.revokeObjectURL(url);
        };
        img.src = url;
    }

    function setupDrawing(canvas, ctx, state) {
        let isDrawing = false;
        let lastX = 0;
        let lastY = 0;

        function getPos(e) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            let clientX, clientY;

            if (e.touches && e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }

            return {
                x: (clientX - rect.left) * scaleX,
                y: (clientY - rect.top) * scaleY
            };
        }

        function startDrawing(e) {
            isDrawing = true;
            const pos = getPos(e);
            lastX = pos.x;
            lastY = pos.y;
            draw(e);
        }

        function stopDrawing() {
            isDrawing = false;
            ctx.beginPath();
        }

        function draw(e) {
            if (!isDrawing) return;
            e.preventDefault();

            const pos = getPos(e);

            ctx.lineWidth = Math.max(10, canvas.width / 50);
            ctx.lineCap = 'round';
            ctx.strokeStyle = state.brushColor;

            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();

            lastX = pos.x;
            lastY = pos.y;
        }

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);

        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stopDrawing);
    }

    async function processImages() {
        previewContainer.innerHTML = '';

        const text = watermarkTextInput.value || 'COPIA DNI';
        const opacity = opacitySlider.value / 100;

        for (const state of editorCanvases) {
            try {
                const dataUrl = await addWatermarkToCanvas(state.canvas, text, opacity, currentWatermarkColor);
                createPreviewCard(dataUrl, state.fileName);
            } catch (error) {
                console.error('Error al procesar imagen:', error);
                alert(`Error al procesar ${state.fileName}`);
            }
        }
    }

    function addWatermarkToCanvas(sourceCanvas, text, opacity, color) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = sourceCanvas.width;
            canvas.height = sourceCanvas.height;

            // 1. Dibujar imagen censurada
            ctx.drawImage(sourceCanvas, 0, 0);

            // 2. Geometría
            const diagLength = Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height);
            const angle = Math.atan2(canvas.height, canvas.width);

            // 3. Texto
            ctx.save();
            let fontSize = 100;
            ctx.font = `bold ${fontSize}px sans-serif`;

            const textMetrics = ctx.measureText(text);
            const textWidth = textMetrics.width;
            const targetWidth = diagLength * 0.8;

            if (textWidth > 0) {
                fontSize = Math.floor(fontSize * (targetWidth / textWidth));
            }

            const minSize = Math.max(12, canvas.width / 40);
            const maxSize = canvas.width / 5;
            fontSize = Math.min(Math.max(fontSize, minSize), canvas.height / 3);

            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.fillStyle = color;
            ctx.globalAlpha = opacity;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // 4. Rotar y dibujar
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(-angle);

            ctx.fillText(text, 0, 0);
            ctx.restore();

            resolve(canvas.toDataURL());
        });
    }

    function createPreviewCard(dataUrl, fileName) {
        const card = document.createElement('div');
        card.className = 'preview-card';

        const img = document.createElement('img');
        img.src = dataUrl;
        img.alt = `Marca de agua en ${fileName}`;

        const downloadBtn = document.createElement('a');
        downloadBtn.href = dataUrl;
        downloadBtn.download = `watermarked_${fileName}`;
        downloadBtn.className = 'download-btn';
        downloadBtn.textContent = 'Descargar Imagen';
        downloadBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Descargar Imagen
        `;

        card.appendChild(img);
        card.appendChild(downloadBtn);
        previewContainer.appendChild(card);
    }
});
