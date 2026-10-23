// =========================================================================
// REPORTE MÉDICO - SCRIPT PRINCIPAL
// =========================================================================

class ReporteMedico {
    constructor() {
        try {
            
            this.form = document.getElementById('reportForm');
            this.pesoInput = document.getElementById('peso');
            this.tallaInput = document.getElementById('talla');
            this.imcInput = document.getElementById('imc');
            this.reportDateElement = document.getElementById('reportDate');
            
            // Almacenar archivos adjuntos
            this.adjuntos = [];
            this.adjuntosEliminadosFlag = false; // Bandera para eliminar adjuntos de DB al guardar
            
            if (!this.form || !this.pesoInput || !this.tallaInput || !this.imcInput) {
                console.error('Elementos del formulario no encontrados');
                return;
            }
            
            this.init();
        } catch (error) {
            console.error('Error en constructor:', error);
        }
    }

    init() {
        try {
            this.setupEventListeners();
            this.setReportDate();
            this.calculateIMC();
            this.waitForSupabaseAndLoadReferidos();
            this.checkImportedDataFromStorage();
        } catch (error) {
            console.error('❌ ERROR EN INIT:', error);
        }
    }

    waitForSupabaseAndLoadReferidos(attempts = 0) {
        if (window.supabaseClient) {
            this.loadReferidos().then(() => {
                // Si hay un valor guardado para referidoSeleccionado, reaplicarlo
                if (this._pendingReferidoValue) {
                    const select = document.getElementById('referidoSeleccionado');
                    if (select) {
                        select.value = this._pendingReferidoValue;
                        this._pendingReferidoValue = null;
                    }
                }
            });
        } else if (attempts < 50) { // 5 segundos max
            setTimeout(() => this.waitForSupabaseAndLoadReferidos(attempts + 1), 100);
        } else {
            console.warn('Supabase no disponible para cargar referidos');
        }
    }

    async loadReferidos() {
        try {
            if (!window.supabaseClient) return;
            this.referidos = await window.supabaseClient.getReferidos();
            this.updateReferidosSelect();
        } catch (error) {
            console.error('Error cargando referidos:', error);
        }
    }

    updateReferidosSelect() {
        const select = document.getElementById('referidoSeleccionado');
        if (!select) return;
        
        select.innerHTML = '<option value="">Seleccione un referido...</option>';
        if (this.referidos && this.referidos.length > 0) {
            this.referidos.forEach(r => {
                const option = document.createElement('option');
                option.value = r.id;
                option.textContent = r.nombre + (r.contacto ? ` (${r.contacto})` : '');
                select.appendChild(option);
            });
        } else {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No hay referidos registrados';
            option.disabled = true;
            select.appendChild(option);
        }
    }

    handleComoNosConocisteChange(value) {
        const referidoContainer = document.getElementById('referidoContainer');
        const otroContainer = document.getElementById('otroComoNosConocisteContainer');
        const referidoSelect = document.getElementById('referidoSeleccionado');
        
        if (value === 'referido_por') {
            if (referidoContainer) referidoContainer.style.display = 'block';
            if (otroContainer) otroContainer.style.display = 'none';
            if (referidoSelect) referidoSelect.required = true;
        } else if (value === 'otro') {
            if (referidoContainer) referidoContainer.style.display = 'none';
            if (otroContainer) otroContainer.style.display = 'block';
            if (referidoSelect) referidoSelect.required = false;
        } else {
            if (referidoContainer) referidoContainer.style.display = 'none';
            if (otroContainer) otroContainer.style.display = 'none';
            if (referidoSelect) referidoSelect.required = false;
        }
    }

    openReferidosModal() {
        const modal = document.getElementById('referidosModal');
        if (!modal) return;
        this.renderReferidosList();
        modal.classList.add('active');
        
        const closeBtn = document.getElementById('referidosClose');
        const addBtn = document.getElementById('btnAgregarReferido');
        const nombreInput = document.getElementById('nuevoReferidoNombre');
        const contactoInput = document.getElementById('nuevoReferidoContacto');
        
        const closeModal = () => {
            modal.classList.remove('active');
            this.cleanupReferidosListeners();
        };
        
        const handleAdd = async () => {
            const nombre = nombreInput?.value?.trim();
            const contacto = contactoInput?.value?.trim();
            if (!nombre) {
                this.showAlert('Ingrese el nombre del referido', 'error');
                return;
            }
            try {
                if (!window.supabaseClient) throw new Error('Supabase no disponible');
                await window.supabaseClient.saveReferido({ nombre, contacto: contacto || null, activo: true });
                nombreInput.value = '';
                contactoInput.value = '';
                await this.loadReferidos();
                this.renderReferidosList();
                this.showAlert('✓ Referido agregado', 'success');
            } catch (error) {
                console.error('Error agregando referido:', error);
                this.showAlert('Error al agregar referido: ' + error.message, 'error');
            }
        };
        
        const handleDelete = async (id) => {
            if (!confirm('¿Eliminar este referido?')) return;
            try {
                if (!window.supabaseClient) throw new Error('Supabase no disponible');
                await window.supabaseClient.deleteReferido(id);
                await this.loadReferidos();
                this.renderReferidosList();
                this.showAlert('✓ Referido eliminado', 'success');
            } catch (error) {
                console.error('Error eliminando referido:', error);
                this.showAlert('Error al eliminar referido: ' + error.message, 'error');
            }
        };
        
        this._referidosListeners = [
            { el: closeBtn, type: 'click', fn: closeModal },
            { el: addBtn, type: 'click', fn: handleAdd },
            { el: modal, type: 'click', fn: (e) => { if (e.target === modal) closeModal(); } },
            { el: nombreInput, type: 'keydown', fn: (e) => { if (e.key === 'Enter') handleAdd(); } },
        ];
        
        this._referidosListeners.forEach(({ el, type, fn }) => el?.addEventListener(type, fn));
        setTimeout(() => nombreInput?.focus(), 100);
    }

    renderReferidosList() {
        const container = document.getElementById('referidosList');
        if (!container) return;
        
        if (!this.referidos || this.referidos.length === 0) {
            container.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 20px;">No hay referidos registrados. Agregue uno nuevo arriba.</p>';
            return;
        }
        
        container.innerHTML = this.referidos.map(r => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border: 1px solid #e0e4e8; border-radius: 8px; margin-bottom: 8px; background: #f8fafc;">
                <div>
                    <strong style="color: #0A94B0;">${Kinetiq.escapeHtml(r.nombre)}</strong>
                    ${r.contacto ? `<div style="font-size: 12px; color: #95a5a6;">${Kinetiq.escapeHtml(r.contacto)}</div>` : ''}
                </div>
                <button type="button" data-referido-id="${Kinetiq.escapeHtml(r.id)}" class="btn-delete-referido" style="padding: 6px 12px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">🗑️ Eliminar</button>
            </div>
        `).join('');
        
        container.querySelectorAll('.btn-delete-referido').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-referido-id');
                this.handleDeleteReferido(id);
            });
        });
    }

    handleDeleteReferido(id) {
        if (!confirm('¿Eliminar este referido?')) return;
        this.deleteReferido(id);
    }

    async deleteReferido(id) {
        try {
            if (!window.supabaseClient) throw new Error('Supabase no disponible');
            await window.supabaseClient.deleteReferido(id);
            await this.loadReferidos();
            this.renderReferidosList();
            this.showAlert('✓ Referido eliminado', 'success');
        } catch (error) {
            console.error('Error eliminando referido:', error);
            this.showAlert('Error al eliminar referido: ' + error.message, 'error');
        }
    }

    cleanupReferidosListeners() {
        if (this._referidosListeners) {
            this._referidosListeners.forEach(({ el, type, fn }) => el?.removeEventListener(type, fn));
            this._referidosListeners = null;
        }
    }

    checkImportedDataFromStorage() {
        const reportToLoad = sessionStorage.getItem('reportToLoad');
        
        // Cargar adjuntos SIEMPRE, independientemente de si hay error al cargar datos
        const adjuntosToLoad = sessionStorage.getItem('adjuntosToLoad');
        if (adjuntosToLoad) {
            try {
                this.adjuntos = JSON.parse(adjuntosToLoad);
                this.mostrarAdjuntosCargados();
            } catch (err) {
                console.error('Error parseando adjuntos:', err);
            }
            sessionStorage.removeItem('adjuntosToLoad');
        } else {
        }
        
        // Cargar datos del reporte
        if (reportToLoad) {
            try {
                // Validar strings problemáticos
                if (reportToLoad === 'undefined' || reportToLoad === 'null' || reportToLoad.trim() === '') {
                    sessionStorage.removeItem('reportToLoad');
                    return;
                }
                let data = reportToLoad;
                // Si ya es un objeto, no parsear
                if (typeof data === 'string') {
                    data = data.trim();
                    if (data) {
                        data = JSON.parse(data);
                    } else {
                        throw new Error('Datos vacíos');
                    }
                }
                // Validar que sea un objeto válido
                if (data && typeof data === 'object' && !Array.isArray(data)) {
                    this.loadDataFromObject(data);
                    this.showAlert('✓ Reporte cargado correctamente', 'success');
                } else {
                    throw new Error('Formato de datos inválido');
                }
                sessionStorage.removeItem('reportToLoad');
                return;
            } catch (error) {
                console.error('Error en checkImportedDataFromStorage:', error);
                console.error('🔍 reportToLoad que falló:', reportToLoad);
                this.showAlert('Error al cargar el reporte: ' + error.message, 'error');
                sessionStorage.removeItem('reportToLoad'); // Limpiar basura
            }
        }
    }

    loadDataFromObject(data) {
        // Evita avisar "paciente existente" sobre el mismo reporte que se está editando
        if (data && data.cc) document.body.dataset.cedulaCargada = String(data.cc).trim();
        Object.keys(data).forEach(key => {
            if (key === 'saltos' || key === 'unipodal') return;
            
            const element = document.getElementById(key);
            // Los campos de archivo no aceptan valores por código (reportes viejos guardaron la ruta falsa del archivo)
            if (element && element.type !== 'file') {
                if (element.type === 'checkbox') {
                    element.checked = Boolean(data[key]);
                } else if (key === 'referidoSeleccionado') {
                    // Guardar para aplicar después de cargar referidos
                    this._pendingReferidoValue = data[key];
                } else if (element.hasAttribute('data-dias')) {
                    // Reportes antiguos guardaban texto libre ("5 días")
                    element.value = Kinetiq.normalizarDias(data[key]);
                } else if (element.tagName === 'SELECT') {
                    element.value = data[key];
                    if (!element.value && data[key]) {
                        const searchVal = String(data[key]).trim().toLowerCase();
                        for (const opt of element.options) {
                            const optVal = opt.value.toLowerCase();
                            const optText = opt.text.toLowerCase();
                            if (optVal === searchVal || optText === searchVal || optVal.startsWith(searchVal) || optText.startsWith(searchVal) || optVal.includes(searchVal) || optText.includes(searchVal)) {
                                element.value = opt.value;
                                break;
                            }
                        }
                    }
                } else {
                    element.value = data[key];
                }
            }
        });

        if (data.atendido_por && !data.atendidoPor) {
            const el = document.getElementById('atendidoPor');
            if (el) el.value = data.atendido_por;
        }

        this.calculateIMC();
        
        // Trigger the comoNosConociste change handler to show/hide appropriate containers
        const comoNosConociste = document.getElementById('comoNosConociste');
        if (comoNosConociste && comoNosConociste.value) {
            this.handleComoNosConocisteChange(comoNosConociste.value);
        }
    }

    getRequiredFields() {
        return [
            { id: 'nombre', label: 'Nombre' },
            { id: 'apellido', label: 'Apellido' },
            { id: 'cc', label: 'Cédula' },
            { id: 'atendidoPor', label: 'Atendido por' },
            { id: 'comoNosConociste', label: '¿Cómo nos conociste?' }
        ];
    }

    initFieldTracking() {
        document.querySelectorAll('.form-control').forEach(el => {
            el.addEventListener('input', () => {
                if (el.value.trim()) {
                    el.classList.remove('field-missing');
                    el.classList.add('field-filled');
                } else {
                    el.classList.remove('field-filled');
                }
            });
            if (el.value.trim()) {
                el.classList.add('field-filled');
            }
        });

        document.querySelectorAll('select.form-control').forEach(el => {
            el.addEventListener('change', () => {
                if (el.value) {
                    el.classList.remove('field-missing');
                    el.classList.add('field-filled');
                } else {
                    el.classList.remove('field-filled');
                }
            });
            if (el.value) el.classList.add('field-filled');
        });
    }

    validateRequiredFields() {
        const missing = [];
        this.getRequiredFields().forEach(f => {
            const el = document.getElementById(f.id);
            if (!el || !el.value.trim()) {
                missing.push(f.label);
                if (el) el.classList.add('field-missing');
            } else {
                el.classList.remove('field-missing');
                el.classList.add('field-filled');
            }
        });
        return missing;
    }

    clearFieldHighlights() {
        document.querySelectorAll('.field-missing').forEach(el => el.classList.remove('field-missing'));
    }

    validateAll() {
        this.validateNombre();
        this.validateApellido();
        this.validateCC();
        this.validateEdad();
        this.validatePeso();
        this.validateTalla();
        this.validateCelular();
    }

    getValidationErrors() {
        this.validateAll();
        const errors = [];
        document.querySelectorAll('.input-error').forEach(el => {
            const id = el.id;
            let label = '';
            const labelEl = document.querySelector(`label[for="${id}"]`);
            if (labelEl) {
                label = labelEl.textContent.trim().replace(/\s*\*$/, '');
            } else {
                label = id.charAt(0).toUpperCase() + id.slice(1);
            }
            errors.push({ id, label });
        });
        return errors;
    }

    getAllEmptyFields() {
        const empty = [];
        // Solo campos del formulario que se ven (no el buscador ni las ventanas de referidos,
        // ni "Referido por"/"Especificar" cuando están ocultos). Los selects con botones están
        // ocultos, pero su grupo sí se ve.
        document.querySelectorAll('#reportForm .form-control').forEach(el => {
            const grupo = el.closest('.form-group') || el;
            if (grupo.offsetParent === null) return;
            if (el.value == null || el.value.toString().trim() === '') {
                const id = el.id;
                let label = '';
                const labelEl = document.querySelector(`label[for="${id}"]`);
                if (labelEl) {
                    label = labelEl.textContent.trim().replace(/\s*\*$/, '');
                } else if (el.placeholder) {
                    label = el.placeholder;
                } else if (el.name) {
                    label = el.name.charAt(0).toUpperCase() + el.name.slice(1);
                } else {
                    label = id.charAt(0).toUpperCase() + id.slice(1);
                }
                empty.push({ id, label });
            }
        });
        return empty;
    }

    setupEventListeners() {
        try {
            this.initFieldTracking();

            // Validaciones para Datos Generales
            const nombreInput = document.getElementById('nombre');
            const apellidoInput = document.getElementById('apellido');
            const edadInput = document.getElementById('edad');
            const ccInput = document.getElementById('cc');
            const celularInput = document.getElementById('celular');

            if (nombreInput) nombreInput.addEventListener('input', () => { this.validateNombre(); this.updateHeaderPatient(); });
            if (apellidoInput) apellidoInput.addEventListener('input', () => { this.validateApellido(); this.updateHeaderPatient(); });
            if (edadInput) {
                edadInput.addEventListener('input', () => {
                    this.restrictToNumbers(edadInput);
                    this.validateEdad();
                });
            }
            if (ccInput) {
                ccInput.addEventListener('input', () => {
                    this.restrictToNumbers(ccInput);
                    this.validateCC();
                });
                ccInput.addEventListener('blur', () => {
                    Kinetiq.revisarPacienteExistente(ccInput.value, 'pisada', paciente => this.prefillFromPaciente(paciente)).catch(() => {});
                });
            }
            if (celularInput) {
                celularInput.addEventListener('input', () => {
                    this.restrictToNumbers(celularInput);
                    this.validateCelular();
                });
            }

            // Listener para "¿Cómo nos conociste?"
            const comoNosConocisteSelect = document.getElementById('comoNosConociste');
            if (comoNosConocisteSelect) {
                comoNosConocisteSelect.addEventListener('change', (e) => {
                    this.handleComoNosConocisteChange(e.target.value);
                });
            }

            // Listener para botón gestionar referidos
            const btnAbrirReferidos = document.getElementById('btnAbrirReferidos');
            if (btnAbrirReferidos) {
                btnAbrirReferidos.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.openReferidosModal();
                });
            }
            
            // Agregar restricción numérica a peso y talla
            this.pesoInput.addEventListener('input', () => {
                this.restrictToNumbers(this.pesoInput, true);
                this.calculateIMC();
                this.validatePeso();
            });
            this.tallaInput.addEventListener('input', () => {
                this.restrictToNumbers(this.tallaInput, true);
                this.calculateIMC();
                this.validateTalla();
            });

            // Buscar o crear input file
            let fileInput = document.getElementById('fileInput');
            if (!fileInput) {
                fileInput = document.createElement('input');
                fileInput.id = 'fileInput';
                fileInput.type = 'file';
                fileInput.accept = '.pdf,.json';
                fileInput.style.display = 'none';
                document.body.appendChild(fileInput);
            } else {
            }
            
            // Agregar listener (o reemplazarlo)
            fileInput.addEventListener('change', (event) => {
                this.handleFileSelect(event);
            });

            // Botón Buscar Paciente
            const checkPatientBtn = document.getElementById('checkPatientBtn');
            if (checkPatientBtn) {
                checkPatientBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.buscarPacienteExistente();
                });
            }

            // Solo agregar listeners a botones que existen
            const loadFileBtn = document.getElementById('loadFileBtn');
            if (loadFileBtn) {
                loadFileBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.loadFile();
                });
            }

            // Listener para archivo adjunto (PDF/Imagen)
            const pdfImagenInput = document.getElementById('pdfImagenInput');
            if (pdfImagenInput) {
                pdfImagenInput.addEventListener('change', (e) => {
                    this.handlePdfImagenSelect(e);
                });
            }

            const saveBtn = document.getElementById('saveBtn');
            if (saveBtn) {
                saveBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.saveReportToDB();
                });
            }

            const printBtn = document.getElementById('printBtn');
            if (printBtn) {
                printBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.printReport();
                });
            }

            // Agregar listener para botón Borrar adjuntos
            const borrarAdjuntoBtn = document.getElementById('borrarAdjuntoBtn');
            if (borrarAdjuntoBtn) {
                borrarAdjuntoBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.borrarAdjuntos();
                });
            }

            // Agregar listener para botón Limpiar en sidebar flotante
            const cleanBtns = document.querySelectorAll('.floating-sidebar button[type="reset"]');
            cleanBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    // Limpiar el formulario
                    if (this.form) {
                        this.form.reset();
                    }
                    document.querySelectorAll('.field-filled, .field-missing').forEach(el => {
                        el.classList.remove('field-filled', 'field-missing');
                    });
                    // Limpiar archivos adjuntos
                    this.adjuntos = [];
                    const pdfImagenInput = document.getElementById('pdfImagenInput');
                    if (pdfImagenInput) {
                        pdfImagenInput.value = '';
                    }
                    const adjuntoInfo = document.getElementById('adjuntoInfo');
                    if (adjuntoInfo) {
                        adjuntoInfo.style.display = 'none';
                    }
                    // Recalcular IMC en caso de que se haya completado
                    this.setReportDate();
                    this.showAlert('✓ Formulario limpiado correctamente', 'success');
                });
            });
        } catch (error) {
            console.error('Error en setupEventListeners:', error);
        }
    }

    calculateIMC() {
        const peso = parseFloat(this.pesoInput.value) || 0;
        const talla = parseFloat(this.tallaInput.value) || 0;

        if (peso > 0 && talla > 0) {
            const talla_m = talla / 100;
            const imc = peso / (talla_m * talla_m);
            this.imcInput.value = imc.toFixed(1);
        } else {
            this.imcInput.value = '';
        }
    }

    // ==================== VALIDACIONES ====================
    
    restrictToNumbers(input, allowDecimals = false) {
        let value = input.value;
        
        if (allowDecimals) {
            // Permitir números y un solo punto decimal
            value = value.replace(/[^\d.]/g, '');
            // Asegurar solo un punto decimal
            const parts = value.split('.');
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }
        } else {
            // Solo números enteros
            value = value.replace(/\D/g, '');
        }
        
        input.value = value;
    }
    
    showFieldError(input, message) {
        // Remover error previo si existe
        this.clearFieldError(input);
        
        // Agregar clase de error al input
        input.classList.add('input-error');
        
        // Crear mensaje de error
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.id = `error-${input.id}`;
        
        // Insertar después del input
        input.parentNode.insertBefore(errorDiv, input.nextSibling);
    }

    clearFieldError(input) {
        input.classList.remove('input-error');
        const errorMsg = document.getElementById(`error-${input.id}`);
        if (errorMsg) {
            errorMsg.remove();
        }
    }

    validateNombre() {
        const input = document.getElementById('nombre');
        const value = input.value.trim();
        
        // Permitir solo letras, espacios, tildes y ñ
        const regex = /^[a-záéíóúñA-ZÁÉÍÓÚÑ\s]*$/;
        
        if (value && !regex.test(value)) {
            this.showFieldError(input, 'Solo se permiten letras');
            return false;
        }
        
        this.clearFieldError(input);
        return true;
    }

    validateApellido() {
        const input = document.getElementById('apellido');
        const value = input.value.trim();
        
        const regex = /^[a-záéíóúñA-ZÁÉÍÓÚÑ\s]*$/;
        
        if (value && !regex.test(value)) {
            this.showFieldError(input, 'Solo se permiten letras');
            return false;
        }
        
        this.clearFieldError(input);
        return true;
    }

    validateEdad() {
        const input = document.getElementById('edad');
        const value = parseFloat(input.value);
        
        if (input.value && (isNaN(value) || value < 0 || value > 120)) {
            this.showFieldError(input, 'Edad debe estar entre 0 y 120 años');
            return false;
        }
        
        this.clearFieldError(input);
        return true;
    }

    validatePeso() {
        const value = parseFloat(this.pesoInput.value);
        
        if (this.pesoInput.value && (isNaN(value) || value <= 0 || value > 300)) {
            this.showFieldError(this.pesoInput, 'Peso debe estar entre 0 y 300 kg');
            return false;
        }
        
        this.clearFieldError(this.pesoInput);
        return true;
    }

    validateTalla() {
        const value = parseFloat(this.tallaInput.value);
        
        if (this.tallaInput.value && (isNaN(value) || value <= 0 || value > 250)) {
            this.showFieldError(this.tallaInput, 'Talla debe estar entre 0 y 250 cm');
            return false;
        }
        
        this.clearFieldError(this.tallaInput);
        return true;
    }

    validateCC() {
        const input = document.getElementById('cc');
        const value = input.value.trim();
        
        // Solo números y entre 6 y 12 dígitos
        const regex = /^\d*$/;
        
        if (value && !regex.test(value)) {
            this.showFieldError(input, 'Solo se permiten números');
            return false;
        }
        
        if (value && (value.length < 6 || value.length > 12)) {
            this.showFieldError(input, 'CC debe tener entre 6 y 12 dígitos');
            return false;
        }
        
        this.clearFieldError(input);
        return true;
    }

    validateCelular() {
        const input = document.getElementById('celular');
        const value = input.value.trim();
        
        // Solo números y entre 7 y 15 dígitos (formato internacional)
        const regex = /^\d*$/;
        
        if (value && !regex.test(value)) {
            this.showFieldError(input, 'Solo se permiten números');
            return false;
        }
        
        if (value && (value.length < 7 || value.length > 15)) {
            this.showFieldError(input, 'Celular debe tener entre 7 y 15 dígitos');
            return false;
        }
        
        this.clearFieldError(input);
        return true;
    }

    setReportDate() {
        const today = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dateStr = today.toLocaleDateString('es-ES', options);
        this.reportDateElement.textContent = dateStr;
    }

    updateHeaderPatient() {
        const nameEl = document.getElementById('patientName');
        if (!nameEl) return;
        const nombre = document.getElementById('nombre')?.value?.trim() || '';
        const apellido = document.getElementById('apellido')?.value?.trim() || '';
        nameEl.textContent = `${nombre} ${apellido}`.trim() || 'Paciente';
    }

    loadFile() {
        const fileInput = document.getElementById('fileInput');
        
        if (fileInput) {
            fileInput.value = ''; // Limpiar valor anterior
            fileInput.click();
        } else {
            console.error('fileInput no encontrado en el DOM');
        }
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        // Límite de seguridad: máximo 15MB por archivo para evitar sobrecarga de memoria
        const MAX_SIZE = Kinetiq.MAX_CARGA_MB * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            this.showAlert(`El archivo supera el tamaño máximo permitido (${Kinetiq.MAX_CARGA_MB} MB).`, 'error');
            return;
        }

        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isJson = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');

        if (isJson) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    this.loadDataFromObject(data);
                    this.showAlert('✓ Archivo JSON cargado correctamente', 'success');
                } catch (error) {
                    console.error('Error al leer archivo JSON:', error);
                    this.showAlert('Error al leer el archivo JSON: ' + error.message, 'error');
                }
            };
            reader.readAsText(file);
            return;
        }

        if (isPdf) {
            try {
                this.showAlert('⏳ Analizando archivo PDF...', 'info');
                const arrayBuffer = await file.arrayBuffer();

                let data = null;

                // 1. Intentar leer copia digital incrustada en metadatos (PDFs recientes)
                if (window.PDFLib) {
                    try {
                        const { PDFDocument } = window.PDFLib;
                        const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

                        const subject = pdfDoc.getSubject();
                        if (subject && subject.includes('KINETIQ_DATA:')) {
                            const cleanBase64 = subject.split('KINETIQ_DATA:')[1].trim();
                            data = this.decodeBase64Json(cleanBase64);
                        }

                        if (!data) {
                            const keywords = pdfDoc.getKeywords();
                            if (keywords && keywords.includes('KINETIQ_DATA:')) {
                                const cleanBase64 = keywords.split('KINETIQ_DATA:')[1].trim();
                                data = this.decodeBase64Json(cleanBase64);
                            }
                        }

                        // PDFs nuevos: sólo traen la referencia, los datos se leen de la base de datos
                        if (!data && subject && subject.includes('KINETIQ_REF:')) {
                            data = await this.cargarDesdeReferencia(subject.split('KINETIQ_REF:')[1]);
                        }
                    } catch (eMeta) {
                        console.warn('Metadatos digitales no disponibles con PDFLib:', eMeta);
                    }
                }

                // 2. Si no contiene metadatos directos (PDF antiguo o externo), extraer texto visible con pdf.js
                if (!data) {
                    this.showAlert('⏳ Documento anterior sin metadatos. Escaneando texto del PDF...', 'info');
                    try {
                        const fullText = await this.extractTextFromPDF(arrayBuffer);
                        if (fullText) {
                            data = this.parseOldPdfText(fullText);
                        }
                    } catch (eOcr) {
                        console.error('Error extrayendo texto del PDF:', eOcr);
                    }
                }

                if (data && (data.nombre || data.apellido || data.cc || (data.reporteData && data.reporteData.nombre))) {
                    const finalData = data.reporteData ? data.reporteData : data;
                    this.loadDataFromObject(finalData);
                    this.showAlert('✓ ¡Paciente cargado exitosamente desde el PDF! Se recuperaron los datos del documento. Revisa los campos y presiona "Guardar".', 'success');
                } else {
                    this.showAlert('⚠️ No se pudieron extraer datos de este archivo PDF. Verifica que sea un reporte clínico emitido por Kinetiq.', 'warning');
                }
            } catch (error) {
                console.error('Error procesando PDF:', error);
                this.showAlert('Error al procesar el archivo PDF: ' + error.message, 'error');
            }
            return;
        }

        this.showAlert('Formato no soportado. Por favor selecciona un archivo .pdf o .json.', 'error');
    }

    async cargarDesdeReferencia(refStr) {
        try {
            const ref = JSON.parse(String(refStr).trim());
            if (!ref?.cc || !window.supabaseClient?.supabase) return null;
            const reporte = await window.supabaseClient.getReporteByCedulaTipo(ref.cc, ref.tipo || 'pisada');
            return reporte?.reporte_json || null;
        } catch (e) {
            console.warn('No se pudo cargar el reporte referenciado desde la base de datos:', e);
            return null;
        }
    }

    decodeBase64Json(cleanBase64) {
        try {
            const jsonStr = decodeURIComponent(escape(atob(cleanBase64)));
            return JSON.parse(jsonStr);
        } catch (e1) {
            try {
                const binStr = atob(cleanBase64);
                const bytes = Uint8Array.from(binStr, c => c.charCodeAt(0));
                return JSON.parse(new TextDecoder().decode(bytes));
            } catch (e2) {
                return null;
            }
        }
    }

    async extractTextFromPDF(arrayBuffer) {
        if (!window.pdfjsLib) {
            throw new Error('Librería de lectura de PDF (pdf.js) no disponible en el navegador');
        }
        try {
            if (window.pdfjsLib.GlobalWorkerOptions && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            }
        } catch (e) {}

        const loadingTask = window.pdfjsLib.getDocument({
            data: arrayBuffer,
            useWorkerFetch: false,
            isEvalSupported: false,
            useSystemFonts: true
        });
        const pdf = await loadingTask.promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += `\n--- PÁGINA ${i} ---\n` + pageText;
        }
        return fullText;
    }

    extractBetween(source, startLabel, endLabels) {
        if (!source) return '';
        const escStart = startLabel.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const escEnds = endLabels.map(l => l.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
        const regex = new RegExp(escStart + '\\s*:?\\s*(.*?)\\s*(?=' + escEnds + '|$)', 'is');
        const m = source.match(regex);
        if (!m) return '';
        let val = m[1].replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
        val = val.replace(/^["']|["']$/g, '').trim();
        if (val === '.' || val === '-' || val === 'No especificado' || val === 'undefined') return '';
        return val;
    }

    getSection(text, header, nextHeaders) {
        if (!text) return '';
        const escHeader = header.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const escNext = nextHeaders.map(h => h.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
        const regex = new RegExp(escHeader + '\\s*([\\s\\S]*?)(?=' + escNext + '|$)', 'i');
        const m = text.match(regex);
        // Quitar el número de la siguiente sección (insignia "05" del diseño nuevo del PDF)
        return m ? m[1].replace(/\s+\d{2}\s*$/, '') : '';
    }

    parseOldPdfText(text) {
        const secDatos = this.getSection(text, 'DATOS GENERALES', ['ANAMNESIS', 'ACTIVIDAD FÍSICA']);
        const secAnamnesis = this.getSection(text, 'ANAMNESIS Y ANTECEDENTES CLÍNICOS', ['ACTIVIDAD FÍSICA', 'MOTIVO DE CONSULTA']);
        const secActividad = this.getSection(text, 'ACTIVIDAD FÍSICA Y ENTRENAMIENTO', ['MOTIVO DE CONSULTA', 'NOTAS ADICIONALES', 'VALORACIÓN']);
        const secMotivo = this.getSection(text, 'MOTIVO DE CONSULTA', ['NOTAS ADICIONALES', 'VALORACIÓN FISIOTERAPIA']);
        const secNotas = this.getSection(text, 'NOTAS ADICIONALES', ['VALORACIÓN FISIOTERAPIA', 'KINETIQ SPORTS']);
        const secVal = this.getSection(text, 'VALORACIÓN FISIOTERAPIA DEPORTIVA', ['KINETIQ SPORTS', '--- PÁGINA']);

        return {
            nombre: this.extractBetween(secDatos || text, 'Nombre:', ['Apellido:', 'CC:']),
            apellido: this.extractBetween(secDatos || text, 'Apellido:', ['CC:', 'Celular:']),
            cc: this.extractBetween(secDatos || text, 'CC:', ['Celular:', 'Edad:']),
            celular: this.extractBetween(secDatos || text, 'Celular:', ['Edad:', 'Sexo:']),
            edad: this.extractBetween(secDatos || text, 'Edad:', ['años', 'Sexo:']).replace(/\D/g, ''),
            sexo: this.extractBetween(secDatos || text, 'Sexo:', ['Ocupación:', 'Dominancia:', 'Peso:', 'Talla:', 'IMC:', 'Anamnesis']),
            ocupacion: this.extractBetween(secDatos || text, 'Ocupación:', ['Dominancia:', 'Peso:', 'Talla:']),
            dominancia: this.extractBetween(secDatos || text, 'Dominancia:', ['Peso:', 'Talla:']),
            peso: this.extractBetween(secDatos || text, 'Peso:', ['Kg', 'kg', 'Talla:']).replace(/[^0-9.]/g, ''),
            talla: this.extractBetween(secDatos || text, 'Talla:', ['cm', 'IMC:']).replace(/[^0-9.]/g, ''),

            localizacionDolor: this.extractBetween(secAnamnesis || text, 'Localización del dolor', ['Escala del dolor', 'Uso de aparatos']),
            escalaDolor: this.extractBetween(secAnamnesis || text, 'Escala del dolor (1 a 10)', ['/ 10', 'Uso de aparatos']).replace(/\D/g, ''),
            usoOrtesis: this.extractBetween(secAnamnesis || text, 'Uso de aparatos de órtesis', ['Suplementación', 'Antecedentes médicos']),
            suplementacionMedicamentos: this.extractBetween(secAnamnesis || text, 'Suplementación / medicamentos', ['Antecedentes médicos', 'Antecedentes quirúrgicos']),
            antecMedicos: this.extractBetween(secAnamnesis || text, 'Antecedentes médicos', ['Antecedentes quirúrgicos', 'Antecedentes de lesiones']),
            antecQuirurgicos: this.extractBetween(secAnamnesis || text, 'Antecedentes quirúrgicos', ['Antecedentes de lesiones', 'Antecedentes traumáticos']),
            antecLesiones: this.extractBetween(secAnamnesis || text, 'Antecedentes de lesiones', ['Antecedentes traumáticos', 'Antecedentes metabólicos']),
            antecTrauma: this.extractBetween(secAnamnesis || text, 'Antecedentes traumáticos', ['Antecedentes metabólicos', 'Hospitalizaciones']),
            antecMetabolico: this.extractBetween(secAnamnesis || text, 'Antecedentes metabólicos', ['Hospitalizaciones', 'Alergias']),
            hospitalizaciones: this.extractBetween(secAnamnesis || text, 'Hospitalizaciones', ['Alergias', 'ACTIVIDAD FÍSICA']),
            alergias: this.extractBetween(secAnamnesis || text, 'Alergias', ['ACTIVIDAD FÍSICA', 'MOTIVO DE CONSULTA']),

            deporte: this.extractBetween(secActividad || text, 'Deporte:', ['Tiempo:', 'Rol:']),
            tiempoDeporte: this.extractBetween(secActividad || text, 'Tiempo:', ['Rol:', 'Club:']),
            rol: this.extractBetween(secActividad || text, 'Rol:', ['Club:', 'Entrenador:']),
            club: this.extractBetween(secActividad || text, 'Club:', ['Entrenador:', 'Días entreno:']),
            entrenador: this.extractBetween(secActividad || text, 'Entrenador:', ['Días entreno:', 'Días gimnasio:']),
            diasEntrenamiento: this.extractBetween(secActividad || text, 'Días entreno:', ['días', 'Días gimnasio:']).replace(/\D/g, ''),
            diasGimnasio: this.extractBetween(secActividad || text, 'Días gimnasio:', ['días', 'Días descanso:']).replace(/\D/g, ''),
            diasDescanso: this.extractBetween(secActividad || text, 'Días descanso:', ['días', 'Tenis:']).replace(/\D/g, ''),
            tenis: this.extractBetween(secActividad || text, 'Tenis:', ['Competencia:', 'Pasado deportivo:']),
            competencia: this.extractBetween(secActividad || text, 'Competencia:', ['Pasado deportivo:', 'MOTIVO']),
            pasadoDeportivo: this.extractBetween(secActividad || text, 'Pasado deportivo:', ['MOTIVO DE CONSULTA', 'NOTAS ADICIONALES']),

            motivoConsulta: secMotivo ? secMotivo.trim() : '',
            notasAdicionales: secNotas ? secNotas.trim() : '',

            postura: this.extractBetween(secVal || text, 'Postura:', ['Marcha:', 'HODS:']),
            marcha: this.extractBetween(secVal || text, 'Marcha:', ['HODS:', 'Lunge Test:']),
            hods: this.extractBetween(secVal || text, 'HODS:', ['Lunge Test:', 'Observaciones:']),
            lunge: this.extractBetween(secVal || text, 'Lunge Test:', ['Observaciones:', 'KINETIQ SPORTS']),
            observaciones: this.extractBetween(secVal || text, 'Observaciones:', ['KINETIQ SPORTS', 'Página', '--- PÁGINA'])
        };
    }

    mostrarAdjuntosCargados() {
        if (this.adjuntos && this.adjuntos.length > 0) {
            const nombres = this.adjuntos.map(r => r.nombre).join(', ');
            document.getElementById('adjuntoNombre').textContent = nombres;
            document.getElementById('adjuntoInfo').style.display = 'block';
        } else {
        }
    }

    borrarAdjuntos() {
        // Mostrar confirmación
        if (confirm('¿Estás seguro de que deseas eliminar los archivos adjuntos?\nEsta acción se aplicará cuando guardes el reporte.')) {
            this.adjuntos = [];
            this.adjuntosEliminadosFlag = true; // Marcar que se deben eliminar de la DB
            document.getElementById('adjuntoInfo').style.display = 'none';
            document.getElementById('adjuntoNombre').textContent = '';
            const input = document.getElementById('pdfImagenInput');
            if (input) {
                input.value = '';
            }
            this.showAlert('✓ Archivos adjuntos eliminados (se quitarán al guardar)', 'success');
        } else {
            this.showAlert('Eliminación cancelada', 'info');
        }
    }

    handlePdfImagenSelect(event) {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) {
            // Limpiar si se deselecciona
            this.adjuntos = [];
            document.getElementById('adjuntoInfo').style.display = 'none';
            return;
        }

        const maxSize = Kinetiq.MAX_ADJUNTO_MB * 1024 * 1024;
        const tiposValidos = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];

        const lecturas = files.map(file => new Promise((resolve, reject) => {
            if (file.size > maxSize) {
                reject(new Error(`El archivo ${file.name} supera ${Kinetiq.MAX_ADJUNTO_MB}MB`));
                return;
            }
            if (!tiposValidos.includes(file.type)) {
                reject(new Error(`Tipo no permitido en ${file.name}`));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                resolve({
                    nombre: file.name,
                    tipo: file.type,
                    data: e.target.result // Base64
                });
            };
            reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}`));
            reader.readAsDataURL(file);
        }));

        Promise.all(lecturas)
            .then(resultados => {
                // Agregar nuevos archivos a los existentes en lugar de reemplazar
                this.adjuntos = [...this.adjuntos, ...resultados];
                this.adjuntosEliminadosFlag = false; // Reset flag al cargar nuevos archivos

                // Mostrar info de los archivos
                const nombres = this.adjuntos.map(r => r.nombre).join(', ');
                document.getElementById('adjuntoNombre').textContent = nombres;
                document.getElementById('adjuntoInfo').style.display = 'block';

                this.showAlert(`✓ ${resultados.length} archivo(s) agregado(s). Total: ${this.adjuntos.length} archivo(s)`, 'success');
            })
            .catch(error => {
                console.error('Error al procesar archivos:', error);
                this.showAlert('Error al procesar adjuntos: ' + error.message, 'error');
                event.target.value = '';
                this.adjuntos = [];
                document.getElementById('adjuntoInfo').style.display = 'none';
            });
    }

    async saveReportToDB() {
        const validationErrors = this.getValidationErrors();
        const requiredMissing = this.validateRequiredFields();
        const allEmpty = this.getAllEmptyFields();

        if (validationErrors.length > 0 || requiredMissing.length > 0 || allEmpty.length > 0) {
            this.showMissingFieldsModal(requiredMissing, allEmpty, validationErrors, () => this.showSaveConfirmModal());
            return;
        }
        this.showSaveConfirmModal();
    }

    showMissingFieldsModal(requiredMissing, allEmpty, validationErrors, onProceed) {
        const modal = document.getElementById('missingFieldsModal');
        if (!modal) return;
        const list = document.getElementById('missingFieldsList');
        const requiredSet = new Set(requiredMissing.map(l => l.toLowerCase()));
        const errorIds = new Set(validationErrors.map(e => e.id));

        const allItems = [];

        validationErrors.forEach(e => {
            if (!allEmpty.find(f => f.id === e.id)) {
                allItems.push({ label: e.label, type: 'error' });
            }
        });

        allEmpty.forEach(f => {
            const isRequired = requiredSet.has(f.label.toLowerCase());
            const hasError = errorIds.has(f.id);
            allItems.push({ label: f.label, type: hasError ? 'error' : isRequired ? 'required' : 'optional' });
        });

        list.innerHTML = allItems.map(item => {
            if (item.type === 'error') {
                return `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;margin:4px 0;border-radius:8px;background:#fff0e6;border-left:4px solid #e67e22;color:#8a4a00;font-weight:600;">❌ ${item.label} (dato inválido)</div>`;
            }
            if (item.type === 'required') {
                return `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;margin:4px 0;border-radius:8px;background:#fff5f5;border-left:4px solid #dc3545;color:#721c24;font-weight:600;">❗ ${item.label}</div>`;
            }
            return `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;margin:4px 0;border-radius:8px;background:#f8f9fa;border-left:4px solid #adb5bd;color:#495057;">• ${item.label}</div>`;
        }).join('');

        const msg = document.getElementById('missingFieldsRequiredMsg');
        const proceedBtn = document.getElementById('missingFieldsProceed');
        const closeBtn = document.getElementById('missingFieldsClose');

        const canProceed = requiredMissing.length === 0 && validationErrors.length === 0;
        if (!canProceed) {
            msg.style.display = 'block';
            proceedBtn.style.display = 'none';
        } else {
            msg.style.display = 'none';
            proceedBtn.style.display = 'inline-block';
        }

        modal.classList.add('active');

        const closer = () => {
            modal.classList.remove('active');
            // Solo resaltar en rojo los campos obligatorios de Datos Generales que falten
            this.validateRequiredFields();
        };
        closeBtn.onclick = closer;
        proceedBtn.onclick = () => { modal.classList.remove('active'); if (onProceed) onProceed(); };
        modal.onclick = (e) => { if (e.target === modal) closer(); };
    }

    showSaveConfirmModal() {
        const modal = document.getElementById('confirmModal');
        const modalContent = modal.querySelector('.modal-content');
        
        // Cambiar contenido del modal para guardar
        const modalIcon = modal.querySelector('.modal-icon');
        const modalTitle = modal.querySelector('.modal-title');
        const modalMessage = modal.querySelector('.modal-message');
        
        modalIcon.textContent = '💾';
        modalTitle.textContent = '¿Guardar Reporte?';
        modalMessage.textContent = 'Se guardarán los datos del paciente en la base de datos de forma segura.';
        
        modal.classList.add('active');
        
        // Remover listeners previos
        const modalCancel = modal.querySelector('#modalCancel');
        const modalConfirm = modal.querySelector('#modalConfirm');
        
        const newModalCancel = modalCancel.cloneNode(true);
        const newModalConfirm = modalConfirm.cloneNode(true);
        modalCancel.parentNode.replaceChild(newModalCancel, modalCancel);
        modalConfirm.parentNode.replaceChild(newModalConfirm, modalConfirm);
        
        // Cancelar
        newModalCancel.addEventListener('click', () => {
            modal.classList.remove('active');
        });
        
        // Confirmar guardado
        newModalConfirm.addEventListener('click', async () => {
            // Deshabilitar botones
            newModalConfirm.disabled = true;
            newModalCancel.disabled = true;
            
            // Mostrar loading
            document.querySelector('.modal-loading').classList.add('active');
            document.querySelector('.modal-buttons').style.display = 'none';
            
            await this.executeSaveReport();
        });
    }

    async executeSaveReport() {
        try {
            // Guardar en base de datos
            await this.guardarEnDB();
            
            // Cerrar modal
            this.resetConfirmModal();
            
            // Mostrar mensaje de éxito
            Kinetiq.descartarBorrador();
            this.showAlert('✓ Reporte guardado correctamente', 'success');
            
            // Redirigir a bienvenida después de 1.5 segundos
            setTimeout(() => {
                window.location.href = 'bienvenida.html';
            }, 1500);
        } catch (error) {
            console.error('Error en executeSaveReport:', error);
            
            // Cerrar modal
            this.resetConfirmModal();
            
            this.showAlert('Error al guardar: ' + error.message, 'error');
        }
    }

    saveReportAsJSON() {
        const nombrePaciente = document.getElementById('nombre').value.trim();
        const apellidoPaciente = document.getElementById('apellido').value.trim();

        if (!nombrePaciente) {
            this.showAlert('Por favor, ingresa un nombre', 'error');
            return;
        }

        try {
            const reportData = this.collectFormData();
            const dataStr = JSON.stringify(reportData, null, 2);
            const filename = `Reporte_${nombrePaciente}_${apellidoPaciente}_${new Date().getTime()}.json`;

            const blob = new Blob([dataStr], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            this.showAlert('✓ Reporte guardado como JSON', 'success');
        } catch (error) {
            console.error('Error en saveReportAsJSON:', error);
            this.showAlert('Error al guardar: ' + error.message, 'error');
        }
    }

    collectFormData() {
        Kinetiq.textoAMayusculas();
        const formData = {};

        document.querySelectorAll('input, select, textarea').forEach(element => {
            if (element.id && element.type !== 'file') {
                if (element.type === 'checkbox') {
                    formData[element.id] = element.checked;
                } else {
                    formData[element.id] = element.value;
                }
            }
        });

        return formData;
    }

    async guardarEnDB() {
        try {
            if (!window.supabaseClient?.supabase) {
                throw new Error('Base de datos no disponible. Revisa tu conexión e intenta de nuevo.');
            }

            const nombre = document.getElementById('nombre').value.trim();
            const apellido = document.getElementById('apellido')?.value.trim() || '';
            const cedula = document.getElementById('cc').value.trim();

            if (!cedula) {
                throw new Error('La cédula es obligatoria para guardar el reporte.');
            }

            const reporteData = this.collectFormData();

            const currentUser = await window.supabaseClient.getCurrentUser();
            const userId = currentUser?.id;
            const userEmail = currentUser?.email || sessionStorage.getItem('userEmail') || null;

            const atendidoPor = document.getElementById('atendidoPor')?.value?.trim() || null;

            const dataToSave = {
                cedula: cedula,
                nombre: nombre,
                apellido: apellido,
                atendido_por: atendidoPor,
                user_id: userId || null,
                modificado_por: userEmail,
                tipo_reporte: 'pisada',
                reporte_json: { ...reporteData, atendidoPor: atendidoPor, atendido_por: atendidoPor, modificado_por: userEmail },
                fecha_modificacion: new Date().toISOString()
            };

            if (this.adjuntos && this.adjuntos.length > 0) {
                dataToSave.archivo_adjunto = JSON.stringify(this.adjuntos);
                dataToSave.tipo_archivo_adjunto = this.adjuntos.length > 1 ? 'multiple' : this.adjuntos[0].tipo;
            } else if (this.adjuntosEliminadosFlag) {
                dataToSave.archivo_adjunto = null;
                dataToSave.tipo_archivo_adjunto = null;
            }

            // Verificar si ya existe un reporte de pisada con esta cédula
            const existente = await window.supabaseClient.getReporteByCedulaTipo(cedula, 'pisada');

            if (existente) {
                await window.supabaseClient.updateReporte(cedula, dataToSave, 'pisada');
            } else {
                dataToSave.fecha_creacion = new Date().toISOString();
                dataToSave.creado_por = userEmail;
                dataToSave.reporte_json.creado_por = userEmail;
                await window.supabaseClient.saveReporte(dataToSave);
            }
            this.adjuntosEliminadosFlag = false;

        } catch (error) {
            console.error('Error guardando en DB:', error);
            throw error;
        }
    }

    resetConfirmModal() {
        const modal = document.getElementById('confirmModal');
        if (!modal) return;
        modal.classList.remove('active');
        modal.querySelector('.modal-loading')?.classList.remove('active');
        const buttons = modal.querySelector('.modal-buttons');
        if (buttons) buttons.style.display = '';
        modal.querySelectorAll('.modal-buttons button').forEach(b => { b.disabled = false; });
    }

    async printReport() {
        const validationErrors = this.getValidationErrors();
        const requiredMissing = this.validateRequiredFields();
        const allEmpty = this.getAllEmptyFields();

        if (validationErrors.length > 0 || requiredMissing.length > 0 || allEmpty.length > 0) {
            this.showMissingFieldsModal(requiredMissing, allEmpty, validationErrors, () => this.showConfirmModal());
            return;
        }
        this.showConfirmModal();
    }

    showConfirmModal() {
        const modal = document.getElementById('confirmModal');
        const modalCancel = document.getElementById('modalCancel');
        const modalConfirm = document.getElementById('modalConfirm');

        // Restaurar textos (showSaveConfirmModal los cambia)
        modal.querySelector('.modal-icon').textContent = '📄';
        modal.querySelector('.modal-title').textContent = '¿Descargar y Guardar Reporte?';
        modal.querySelector('.modal-message').textContent = 'Se descargará el PDF y los datos del paciente se guardarán en la base de datos de forma segura.';

        modal.classList.add('active');
        
        // Remover listeners previos
        const newModalCancel = modalCancel.cloneNode(true);
        const newModalConfirm = modalConfirm.cloneNode(true);
        modalCancel.parentNode.replaceChild(newModalCancel, modalCancel);
        modalConfirm.parentNode.replaceChild(newModalConfirm, modalConfirm);
        
        // Cancelar
        newModalCancel.addEventListener('click', () => {
            modal.classList.remove('active');
        });
        
        // Confirmar
        newModalConfirm.addEventListener('click', async () => {
            // Deshabilitar botones
            newModalConfirm.disabled = true;
            newModalCancel.disabled = true;
            
            // Mostrar loading
            document.querySelector('.modal-loading').classList.add('active');
            document.querySelector('.modal-buttons').style.display = 'none';
            
            await this.generateAndSavePDF();
        });
    }

    async generateAndSavePDF() {
        const nombrePaciente = document.getElementById('nombre')?.value?.trim() || '';
        const apellidoPaciente = document.getElementById('apellido')?.value?.trim() || '';
        const nombreCompleto = `${nombrePaciente} ${apellidoPaciente}`.trim() || 'Reporte_Fisioterapia_Deportiva';
        const filename = `${nombreCompleto}.pdf`;

        try {
            if (!window.jspdf) {
                throw new Error('jsPDF no está cargado');
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
            
            await Kinetiq.pdf.cargarLogo();
            const tema = Kinetiq.pdf.preparar(doc, 'pisada');
            const primaryColor = tema.acento;
            const textDark = tema.tinta;

            let yPos = Kinetiq.pdf.encabezado(doc, {
                etiqueta: 'Valoración por',
                titulo: 'Fisioterapia Deportiva',
                paciente: `${nombrePaciente} ${apellidoPaciente}`.trim(),
                cedula: document.getElementById('cc')?.value?.trim()
            });

            // ==================== PÁGINA 1: DATOS GENERALES ====================
            this.addSectionHeader(doc, 'DATOS GENERALES', yPos, primaryColor);
            yPos += 13;

            const tableMargin = { left: 12, right: 12, bottom: 25 };

            doc.autoTable({
                startY: yPos,
                body: this.onlyFilled([
                    ['Nombre:', document.getElementById('nombre')?.value || '-', 'Apellido:', document.getElementById('apellido')?.value || '-'],
                    ['CC:', document.getElementById('cc')?.value || '-', 'Celular:', document.getElementById('celular')?.value || '-'],
                    ['Edad:', document.getElementById('edad')?.value ? document.getElementById('edad').value + ' años' : '-', 'Sexo:', document.getElementById('sexo')?.value || '-'],
                    ['Ocupación:', document.getElementById('ocupacion')?.value || '-', 'Dominancia:', document.getElementById('dominancia')?.value || '-'],
                    ['Peso:', document.getElementById('peso')?.value ? document.getElementById('peso').value + ' Kg' : '-', 'Talla:', document.getElementById('talla')?.value ? document.getElementById('talla').value + ' cm' : '-'],
                    ['IMC:', { content: document.getElementById('imc')?.value || '-', colSpan: 3 }]
                ]),
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: { top: 4.5, bottom: 4.5, left: 3.5, right: 3.5 }, textColor: textDark, lineColor: [225, 230, 238], lineWidth: 0.3 },
                headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
                alternateRowStyles: { fillColor: [247, 249, 252] },
                columnStyles: {
                    0: { fontStyle: 'bold', textColor: primaryColor, cellWidth: 28, fillColor: [240, 246, 250] },
                    1: { cellWidth: 64, fillColor: [255, 255, 255] },
                    2: { fontStyle: 'bold', textColor: primaryColor, cellWidth: 34, fillColor: [240, 246, 250] },
                    3: { cellWidth: 60, fillColor: [255, 255, 255] }
                },
                margin: tableMargin
            });

            yPos = doc.lastAutoTable.finalY + 10;

            // ANAMNESIS Y ANTECEDENTES CLÍNICOS
            let anamnesisPageBreak = false;
            const anamnesisFields = [
                'localizacionDolor', 'escalaDolor', 'usoOrtesis', 'suplementacionMedicamentos',
                'antecMedicos', 'antecQuirurgicos', 'antecLesiones', 'antecTrauma',
                'antecMetabolico', 'hospitalizaciones', 'alergias'
            ];
            if (this.hasData(anamnesisFields)) {
                this.addSectionHeader(doc, 'ANAMNESIS Y ANTECEDENTES CLÍNICOS', yPos, primaryColor);
                yPos += 14;
                const escalaVal = document.getElementById('escalaDolor')?.value;
                const items = [
                    ['Localización del dolor', document.getElementById('localizacionDolor')?.value],
                    ['Escala del dolor (1 a 10)', escalaVal ? `${escalaVal} / 10` : ''],
                    ['Uso de aparatos de órtesis', document.getElementById('usoOrtesis')?.value],
                    ['Suplementación / medicamentos', document.getElementById('suplementacionMedicamentos')?.value],
                    ['Antecedentes médicos', document.getElementById('antecMedicos')?.value],
                    ['Antecedentes quirúrgicos', document.getElementById('antecQuirurgicos')?.value],
                    ['Antecedentes de lesiones', document.getElementById('antecLesiones')?.value],
                    ['Antecedentes traumáticos', document.getElementById('antecTrauma')?.value],
                    ['Antecedentes metabólicos', document.getElementById('antecMetabolico')?.value],
                    ['Hospitalizaciones', document.getElementById('hospitalizaciones')?.value],
                    ['Alergias', document.getElementById('alergias')?.value]
                ].filter(([,v]) => v && v.trim());
                items.forEach(([label, value]) => {
                    const lines = doc.splitTextToSize(value, 170);
                    const itemHeight = 12 + lines.length * 5;
                    if (yPos + itemHeight > 270) { doc.addPage(); yPos = 20; anamnesisPageBreak = true; }
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(...primaryColor);
                    doc.text(label, 12, yPos);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(...textDark);
                    doc.text(lines, 12, yPos + 5);
                    yPos += itemHeight;
                    doc.setDrawColor(225, 230, 238);
                    doc.setLineWidth(0.3);
                    doc.line(12, yPos - 4, 198, yPos - 4);
                });
                if (anamnesisPageBreak) {
                    yPos += 3;
                }
            }

            // ==================== PÁGINA 2: ACTIVIDAD FÍSICA ====================
            const actividadFields = ['deporte','tiempoDeporte','rol','club','entrenador','diasEntrenamiento','diasGimnasio','diasDescanso','tenis','competencia','pasadoDeportivo'];
            const necesitaPagina2 = this.hasData(actividadFields) ||
                document.getElementById('motivoConsulta')?.value?.trim() ||
                document.getElementById('notasAdicionales')?.value?.trim() ||
                this.hasData(['postura','marcha','hods','lunge','observaciones']);
            if (necesitaPagina2 && yPos > 230) {
                doc.addPage();
                yPos = 20;
            }

            // ACTIVIDAD FÍSICA
            if (this.hasData(actividadFields)) {
                this.addSectionHeader(doc, 'ACTIVIDAD FÍSICA Y ENTRENAMIENTO', yPos, primaryColor);
                yPos += 11;
                doc.autoTable({
                    startY: yPos,
                    body: this.onlyFilled([
                        ['Deporte:', document.getElementById('deporte')?.value || '-', 'Tiempo:', document.getElementById('tiempoDeporte')?.value || '-'],
                        ['Rol:', document.getElementById('rol')?.value || '-', 'Club:', document.getElementById('club')?.value || '-'],
                        ['Entrenador:', document.getElementById('entrenador')?.value || '-', 'Días entreno:', (document.getElementById('diasEntrenamiento')?.value || '-') + (document.getElementById('diasEntrenamiento')?.value ? ' días' : '')],
                        ['Días gimnasio:', (document.getElementById('diasGimnasio')?.value || '-') + (document.getElementById('diasGimnasio')?.value ? ' días' : ''), 'Días descanso:', (document.getElementById('diasDescanso')?.value || '-') + (document.getElementById('diasDescanso')?.value ? ' días' : '')],
                        ['Tenis:', document.getElementById('tenis')?.value || '-', 'Competencia:', document.getElementById('competencia')?.value || '-'],
                        ['Pasado deportivo:', { content: document.getElementById('pasadoDeportivo')?.value || '-', colSpan: 3 }]
                    ]),
                    theme: 'grid',
                    styles: { fontSize: 9, cellPadding: 4, textColor: textDark, lineColor: [225, 230, 238], lineWidth: 0.3 },
                    alternateRowStyles: { fillColor: [245, 247, 250] },
                    columnStyles: {
                        0: { fontStyle: 'bold', textColor: primaryColor, cellWidth: 40, fillColor: [240, 245, 250] },
                        1: { cellWidth: 50, fillColor: [255, 255, 255] },
                        2: { fontStyle: 'bold', textColor: primaryColor, cellWidth: 40, fillColor: [240, 245, 250] },
                        3: { cellWidth: 50, fillColor: [255, 255, 255] }
                    },
                    margin: tableMargin
                });
                yPos = doc.lastAutoTable.finalY + 10;
            }

            // MOTIVO DE CONSULTA
            const motVal = document.getElementById('motivoConsulta')?.value?.trim();
            if (motVal) {
                if (yPos > 240) { doc.addPage(); yPos = 20; }
                this.addSectionHeader(doc, 'MOTIVO DE CONSULTA', yPos, primaryColor);
                yPos += 14;
                const lines = doc.splitTextToSize(motVal, 175);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(...textDark);
                doc.text(lines, 12, yPos);
                yPos += lines.length * 5 + 14;
            }

            // NOTAS ADICIONALES
            const notasVal = document.getElementById('notasAdicionales')?.value?.trim();
            if (notasVal) {
                if (yPos > 240) { doc.addPage(); yPos = 20; }
                this.addSectionHeader(doc, 'NOTAS ADICIONALES', yPos, primaryColor);
                yPos += 14;
                const lines = doc.splitTextToSize(notasVal, 175);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(...textDark);
                doc.text(lines, 12, yPos);
                yPos += lines.length * 5 + 14;
            }

            // VALORACIÓN FISIOTERAPIA DEPORTIVA
            if (this.hasData(['postura','marcha','hods','lunge','observaciones'])) {
                if (yPos > 240) { doc.addPage(); yPos = 20; }
                this.addSectionHeader(doc, 'VALORACIÓN FISIOTERAPIA DEPORTIVA', yPos, primaryColor);
                yPos += 11;
                doc.autoTable({
                    startY: yPos,
                    body: this.onlyFilled([
                        ['Postura:', document.getElementById('postura')?.value || '-'],
                        ['Marcha:', document.getElementById('marcha')?.value || '-'],
                        ['HODS:', document.getElementById('hods')?.value || '-'],
                        ['Lunge Test:', document.getElementById('lunge')?.value || '-'],
                        ['Observaciones:', document.getElementById('observaciones')?.value || '-']
                    ]),
                    theme: 'grid',
                    styles: { fontSize: 9, cellPadding: 4, textColor: textDark, lineColor: [225, 230, 238], lineWidth: 0.3 },
                    alternateRowStyles: { fillColor: [245, 247, 250] },
                    columnStyles: {
                        0: { fontStyle: 'bold', textColor: primaryColor, cellWidth: 40, fillColor: [240, 245, 250] },
                        1: { cellWidth: 140, fillColor: [255, 255, 255] }
                    },
                    margin: tableMargin
                });
                yPos = doc.lastAutoTable.finalY + 10;
            }

            // Agregar imágenes adjuntas como nuevas páginas
            if (this.adjuntos && this.adjuntos.length > 0) {
                const imagenes = this.adjuntos.filter(a => a.tipo.startsWith('image/'));
                for (const imagen of imagenes) {
                    await this.agregarArchivoAlPDF(doc, imagen);
                }
            }

            Kinetiq.pdf.pie(doc, 'Valoración por fisioterapia deportiva', nombreCompleto, document.getElementById('atendidoPor')?.value || '');

            // Exportar a bytes
            let pdfBytes = doc.output('arraybuffer');

            // Procesar con PDFLib: unir PDFs adjuntos e incrustar copia digital de seguridad
            try {
                if (window.PDFLib) {
                    const { PDFDocument } = window.PDFLib;
                    const mainDoc = await PDFDocument.load(pdfBytes);

                    if (this.adjuntos && this.adjuntos.some(a => a.tipo === 'application/pdf')) {
                        const pdfAdjuntos = this.adjuntos.filter(a => a.tipo === 'application/pdf');
                        for (const adj of pdfAdjuntos) {
                            const base64Data = adj.data.split(',')[1];
                            const attachmentBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                            const attachDoc = await PDFDocument.load(attachmentBytes);
                            const pages = await mainDoc.copyPages(attachDoc, attachDoc.getPageIndices());
                            pages.forEach(p => mainDoc.addPage(p));
                        }
                    }

                    // Sólo una referencia al registro (sin datos clínicos): este PDF se entrega al paciente
                    const cedulaRef = document.getElementById('cc')?.value?.trim() || '';
                    mainDoc.setSubject('KINETIQ_REF:' + JSON.stringify({ cc: cedulaRef, tipo: 'pisada' }));
                    mainDoc.setTitle(filename);

                    pdfBytes = await mainDoc.save();
                }
            } catch (pdfLibErr) {
                console.warn('Advertencia procesando PDF con PDFLib:', pdfLibErr);
            }

            // Descargar el PDF resultante
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            // Guardar en base de datos de forma segura
            let dbSuccess = false;
            try {
                await this.guardarEnDB();
                dbSuccess = true;
            } catch (dbErr) {
                console.error('Error guardando en base de datos al descargar PDF:', dbErr);
            }
            
            // Cerrar modal
            this.resetConfirmModal();
            
            if (dbSuccess) {
                this.showAlert('✓ PDF descargado y guardado en base de datos correctamente', 'success');
                setTimeout(() => {
                    window.location.href = 'bienvenida.html';
                }, 2000);
            } else {
                Kinetiq.descargarRespaldoJSON(this.collectFormData(), nombreCompleto);
                this.showAlert('⚠️ El PDF se descargó, pero NO se pudo guardar en la base de datos. Se descargó un respaldo .json: cárgalo con el botón "Cargar" y presiona "Guardar" cuando vuelva la conexión.', 'error');
            }

        } catch (error) {
            console.error('Error en generateAndSavePDF:', error);
            
            // Cerrar modal
            this.resetConfirmModal();
            
            this.showAlert('Error al generar PDF: ' + error.message, 'error');
        }
    }

    addSectionHeader(doc, title, yPos) {
        Kinetiq.pdf.seccion(doc, title, yPos);
    }

    onlyFilled(rows) {
        return rows.filter(row =>
            row.some((cell, i) => {
                if (i % 2 !== 1 || !cell) return false;
                const val = (typeof cell === 'object' && cell !== null && cell.content !== undefined) ? cell.content : cell;
                return val && val !== '-' && val.toString().trim() !== '';
            })
        );
    }

    hasData(ids) {
        return ids.some(id => {
            const el = document.getElementById(id);
            return el && el.value && el.value.trim() !== '';
        });
    }

    async agregarArchivoAlPDF(doc, adjunto) {
        try {
            if (!adjunto?.tipo || !adjunto.tipo.startsWith('image/')) {
                // Solo manejamos imágenes aquí; PDFs se mergean con pdf-lib en otro paso
                return;
            }

            doc.addPage();
            
            Kinetiq.pdf.anexo(doc, adjunto.nombre);
            let yPos = 34;
            
            // Agregar la imagen
            const img = new Image();
            img.src = adjunto.data;

            await new Promise((resolve) => {
                img.onload = () => {
                    const maxWidth = 180; // mm
                    const maxHeight = 200; // mm
                    let { width, height } = img;

                    if (width > height) {
                        if (width > maxWidth) {
                            height = (height * maxWidth) / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = (width * maxHeight) / height;
                            height = maxHeight;
                        }
                    }

                    const xPos = (210 - width) / 2;
                    doc.addImage(adjunto.data, adjunto.tipo.split('/')[1].toUpperCase(), xPos, yPos, width, height);
                    resolve();
                };
            });
        } catch (error) {
            console.error('Error al agregar archivo adjunto:', error);
        }
    }

    buscarPacienteExistente() {
        const modal = document.getElementById('searchModal');
        const input = document.getElementById('searchPatientInput');
        const results = document.getElementById('searchResults');
        const cancel = document.getElementById('searchCancel');
        const loading = document.getElementById('searchLoading');

        if (!modal) return;

        input.value = '';
        results.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 20px;">Escribe para buscar pacientes...</p>';
        modal.classList.add('active');

        let searchTimeout;
        const handleInput = () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.searchPatients(input.value.trim()), 300);
        };

        const handleResultClick = (e) => {
            const card = e.target.closest('[data-paciente]');
            if (card) {
                try {
                    const raw = card.getAttribute('data-paciente');
                    if (!raw) return;
                    const reporte = JSON.parse(raw);
                    this.prefillFromPaciente(reporte);
                    modal.classList.remove('active');
                    this.cleanupSearchListeners();
                } catch (err) {
                    console.error('Error al cargar paciente:', err);
                }
            }
        };

        const closeModal = () => {
            modal.classList.remove('active');
            this.cleanupSearchListeners();
        };

        this._searchListeners = [
            { el: input, type: 'input', fn: handleInput },
            { el: results, type: 'click', fn: handleResultClick },
            { el: cancel, type: 'click', fn: closeModal },
            { el: modal, type: 'click', fn: (e) => { if (e.target === modal) closeModal(); } }
        ];

        this._searchListeners.forEach(({ el, type, fn }) => el.addEventListener(type, fn));
        setTimeout(() => input.focus(), 100);
    }

    cleanupSearchListeners() {
        if (this._searchListeners) {
            this._searchListeners.forEach(({ el, type, fn }) => el.removeEventListener(type, fn));
            this._searchListeners = null;
        }
    }

    async searchPatients(query) {
        const results = document.getElementById('searchResults');
        const loading = document.getElementById('searchLoading');

        if (!query || query.length < 2) {
            results.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 20px;">Escribe al menos 2 caracteres...</p>';
            return;
        }

        if (!window.supabaseClient?.supabase) {
            results.innerHTML = '<p style="color: #e74c3c; text-align: center; padding: 20px;">⚠️ Base de datos no disponible</p>';
            return;
        }

        const q = Kinetiq.sanitizeSearch(query);
        if (q.length < 2) {
            results.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 20px;">Escribe al menos 2 caracteres válidos...</p>';
            return;
        }

        loading.style.display = 'block';
        results.innerHTML = '';

        // Varias palabras ("laura gomez"): se busca la más larga y luego se exige que estén todas
        const palabras = q.split(' ').filter(Boolean);
        const principal = palabras.reduce((a, b) => (b.length > a.length ? b : a), '');
        // Vocales como comodín (_): encuentra "valentina" aunque esté guardado "Valentína" y viceversa
        const patron = Kinetiq.normalizar(principal).replace(/[aeiou]/g, '_');

        try {
            const { data: crudos, error } = await window.supabaseClient.supabase
                .from('reportes')
                .select('cedula, nombre, apellido, tipo_reporte, reporte_json, fecha_modificacion')
                .or(`nombre.ilike.%${patron}%,apellido.ilike.%${patron}%,cedula.ilike.%${principal}%`)
                .order('fecha_modificacion', { ascending: false })
                .limit(100);

            if (error) throw error;
            const data = (crudos || []).filter(r => {
                const texto = Kinetiq.normalizar(`${r.nombre || ''} ${r.apellido || ''} ${r.cedula || ''} ${r.reporte_json?.nombre || ''} ${r.reporte_json?.apellido || ''}`);
                return palabras.every(p => texto.includes(Kinetiq.normalizar(p)));
            });

            loading.style.display = 'none';

            if (!data || data.length === 0) {
                results.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 20px;">No se encontraron pacientes</p>';
                return;
            }

            this.renderSearchResults(data);
        } catch (error) {
            loading.style.display = 'none';
            results.innerHTML = `<p style="color: #e74c3c; text-align: center; padding: 20px;">Error: ${Kinetiq.escapeHtml(error.message)}</p>`;
        }
    }

    renderSearchResults(data) {
        const results = document.getElementById('searchResults');

        const grouped = new Map();
        data.forEach(r => {
            const key = r.cedula || `${r.nombre}_${r.apellido}`;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(r);
        });

        results.innerHTML = `<p style="color: #7f8c8d; margin-bottom: 10px; font-size: 13px;">${grouped.size} paciente(s) encontrado(s)</p>`;

        grouped.forEach((records, key) => {
            const first = records[0];
            const datos = first.reporte_json || {};
            const tipos = [...new Set(records.map(r => r.tipo_reporte || 'pisada'))];

            const card = document.createElement('div');
            card.style.cssText = 'padding: 14px; border: 1px solid #e0e4e8; border-radius: 8px; margin-bottom: 8px; background: #f8fafc; cursor: pointer; transition: box-shadow 0.2s, border-color 0.2s;';
            card.addEventListener('mouseenter', () => { card.style.borderColor = '#0A94B0'; card.style.boxShadow = '0 2px 8px rgba(10,148,176,0.15)'; });
            card.addEventListener('mouseleave', () => { card.style.borderColor = '#e0e4e8'; card.style.boxShadow = 'none'; });

            const pacienteData = JSON.stringify(first);
            card.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                try {
                    const reporte = JSON.parse(pacienteData);
                    this.prefillFromPaciente(reporte);
                    document.getElementById('searchModal').classList.remove('active');
                    this.cleanupSearchListeners();
                } catch (err) {
                    console.error('Error al cargar paciente:', err);
                }
            });

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="font-size: 15px; color: #0A94B0;">${Kinetiq.escapeHtml(datos.nombre || first.nombre || 'Sin nombre')} ${Kinetiq.escapeHtml(datos.apellido || first.apellido || '')}</strong>
                        <div style="font-size: 12px; color: #95a5a6; margin-top: 2px;">CC: ${Kinetiq.escapeHtml(first.cedula || '-')} — Click para cargar datos en este formulario</div>
                    </div>
                    <div class="search-result-actions" style="display:flex;align-items:center;gap:8px;"></div>
                </div>
            `;

            const actions = card.querySelector('.search-result-actions');
            tipos.forEach(tipo => {
                const report = records.find(r => (r.tipo_reporte || 'pisada') === tipo);
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = tipo === 'piso_pelvico' ? '\u{1FA80} Ver Pélvico' : '\u{1F463} Ver Pisada';
                btn.style.cssText = `padding:8px 16px;background:${tipo === 'piso_pelvico' ? '#087D94' : '#0A94B0'};color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;margin-left:6px;`;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    sessionStorage.setItem('reportToLoad', JSON.stringify(report.reporte_json || {}));
                    window.location.href = tipo === 'piso_pelvico' ? 'reporte-piso-pelvico.html' : 'index.html';
                });
                actions.appendChild(btn);
            });
            results.appendChild(card);
        });
    }

    prefillFromPaciente(paciente) {
        const datos = paciente.reporte_json || {};

        if (datos.nombre) { document.getElementById('nombre').value = datos.nombre; }
        if (datos.apellido) { document.getElementById('apellido').value = datos.apellido; }
        this.updateHeaderPatient();
        if (datos.edad) document.getElementById('edad').value = datos.edad;
        if (datos.sexo) document.getElementById('sexo').value = datos.sexo;
        if (datos.peso) document.getElementById('peso').value = datos.peso;
        if (datos.talla) document.getElementById('talla').value = datos.talla;
        if (datos.celular) document.getElementById('celular').value = datos.celular;
        if (datos.cc) document.getElementById('cc').value = datos.cc;
        if (datos.ocupacion) document.getElementById('ocupacion').value = datos.ocupacion;
        // Sexo se muestra con botones: avisar el cambio para que se marquen
        document.getElementById('sexo')?.dispatchEvent(new Event('change', { bubbles: true }));

        document.querySelectorAll('.form-control').forEach(el => {
            if (el.value.trim()) {
                el.classList.add('field-filled');
            }
        });

        this.calculateIMC();
        this.showAlert(`✓ Datos de ${datos.nombre || ''} precargados`, 'success');
    }

    showAlert(message, type = 'info') {
        const existing = document.querySelector('.alert');
        if (existing) existing.remove();

        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} show`;
        alertDiv.textContent = message;
        
        document.body.insertBefore(alertDiv, document.body.firstChild);

        setTimeout(() => {
            alertDiv.style.opacity = '0';
            alertDiv.style.transition = 'opacity 0.3s ease';
            setTimeout(() => alertDiv.remove(), 300);
        }, type === 'error' || type === 'warning' ? 8000 : 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const abriendoReporte = !!sessionStorage.getItem('reportToLoad');
    window.reporte = new ReporteMedico();
    Kinetiq.initBorrador(window.reporte, 'pisada', abriendoReporte);
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReporteMedico;
}
