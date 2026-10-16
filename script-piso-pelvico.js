class ReportePisoPelvico {
    constructor() {
        try {
            this.form = document.getElementById('reportForm');
            this.pesoInput = document.getElementById('peso');
            this.tallaInput = document.getElementById('talla');
            this.imcInput = document.getElementById('imc');
            this.reportDateElement = document.getElementById('reportDate');
            this.tipoReporte = 'piso_pelvico';

            this.adjuntos = [];
            this.adjuntosEliminadosFlag = false;

            if (!this.form) {
                console.error('Elementos del formulario no encontrados');
                return;
            }

            this.init();
        } catch (error) {
            console.error('Error en constructor:', error);
        }
    }

    init() {
        this.setupEventListeners();
        this.setReportDate();
        this.calculateIMC();
        this.waitForSupabaseAndLoadReferidos();
        this.checkImportedDataFromStorage();
    }

    waitForSupabaseAndLoadReferidos(attempts = 0) {
        if (window.supabaseClient) {
            this.loadReferidos().then(() => {
                if (this._pendingReferidoValue) {
                    const select = document.getElementById('referidoSeleccionado');
                    if (select) {
                        select.value = this._pendingReferidoValue;
                        this._pendingReferidoValue = null;
                    }
                }
            });
        } else if (attempts < 50) {
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
                    <strong style="color: #0A94B0;">${r.nombre}</strong>
                    ${r.contacto ? `<div style="font-size: 12px; color: #95a5a6;">${r.contacto}</div>` : ''}
                </div>
                <button type="button" data-referido-id="${r.id}" class="btn-delete-referido" style="padding: 6px 12px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">🗑️ Eliminar</button>
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
        const adjuntosToLoad = sessionStorage.getItem('adjuntosToLoad');

        if (adjuntosToLoad) {
            try {
                this.adjuntos = JSON.parse(adjuntosToLoad);
                this.mostrarAdjuntosCargados();
            } catch (err) {
                console.error('Error parseando adjuntos:', err);
            }
            sessionStorage.removeItem('adjuntosToLoad');
        }

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
            } catch (error) {
                console.error('Error cargando reporte:', error);
                this.showAlert('Error al cargar el reporte: ' + error.message, 'error');
                sessionStorage.removeItem('reportToLoad'); // Limpiar basura
            }
        }
    }

    loadDataFromObject(data) {
        Object.keys(data).forEach(key => {
            if (key === 'checkboxGroups' || key === 'radioGroups') return;

            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = Boolean(data[key]);
                } else if (key === 'referidoSeleccionado') {
                    this._pendingReferidoValue = data[key];
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

        if (data.checkboxGroups) {
            Object.keys(data.checkboxGroups).forEach(groupName => {
                const values = data.checkboxGroups[groupName] || [];
                values.forEach(val => {
                    const inputs = document.querySelectorAll(`input[name="${groupName}"]`);
                    inputs.forEach(input => {
                        if (input.value === val) input.checked = true;
                    });
                });
            });
        }

        if (data.radioGroups) {
            Object.keys(data.radioGroups).forEach(groupName => {
                const value = data.radioGroups[groupName];
                if (value) {
                    const inputs = document.querySelectorAll(`input[name="${groupName}"]`);
                    inputs.forEach(input => {
                        if (input.value === value || input.value.toLowerCase() === String(value).toLowerCase()) {
                            input.checked = true;
                        }
                    });
                }
            });
        }

        this.calculateIMC();
        
        // Trigger the comoNosConociste change handler to show/hide appropriate containers
        const comoNosConociste = document.getElementById('comoNosConociste');
        if (comoNosConociste && comoNosConociste.value) {
            this.handleComoNosConocisteChange(comoNosConociste.value);
        }
    }

    collectFormData() {
        const formData = {};

        document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), select, textarea').forEach(element => {
            if (element.id && element.id !== 'fileInput' && element.id !== 'pdfImagenInput') {
                formData[element.id] = element.value;
            }
        });

        document.querySelectorAll('input[type="checkbox"]').forEach(element => {
            if (element.id && !element.name) {
                formData[element.id] = element.checked;
            }
        });

        const checkboxGroups = {};
        document.querySelectorAll('input[type="checkbox"][name]').forEach(input => {
            if (!checkboxGroups[input.name]) checkboxGroups[input.name] = [];
            if (input.checked) checkboxGroups[input.name].push(input.value);
        });
        Object.keys(checkboxGroups).forEach(key => {
            if (checkboxGroups[key].length === 0) delete checkboxGroups[key];
        });
        formData.checkboxGroups = checkboxGroups;

        const radioGroups = {};
        document.querySelectorAll('input[type="radio"][name]').forEach(input => {
            if (input.checked) radioGroups[input.name] = input.value;
        });
        formData.radioGroups = radioGroups;

        return formData;
    }

    getRequiredFields() {
        return [
            { id: 'nombre', label: 'Nombre' },
            { id: 'apellido', label: 'Apellido' },
            { id: 'cc', label: 'Cédula' },
            { id: 'comoNosConociste', label: '¿Cómo nos conociste?' }
        ];
    }

    initFieldTracking() {
        document.querySelectorAll('input.form-control, textarea.form-control').forEach(el => {
            el.addEventListener('input', () => {
                if (el.value.trim()) {
                    el.classList.remove('field-missing');
                    el.classList.add('field-filled');
                } else {
                    el.classList.remove('field-filled');
                }
            });
            if (el.value.trim()) el.classList.add('field-filled');
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
        document.querySelectorAll('.form-control').forEach(el => {
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
        this.initFieldTracking();

        const nombreInput = document.getElementById('nombre');
        const apellidoInput = document.getElementById('apellido');
        const edadInput = document.getElementById('edad');
        const ccInput = document.getElementById('cc');
        const celularInput = document.getElementById('celular');

        if (nombreInput) nombreInput.addEventListener('input', () => { this.validateNombre(); this.updateHeaderPatient(); });
        if (apellidoInput) apellidoInput.addEventListener('input', () => { this.validateApellido(); this.updateHeaderPatient(); });
        if (edadInput) edadInput.addEventListener('input', () => { this.restrictToNumbers(edadInput); this.validateEdad(); });
        if (ccInput) {
            ccInput.addEventListener('input', () => { this.restrictToNumbers(ccInput); this.validateCC(); });
            ccInput.addEventListener('blur', () => {
                const cedula = ccInput.value.trim();
                if (cedula.length < 6 || !window.supabaseClient?.supabase) return;
                window.supabaseClient.supabase.from('reportes').select('*').eq('cedula', cedula).then(({ data }) => {
                    if (!data || data.length === 0) return;
                    if (confirm('Este paciente ya está registrado. ¿Desea cargar sus datos automáticamente?')) {
                        this.prefillFromPaciente(data[0]);
                        this.showAlert('✔ Datos cargados correctamente', 'success');
                    }
                }).catch(() => {});
            });
        }
        if (celularInput) celularInput.addEventListener('input', () => { this.restrictToNumbers(celularInput); this.validateCelular(); });

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

        if (this.pesoInput) {
            this.pesoInput.addEventListener('input', () => {
                this.restrictToNumbers(this.pesoInput, true);
                this.validatePeso();
                this.calculateIMC();
            });
        }
        if (this.tallaInput) {
            this.tallaInput.addEventListener('input', () => {
                this.restrictToNumbers(this.tallaInput, true);
                this.validateTalla();
                this.calculateIMC();
            });
        }

        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (event) => this.handleFileSelect(event));
        }

        const loadFileBtn = document.getElementById('loadFileBtn');
        if (loadFileBtn) {
            loadFileBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.loadFile();
            });
        }

        const pdfImagenInput = document.getElementById('pdfImagenInput');
        if (pdfImagenInput) {
            pdfImagenInput.addEventListener('change', (e) => this.handlePdfImagenSelect(e));
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

        const borrarAdjuntoBtn = document.getElementById('borrarAdjuntoBtn');
        if (borrarAdjuntoBtn) {
            borrarAdjuntoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.borrarAdjuntos();
            });
        }

        const cleanBtns = document.querySelectorAll('.floating-sidebar button[type="reset"]');
        cleanBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.form) this.form.reset();
                document.querySelectorAll('.field-filled, .field-missing').forEach(el => {
                    el.classList.remove('field-filled', 'field-missing');
                });
                this.adjuntos = [];
                const inp = document.getElementById('pdfImagenInput');
                if (inp) inp.value = '';
                const info = document.getElementById('adjuntoInfo');
                if (info) info.style.display = 'none';
                this.setReportDate();
                this.showAlert('✓ Formulario limpiado correctamente', 'success');
            });
        });

        const checkPatientBtn = document.getElementById('checkPatientBtn');
        if (checkPatientBtn) {
            checkPatientBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.buscarPacienteExistente();
            });
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

        loading.style.display = 'block';
        results.innerHTML = '';

        try {
            const { data, error } = await window.supabaseClient.supabase
                .from('reportes')
                .select('cedula, nombre, apellido, tipo_reporte, reporte_json, fecha_modificacion')
                .or(`nombre.ilike.%${query}%,apellido.ilike.%${query}%,cedula.ilike.%${query}%`)
                .order('fecha_modificacion', { ascending: false });

            if (error) throw error;

            loading.style.display = 'none';

            if (!data || data.length === 0) {
                results.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 20px;">No se encontraron pacientes</p>';
                return;
            }

            this.renderSearchResults(data);
        } catch (error) {
            loading.style.display = 'none';
            results.innerHTML = `<p style="color: #e74c3c; text-align: center; padding: 20px;">Error: ${error.message}</p>`;
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

            let buttonsHtml = '';
            tipos.forEach(tipo => {
                const report = records.find(r => (r.tipo_reporte || 'pisada') === tipo);
                const label = tipo === 'piso_pelvico' ? '\u{1FA80} Ver P\u00E9lvico' : '\u{1F463} Ver Pisada';
                const bg = tipo === 'piso_pelvico' ? '#087D94' : '#0A94B0';
                const target = tipo === 'piso_pelvico' ? 'reporte-piso-pelvico.html' : 'index.html';
                buttonsHtml += `<button onclick="event.stopPropagation();(function(){
                    var r = ${JSON.stringify(report).replace(/<\/script>/gi, '<\\/script>')};
                    sessionStorage.setItem('reportToLoad',JSON.stringify(r.reporte_json));
                    if(r.adjuntos) sessionStorage.setItem('adjuntosToLoad',JSON.stringify(r.adjuntos));
                    window.location.href='${target}';
                })()" style="padding:8px 16px;background:${bg};color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;margin-left:6px;">${label}</button>`;
            });

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="font-size: 15px; color: #0A94B0;">${datos.nombre || first.nombre || 'Sin nombre'} ${datos.apellido || first.apellido || ''}</strong>
                        <div style="font-size: 12px; color: #95a5a6; margin-top: 2px;">CC: ${first.cedula || '-'} — Click para cargar datos en este formulario</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        ${buttonsHtml}
                    </div>
                </div>
            `;
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

        document.querySelectorAll('.form-control').forEach(el => {
            if (el.value.trim()) {
                el.classList.add('field-filled');
            }
        });

        this.calculateIMC();
        this.showAlert(`✓ Datos de ${datos.nombre || ''} precargados`, 'success');
    }

    calculateIMC() {
        const peso = parseFloat(this.pesoInput?.value) || 0;
        const talla = parseFloat(this.tallaInput?.value) || 0;
        if (peso > 0 && talla > 0) {
            const talla_m = talla / 100;
            this.imcInput.value = (peso / (talla_m * talla_m)).toFixed(1);
        } else {
            this.imcInput.value = '';
        }
    }

    restrictToNumbers(input, allowDecimals = false) {
        let value = input.value;
        if (allowDecimals) {
            value = value.replace(/[^\d.]/g, '');
            const parts = value.split('.');
            if (parts.length > 2) value = parts[0] + '.' + parts.slice(1).join('');
        } else {
            value = value.replace(/\D/g, '');
        }
        input.value = value;
    }

    validateNombre() {
        const input = document.getElementById('nombre');
        const value = input.value.trim();
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

    showFieldError(input, message) {
        this.clearFieldError(input);
        input.classList.add('input-error');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.id = `error-${input.id}`;
        input.parentNode.insertBefore(errorDiv, input.nextSibling);
    }

    clearFieldError(input) {
        input.classList.remove('input-error');
        const errorMsg = document.getElementById(`error-${input.id}`);
        if (errorMsg) errorMsg.remove();
    }

    setReportDate() {
        const today = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        this.reportDateElement.textContent = today.toLocaleDateString('es-ES', options);
        this.updateHeaderPatient();
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
            fileInput.value = '';
            fileInput.click();
        }
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Límite de seguridad: máximo 15MB por archivo para evitar sobrecarga de memoria
        const MAX_SIZE = 15 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            this.showAlert('El archivo supera el tamaño máximo permitido (15 MB).', 'error');
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

                // 1. Intentar leer copia de seguridad digital embebida (PDFs recientes)
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
                    this.showAlert('✓ ¡Paciente de piso pélvico cargado desde el PDF! Se recuperaron los datos del documento. Revisa los campos y presiona "Guardar".', 'success');
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
        return m ? m[1] : '';
    }

    parseOldPdfText(text) {
        const secDatos = this.getSection(text, 'DATOS GENERALES', ['ANAMNESIS', 'ANTECEDENTES OCUPACIONALES']);
        const secAnamnesis = this.getSection(text, 'ANAMNESIS', ['ANTECEDENTES OCUPACIONALES', 'DINÁMICA MICCIONAL']);
        const secOcup = this.getSection(text, 'ANTECEDENTES OCUPACIONALES', ['DINÁMICA MICCIONAL', 'DINÁMICA DEFECATORIA']);
        const secMiccional = this.getSection(text, 'DINÁMICA MICCIONAL', ['DINÁMICA DEFECATORIA', 'DINÁMICA OBSTETRA']);
        const secDef = this.getSection(text, 'DINÁMICA DEFECATORIA', ['DINÁMICA OBSTETRA', 'DINÁMICA MENSTRUAL', 'ESTADO DEL PACIENTE']);
        const secObst = this.getSection(text, 'DINÁMICA OBSTETRA', ['DINÁMICA MENSTRUAL', 'DINÁMICA SEXUAL', 'ESTADO DEL PACIENTE']);
        const secMenstr = this.getSection(text, 'DINÁMICA MENSTRUAL', ['DINÁMICA SEXUAL', 'ESTADO DEL PACIENTE', 'GENITOURINARIO']);
        const secSexual = this.getSection(text, 'DINÁMICA SEXUAL', ['ESTADO DEL PACIENTE', 'GENITOURINARIO', 'DESARROLLO DE LA ACTIVIDAD']);
        const secEstado = this.getSection(text, 'ESTADO DEL PACIENTE', ['GENITOURINARIO', 'DESARROLLO DE LA ACTIVIDAD']);
        const secGenito = this.getSection(text, 'GENITOURINARIO', ['DESARROLLO DE LA ACTIVIDAD', 'NOTAS DE ANÁLISIS Y PLAN']);
        const secDesarrollo = this.getSection(text, 'DESARROLLO DE LA ACTIVIDAD', ['NOTAS DE ANÁLISIS Y PLAN', 'OBJETIVOS']);
        const secNotas = this.getSection(text, 'NOTAS DE ANÁLISIS Y PLAN', ['OBJETIVOS', 'ATENCIÓN EN MÓDULO']);
        const secObj = this.getSection(text, 'OBJETIVOS', ['ATENCIÓN EN MÓDULO', 'RECOMENDACIONES']);
        const secAtencion = this.getSection(text, 'ATENCIÓN EN MÓDULO DE PISO PÉLVICO', ['RECOMENDACIONES', 'SIGNOS DE ALARMA']);
        const secRecom = this.getSection(text, 'RECOMENDACIONES', ['SIGNOS DE ALARMA', 'KINETIQ SPORTS']);
        const secSignos = this.getSection(text, 'SIGNOS DE ALARMA', ['KINETIQ SPORTS', '--- PÁGINA']);

        return {
            nombre: this.extractBetween(secDatos || text, 'Nombre:', ['Apellido:', 'CC:']),
            apellido: this.extractBetween(secDatos || text, 'Apellido:', ['CC:', 'Celular:']),
            cc: this.extractBetween(secDatos || text, 'CC:', ['Celular:', 'Edad:']),
            celular: this.extractBetween(secDatos || text, 'Celular:', ['Edad:', 'Sexo:']),
            edad: this.extractBetween(secDatos || text, 'Edad:', ['años', 'Sexo:']).replace(/\D/g, ''),
            sexo: this.extractBetween(secDatos || text, 'Sexo:', ['Ocupación:', 'Peso:']),
            ocupacion: this.extractBetween(secDatos || text, 'Ocupación:', ['Peso:', 'Talla:']),
            peso: this.extractBetween(secDatos || text, 'Peso:', ['Kg', 'kg', 'Talla:']).replace(/[^0-9.]/g, ''),
            talla: this.extractBetween(secDatos || text, 'Talla:', ['cm', 'IMC:']).replace(/[^0-9.]/g, ''),
            
            acompanante: this.extractBetween(secAnamnesis || text, 'Paciente ingresa en compañía de:', ['Dx médico:', 'Refiere dolor']),
            dxMedico: this.extractBetween(secAnamnesis || text, 'Dx médico:', ['Refiere dolor / molestia:', 'Especialista']),
            refiereDolor: this.extractBetween(secAnamnesis || text, 'Refiere dolor / molestia:', ['Especialista que remite:', 'Ciclo de terapia:']),
            especialistaRemite: this.extractBetween(secAnamnesis || text, 'Especialista que remite:', ['Ciclo de terapia:', 'Medicamentos:']),
            cicloTerapia: this.extractBetween(secAnamnesis || text, 'Ciclo de terapia:', ['Medicamentos:', 'Exámenes:']),
            medicamentos: this.extractBetween(secAnamnesis || text, 'Medicamentos:', ['Exámenes:', 'Barreras:', 'Expectativa']),
            examenes: this.extractBetween(secAnamnesis || text, 'Exámenes:', ['Barreras:', 'Facilitadores:', 'Expectativa']),
            expectativaPaciente: this.extractBetween(secAnamnesis || text, 'Expectativa del paciente:', ['ANTECEDENTES OCUPACIONALES', 'DINÁMICA']),

            desempenoLaboral: this.extractBetween(secOcup || text, 'Ocupación:', ['Tipo trabajo:', 'Puesto ergonómico']),
            tipoTrabajo: this.extractBetween(secOcup || text, 'Tipo trabajo:', ['Puesto ergonómico:', 'Pausas activas:']),
            puestoErgonomico: this.extractBetween(secOcup || text, 'Puesto ergonómico:', ['Pausas activas:', 'Actividad física:']),
            pausasActivas: this.extractBetween(secOcup || text, 'Pausas activas:', ['Actividad física:', 'Cigarrillo:']),
            actividadFisicaLaboral: this.extractBetween(secOcup || text, 'Actividad física:', ['Cigarrillo:', 'Alcohol:']),
            consumoCigarrillo: this.extractBetween(secOcup || text, 'Cigarrillo:', ['Alcohol:', 'Hábitos']),
            consumoAlcohol: this.extractBetween(secOcup || text, 'Alcohol:', ['Hábitos alimenticios:', 'DINÁMICA']),

            usoProtector: this.extractBetween(secMiccional || text, 'Protector:', ['Ropa interior:', 'Micciones día:']),
            tipoRopaInterior: this.extractBetween(secMiccional || text, 'Ropa interior:', ['Micciones día:', 'Micciones noche:']),
            miccionesDia: this.extractBetween(secMiccional || text, 'Micciones día:', ['Micciones noche:', 'Deseo miccional:']),
            miccionesNoche: this.extractBetween(secMiccional || text, 'Micciones noche:', ['Deseo miccional:', 'Dificultad:', 'Postura:']),
            dificultadMiccional: this.extractBetween(secMiccional || text, 'Dificultad:', ['Mapa de dolor:', 'DINÁMICA DEFECATORIA']),

            defecacionesDia: this.extractBetween(secDef || text, 'Def. día:', ['Def. noche:', 'Deseo def.:']),
            defecacionesNoche: this.extractBetween(secDef || text, 'Def. noche:', ['Deseo def.:', 'Postura:']),
            vaciadoIncompleto: this.extractBetween(secDef || text, 'Vaciado incompleto:', ['Cierra ano:', 'Escala Bristol:']),
            cierraAno: this.extractBetween(secDef || text, 'Cierra ano:', ['Escala Bristol:', 'Gases:']),
            escalaBristol: this.extractBetween(secDef || text, 'Escala Bristol:', ['Gases:', 'Tipo dolor:']),
            gases: this.extractBetween(secDef || text, 'Gases:', ['Tipo dolor:', 'DINÁMICA OBSTETRA']),

            numEmbarazos: this.extractBetween(secObst || text, 'Embarazos:', ['Partos:', 'Cesáreas:']),
            numPartos: this.extractBetween(secObst || text, 'Partos:', ['Cesáreas:', 'Peso antes:']),
            numCesareas: this.extractBetween(secObst || text, 'Cesáreas:', ['Peso antes:', 'Peso después:']),
            pesoAntesEmbarazo: this.extractBetween(secObst || text, 'Peso antes:', ['kg', 'Peso después:']).replace(/[^0-9.]/g, ''),
            pesoDespuesEmbarazo: this.extractBetween(secObst || text, 'Peso después:', ['kg', 'Complicaciones:']).replace(/[^0-9.]/g, ''),
            complicacionesObstetricas: this.extractBetween(secObst || text, 'Complicaciones:', ['DINÁMICA MENSTRUAL', 'DINÁMICA SEXUAL']),

            edadMenarquia: this.extractBetween(secMenstr || text, 'Menarquia:', ['Menopausia:', 'Días menstruación:']),
            edadMenopausia: this.extractBetween(secMenstr || text, 'Menopausia:', ['Días menstruación:', 'Intervalo:']),
            diasMenstruacion: this.extractBetween(secMenstr || text, 'Días menstruación:', ['Intervalo:', 'Caract. sangrado:']),
            intervaloPeriodo: this.extractBetween(secMenstr || text, 'Intervalo:', ['días', 'Caract. sangrado:']).replace(/\D/g, ''),

            estadoPaciente: secEstado ? secEstado.trim().replace(/^\.|\.$/g, '').trim() : '',

            genitoColor: this.extractBetween(secGenito || text, 'Color:', ['Hidratación:', 'Lubricación:']),
            genitoHidratacion: this.extractBetween(secGenito || text, 'Hidratación:', ['Lubricación:', 'Cicatrices:']),
            genitoLubricacion: this.extractBetween(secGenito || text, 'Lubricación:', ['Cicatrices:', 'Clítoris:']),
            genitoCicatrices: this.extractBetween(secGenito || text, 'Cicatrices:', ['Clítoris:', 'Uretra:']),
            genitoClitoris: this.extractBetween(secGenito || text, 'Clítoris:', ['Uretra:', 'Vagina:']),
            genitoUretra: this.extractBetween(secGenito || text, 'Uretra:', ['Vagina:', 'Prolapso:']),
            genitoVagina: this.extractBetween(secGenito || text, 'Vagina:', ['Prolapso:', 'Valoración neuromotriz:']),
            genitoProlapso: this.extractBetween(secGenito || text, 'Prolapso:', ['Valoración neuromotriz:', 'Puntos tensión:']),
            puntosTension: this.extractBetween(secGenito || text, 'Puntos tensión:', ['Dolor superficial:', 'Dolor profundo:']),
            dolorSuperficial: this.extractBetween(secGenito || text, 'Dolor superficial:', ['Dolor profundo:', 'PERFECT:']),
            dolorProfundo: this.extractBetween(secGenito || text, 'Dolor profundo:', ['PERFECT:', 'Movilidad coxis:']),
            perfectScore: this.extractBetween(secGenito || text, 'PERFECT:', ['Movilidad coxis:', 'Mov. columna']),
            movilidadCoxis: this.extractBetween(secGenito || text, 'Movilidad coxis:', ['cm', 'Mov. columna lumbar:']).replace(/[^0-9.]/g, ''),
            movilidadColumna: this.extractBetween(secGenito || text, 'Mov. columna lumbar:', ['Tos y estornudo:', 'Ano:']),
            genitoTosEstornudo: this.extractBetween(secGenito || text, 'Tos y estornudo:', ['Ano:', 'NFCP:']),
            genitoAno: this.extractBetween(secGenito || text, 'Ano:', ['NFCP:', 'DESARROLLO DE LA ACTIVIDAD']),

            desarrolloActividad: secDesarrollo ? secDesarrollo.trim().replace(/^\.|\.$/g, '').trim() : '',
            notasAnalisis: secNotas ? secNotas.trim().replace(/^\.|\.$/g, '').trim() : '',
            objetivos: secObj ? secObj.trim().replace(/^\.|\.$/g, '').trim() : '',

            numSesiones: this.extractBetween(secAtencion || text, 'Sesiones:', ['Frecuencia:', 'Plan:']),
            frecuenciaSesiones: this.extractBetween(secAtencion || text, 'Frecuencia:', ['Plan:', 'RECOMENDACIONES']),
            planTratamiento: this.extractBetween(secAtencion || text, 'Plan:', ['RECOMENDACIONES', 'SIGNOS DE ALARMA']),

            recomendacionesIncontinencia: this.extractBetween(secRecom || text, 'Incontinencia:', ['Estreñimiento:', 'Dispareunia:']),
            recomendacionesEstrenimiento: this.extractBetween(secRecom || text, 'Estreñimiento:', ['Dispareunia:', 'SIGNOS DE ALARMA']),
            recomendacionesDispareunia: this.extractBetween(secRecom || text, 'Dispareunia:', ['SIGNOS DE ALARMA']),

            signosAlarma: secSignos ? secSignos.trim().replace(/^\.|\.$/g, '').trim() : '',

            radioGroups: {
                deseoDefecatorio: this.extractBetween(secDef || text, 'Deseo def.:', ['Postura:', 'Forma def.:']),
                posturaDefecatoria: this.extractBetween(secDef || text, 'Postura:', ['Forma def.:', 'Vaciado incompleto:']),
                formaDefecacion: this.extractBetween(secDef || text, 'Forma def.:', ['Vaciado incompleto:', 'Cierra ano:']),
                deseoMiccional: this.extractBetween(secMiccional || text, 'Deseo miccional:', ['Postura:', 'Hiperpresiva:']),
                posturaMiccional: this.extractBetween(secMiccional || text, 'Postura:', ['Hiperpresiva:', 'Dificultad:', 'Forma de micción:'])
            }
        };
    }

    mostrarAdjuntosCargados() {
        if (this.adjuntos && this.adjuntos.length > 0) {
            const nombres = this.adjuntos.map(r => r.nombre).join(', ');
            document.getElementById('adjuntoNombre').textContent = nombres;
            document.getElementById('adjuntoInfo').style.display = 'block';
        }
    }

    borrarAdjuntos() {
        if (confirm('¿Estás seguro de que deseas eliminar los archivos adjuntos?')) {
            this.adjuntos = [];
            this.adjuntosEliminadosFlag = true;
            document.getElementById('adjuntoInfo').style.display = 'none';
            document.getElementById('adjuntoNombre').textContent = '';
            const input = document.getElementById('pdfImagenInput');
            if (input) input.value = '';
            this.showAlert('✓ Archivos adjuntos eliminados', 'success');
        }
    }

    handlePdfImagenSelect(event) {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) {
            this.adjuntos = [];
            document.getElementById('adjuntoInfo').style.display = 'none';
            return;
        }

        const maxSize = 10 * 1024 * 1024;
        const tiposValidos = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];

        const lecturas = files.map(file => new Promise((resolve, reject) => {
            if (file.size > maxSize) {
                reject(new Error(`El archivo ${file.name} supera 10MB`));
                return;
            }
            if (!tiposValidos.includes(file.type)) {
                reject(new Error(`Tipo no permitido en ${file.name}`));
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => resolve({ nombre: file.name, tipo: file.type, data: e.target.result });
            reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}`));
            reader.readAsDataURL(file);
        }));

        Promise.all(lecturas)
            .then(resultados => {
                this.adjuntos = [...this.adjuntos, ...resultados];
                this.adjuntosEliminadosFlag = false;
                const nombres = this.adjuntos.map(r => r.nombre).join(', ');
                document.getElementById('adjuntoNombre').textContent = nombres;
                document.getElementById('adjuntoInfo').style.display = 'block';
                this.showAlert(`✓ ${resultados.length} archivo(s) agregado(s)`, 'success');
            })
            .catch(error => {
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
        modal.querySelector('.modal-icon').textContent = '💾';
        modal.querySelector('.modal-title').textContent = '¿Guardar Reporte?';
        modal.querySelector('.modal-message').textContent = 'Se guardarán los datos del paciente en la base de datos de forma segura.';
        modal.classList.add('active');

        const modalCancel = document.getElementById('modalCancel');
        const modalConfirm = document.getElementById('modalConfirm');
        const newCancel = modalCancel.cloneNode(true);
        const newConfirm = modalConfirm.cloneNode(true);
        modalCancel.parentNode.replaceChild(newCancel, modalCancel);
        modalConfirm.parentNode.replaceChild(newConfirm, modalConfirm);

        newCancel.addEventListener('click', () => modal.classList.remove('active'));
        newConfirm.addEventListener('click', async () => {
            newConfirm.disabled = true;
            newCancel.disabled = true;
            document.querySelector('.modal-loading').classList.add('active');
            document.querySelector('.modal-buttons').style.display = 'none';
            await this.executeSaveReport();
        });
    }

    async executeSaveReport() {
        try {
            await this.guardarEnDB();
            document.getElementById('confirmModal').classList.remove('active');
            this.showAlert('✓ Reporte guardado correctamente', 'success');
            setTimeout(() => window.location.href = 'bienvenida.html', 1500);
        } catch (error) {
            console.error('Error en executeSaveReport:', error);
            document.getElementById('confirmModal').classList.remove('active');
            this.showAlert('Error al guardar: ' + error.message, 'error');
        }
    }

    async guardarEnDB() {
        if (!window.supabaseClient) {
            console.warn('Supabase no configurado');
            return;
        }

        const nombre = document.getElementById('nombre').value.trim();
        const apellido = document.getElementById('apellido')?.value.trim() || '';
        const cedula = document.getElementById('cc').value.trim();

        if (!cedula) return;

        const reporteData = this.collectFormData();
        const currentUser = await window.supabaseClient.getCurrentUser();
        const userId = currentUser?.id;
        const userEmail = currentUser?.email || sessionStorage.getItem('userEmail') || null;

        const dataToSave = {
            cedula,
            nombre,
            apellido,
            atendido_por: 'Nataly',
            user_id: userId || null,
            modificado_por: userEmail,
            tipo_reporte: 'piso_pelvico',
            reporte_json: { ...reporteData, atendidoPor: 'Nataly', atendido_por: 'Nataly', modificado_por: userEmail },
            fecha_modificacion: new Date().toISOString()
        };

        if (this.adjuntos && this.adjuntos.length > 0) {
            dataToSave.archivo_adjunto = JSON.stringify(this.adjuntos);
            dataToSave.tipo_archivo_adjunto = this.adjuntos.length > 1 ? 'multiple' : this.adjuntos[0].tipo;
            this.adjuntosEliminadosFlag = false;
        } else if (this.adjuntosEliminadosFlag) {
            dataToSave.archivo_adjunto = null;
            dataToSave.tipo_archivo_adjunto = null;
            this.adjuntosEliminadosFlag = false;
        }

        const existente = await window.supabaseClient.getReporteByCedulaTipo(cedula, 'piso_pelvico');

        if (existente) {
            await window.supabaseClient.updateReporte(cedula, dataToSave, 'piso_pelvico');
        } else {
            dataToSave.fecha_creacion = new Date().toISOString();
            dataToSave.creado_por = userEmail;
            dataToSave.reporte_json.creado_por = userEmail;
            await window.supabaseClient.saveReporte(dataToSave);
        }
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
        modal.classList.add('active');

        const modalCancel = document.getElementById('modalCancel');
        const modalConfirm = document.getElementById('modalConfirm');
        const newCancel = modalCancel.cloneNode(true);
        const newConfirm = modalConfirm.cloneNode(true);
        modalCancel.parentNode.replaceChild(newCancel, modalCancel);
        modalConfirm.parentNode.replaceChild(newConfirm, modalConfirm);

        newCancel.addEventListener('click', () => modal.classList.remove('active'));
        newConfirm.addEventListener('click', async () => {
            newConfirm.disabled = true;
            newCancel.disabled = true;
            document.querySelector('.modal-loading').classList.add('active');
            document.querySelector('.modal-buttons').style.display = 'none';
            await this.generateAndSavePDF();
        });
    }

    getCheckboxValues(name) {
        const checked = document.querySelectorAll(`input[name="${name}"]:checked`);
        return Array.from(checked).map(c => c.value);
    }

    getRadioValue(name) {
        const checked = document.querySelector(`input[name="${name}"]:checked`);
        return checked ? checked.value : '-';
    }

    async generateAndSavePDF() {
        const nombrePaciente = document.getElementById('nombre')?.value?.trim() || '';
        const apellidoPaciente = document.getElementById('apellido')?.value?.trim() || '';
        const nombreCompleto = `${nombrePaciente} ${apellidoPaciente}`.trim() || 'Reporte_Piso_Pelvico';
        const filename = `${nombreCompleto}.pdf`;

        try {
            if (!window.jspdf) throw new Error('jsPDF no está cargado');

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');

            const primaryColor = [10, 148, 176];
            const accentColor = [8, 125, 148];
            const textDark = [33, 33, 33];

            let yPos = 15;
            const pageWidth = 210;

            // HEADER
            doc.setFillColor(...primaryColor);
            doc.rect(0, 0, 210, 33, 'F');

            // Logo
            try {
                doc.addImage('logo.jpeg', 'JPEG', 12, 5, 30, 21);
            } catch (e) {
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(24);
                doc.setFont('helvetica', 'bold');
                doc.text('KS', 18, 24);
            }

            // Title
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(19);
            doc.setFont('helvetica', 'bold');
            doc.text('Reporte de Piso Pélvico', 52, 14);

            // Patient info on the right side
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(255, 255, 255);
            const today = new Date();
            const fechaLarga = today.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
            doc.text(`Paciente: ${nombrePaciente} ${apellidoPaciente}`, 198, 16, { align: 'right' });
            doc.text(`Fecha: ${fechaLarga}`, 198, 23, { align: 'right' });

            yPos = 42;

            const tableMargin = { left: 12, right: 12, bottom: 25 };

            // DATOS GENERALES
            this.addSectionHeader(doc, 'DATOS GENERALES', yPos, primaryColor, accentColor);
            yPos += 13;

            doc.autoTable({
                startY: yPos,
                margin: tableMargin,
                body: this.onlyFilled([
                    ['Nombre:', document.getElementById('nombre')?.value || '-', 'Apellido:', document.getElementById('apellido')?.value || '-'],
                    ['CC:', document.getElementById('cc')?.value || '-', 'Celular:', document.getElementById('celular')?.value || '-'],
                    ['Edad:', document.getElementById('edad')?.value ? document.getElementById('edad').value + ' años' : '-', 'Sexo:', document.getElementById('sexo')?.value || '-'],
                    ['Ocupación:', { content: document.getElementById('ocupacion')?.value || '-', colSpan: 3 }],
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
                }
            });

            yPos = doc.lastAutoTable.finalY + 8;

            // ANAMNESIS
            const dx = document.getElementById('dxMedico')?.value?.trim();
            const refDolor = document.getElementById('refiereDolor')?.value?.trim();
            const acompanante = document.getElementById('acompanante')?.value?.trim();
            const especialista = document.getElementById('especialistaRemite')?.value?.trim();
            const ciclo = document.getElementById('cicloTerapia')?.value?.trim();
            const medicamentos = document.getElementById('medicamentos')?.value?.trim();
            const examenes = document.getElementById('examenesComplementarios')?.value?.trim();
            const barrerasArr = this.getCheckboxValues('barreras');
            const facilitadoresArr = this.getCheckboxValues('facilitadores');
            const expectativa = document.getElementById('expectativaPaciente')?.value?.trim();

            if (dx || refDolor || acompanante || especialista || ciclo || medicamentos || examenes || barrerasArr.length || facilitadoresArr.length || expectativa) {
                const parts = [];
                if (acompanante) parts.push(`Paciente ingresa en compañía de: ${acompanante}.`);
                if (dx) parts.push(`Dx médico: ${dx}.`);
                if (refDolor) parts.push(`Refiere dolor / molestia: ${refDolor}.`);
                if (especialista) parts.push(`Especialista que remite: ${especialista}.`);
                if (ciclo) parts.push(`Ciclo de terapia: ${ciclo}.`);
                if (medicamentos) parts.push(`Medicamentos: ${medicamentos}.`);
                if (examenes) parts.push(`Exámenes: ${examenes}.`);
                if (barrerasArr.length) parts.push(`Barreras: ${barrerasArr.join(', ')}.`);
                if (facilitadoresArr.length) parts.push(`Facilitadores: ${facilitadoresArr.join(', ')}.`);
                if (expectativa) parts.push(`Expectativa del paciente: "${expectativa}".`);
                const anamnesisText = parts.join('\n');

                yPos = this.addTextSection(doc, 'ANAMNESIS', anamnesisText, yPos, primaryColor, accentColor, textDark);
            }

            // ANTECEDENTES OCUPACIONALES
            if (this.hasData(['desempenoLaboral','tipoTrabajo','puestoErgonomico','pausasActivas','actividadFisicaLaboral','consumoCigarrillo','consumoAlcohol']) || this.getCheckboxValues('habitosAlimenticios').length) {
            if (yPos > 240) { doc.addPage(); yPos = 20; }
            this.addSectionHeader(doc, 'ANTECEDENTES OCUPACIONALES', yPos, primaryColor, accentColor);
            yPos += 9;

            const habitos = this.getCheckboxValues('habitosAlimenticios').join(', ') || '-';
            doc.autoTable({
                startY: yPos,
                margin: tableMargin,
                body: this.onlyFilled([
                    ['Ocupación:', document.getElementById('desempenoLaboral')?.value || '-', 'Tipo trabajo:', document.getElementById('tipoTrabajo')?.value || '-'],
                    ['Puesto ergonómico:', document.getElementById('puestoErgonomico')?.value || '-', 'Pausas activas:', document.getElementById('pausasActivas')?.value || '-'],
                    ['Actividad física:', document.getElementById('actividadFisicaLaboral')?.value || '-', 'Cigarrillo:', document.getElementById('consumoCigarrillo')?.value || '-'],
                    ['Alcohol:', document.getElementById('consumoAlcohol')?.value || '-', 'Hábitos alimenticios:', habitos]
                ]),
                theme: 'grid',
                alternateRowStyles: { fillColor: [247, 249, 252] },
                styles: { fontSize: 8.5,                 cellPadding: 5, textColor: textDark, lineColor: [225, 230, 238], lineWidth: 0.3 },
                columnStyles: {
                    0: { fontStyle: 'bold', textColor: primaryColor, cellWidth: 40, fillColor: [240, 246, 250] },
                    1: { cellWidth: 50, fillColor: [255, 255, 255] },
                    2: { fontStyle: 'bold', textColor: primaryColor, cellWidth: 40, fillColor: [240, 246, 250] },
                    3: { cellWidth: 50, fillColor: [255, 255, 255] }
                }
            });

            yPos = doc.lastAutoTable.finalY + 8;
            }

            // DINÁMICA MICCIONAL
            const formaMiccion = this.getCheckboxValues('formaMiccion').join(', ') || '-';
            const dolorMiccional = this.getCheckboxValues('dolorMiccional').join(', ') || '-';
            const hiperpresiva = document.getElementById('hiperpresiva')?.checked ? 'Sí' : '-';

            const miccionalBody = this.onlyFilled([
                ['Protector:', document.getElementById('usoProtector')?.value || '-', 'Ropa interior:', document.getElementById('tipoRopaInterior')?.value || '-'],
                ['Micciones día:', document.getElementById('miccionesDia')?.value || '-', 'Micciones noche:', document.getElementById('miccionesNoche')?.value || '-'],
                ['Deseo miccional:', this.getRadioValue('deseoMiccional'), 'Postura:', this.getRadioValue('posturaMiccional')],
                ['Hiperpresiva:', hiperpresiva, 'Forma de micción:', formaMiccion],
                ['Dificultad:', document.getElementById('dificultadMiccional')?.value || '-', ''],
                ['Mapa de dolor:', dolorMiccional, '']
            ]).map(r => r.length === 3 && (!r[2] || r[2] === '') ? [r[0], { content: r[1], colSpan: 3 }] : r);
            if (miccionalBody.length) {
                if (yPos > 230) { doc.addPage(); yPos = 20; }
                this.addSectionHeader(doc, 'DINÁMICA MICCIONAL', yPos, primaryColor, accentColor);
                yPos += 12;
                doc.autoTable({
                    startY: yPos,
                    margin: tableMargin,
                    body: miccionalBody,
                theme: 'grid',
                alternateRowStyles: { fillColor: [247, 249, 252] },
                styles: { fontSize: 8.5,                 cellPadding: 5, textColor: textDark, lineColor: [225, 230, 238], lineWidth: 0.3 },
                columnStyles: {
                    0: { fontStyle: 'bold', textColor: primaryColor, cellWidth: 40, fillColor: [240, 246, 250] },
                    1: { cellWidth: 50, fillColor: [255, 255, 255] },
                    2: { fontStyle: 'bold', textColor: primaryColor, cellWidth: 40, fillColor: [240, 246, 250] },
                    3: { cellWidth: 50, fillColor: [255, 255, 255] }
                }
            });

            yPos = doc.lastAutoTable.finalY + 8;
            }

            // DINÁMICA DEFECATORIA
            const defBody = this.onlyFilled([
                ['Def. día:', document.getElementById('defecacionesDia')?.value || '-', 'Def. noche:', document.getElementById('defecacionesNoche')?.value || '-'],
                ['Deseo def.:', this.getRadioValue('deseoDefecatorio'), 'Postura:', this.getRadioValue('posturaDefecatoria')],
                ['Forma def.:', this.getRadioValue('formaDefecacion'), 'Vaciado incompleto:', document.getElementById('vaciadoIncompleto')?.value || '-'],
                ['Cierra ano:', document.getElementById('cierraAno')?.value || '-', 'Escala Bristol:', document.getElementById('escalaBristol')?.value || '-'],
                ['Gases:', document.getElementById('gases')?.value || '-', ''],
                ['Tipo dolor:', this.getCheckboxValues('tipoDolorDef').join(', ') || '-', 'Localización:', this.getCheckboxValues('localizacionDolor').join(', ') || '-']
            ]).map(r => r.length === 3 && (!r[2] || r[2] === '') ? [r[0], { content: r[1], colSpan: 3 }] : r);
            if (defBody.length) {
                if (yPos > 230) { doc.addPage(); yPos = 20; }
                this.addSectionHeader(doc, 'DINÁMICA DEFECATORIA', yPos, primaryColor, accentColor);
                yPos += 12;
                doc.autoTable({
                    startY: yPos,
                    margin: tableMargin,
                    body: defBody,
                theme: 'grid',
                alternateRowStyles: { fillColor: [247, 249, 252] },
                styles: { fontSize: 8.5,                 cellPadding: 5, textColor: textDark, lineColor: [225, 230, 238], lineWidth: 0.3 },
                columnStyles: {
                    0: { fontStyle: 'bold', textColor: primaryColor, cellWidth: 40, fillColor: [240, 246, 250] },
                    1: { cellWidth: 50, fillColor: [255, 255, 255] },
                    2: { fontStyle: 'bold', textColor: primaryColor, cellWidth: 40, fillColor: [240, 246, 250] },
                    3: { cellWidth: 50, fillColor: [255, 255, 255] }
                }
            });

            yPos = doc.lastAutoTable.finalY + 8;
            }

            // DINÁMICA OBSTETRA
            const obstBody = this.onlyFilled([
                ['Embarazos:', document.getElementById('numEmbarazos')?.value || '-', 'Partos:', document.getElementById('numPartos')?.value || '-'],
                ['Cesáreas:', document.getElementById('numCesareas')?.value || '-', 'Peso antes:', document.getElementById('pesoAntesEmbarazo')?.value ? document.getElementById('pesoAntesEmbarazo').value + ' kg' : '-'],
                ['Peso después:', document.getElementById('pesoDespuesEmbarazo')?.value ? document.getElementById('pesoDespuesEmbarazo').value + ' kg' : '-', ''],
                ['Complicaciones:', document.getElementById('complicacionesObstetricas')?.value || '-', '']
            ]).map(r => r.length === 3 && (!r[2] || r[2] === '') ? [r[0], { content: r[1], colSpan: 3 }] : r);
            if (obstBody.length) {
                if (yPos > 230) { doc.addPage(); yPos = 20; }
                this.addSectionHeader(doc, 'DINÁMICA OBSTETRA', yPos, primaryColor, accentColor);
                yPos += 12;
                doc.autoTable({
                    startY: yPos,
                    margin: tableMargin,
                    body: obstBody,
                theme: 'grid',
                alternateRowStyles: { fillColor: [247, 249, 252] },
                styles: { fontSize: 8.5,                 cellPadding: 5, textColor: textDark, lineColor: [225, 230, 238], lineWidth: 0.3 },
                columnStyles: {
                    0: { fontStyle: 'bold', textColor: primaryColor, cellWidth: 40, fillColor: [240, 246, 250] },
                    1: { cellWidth: 50, fillColor: [255, 255, 255] },
                    2: { fontStyle: 'bold', textColor: primaryColor, cellWidth: 40, fillColor: [240, 246, 250] },
                    3: { cellWidth: 50, fillColor: [255, 255, 255] }
                }
            });

            yPos = doc.lastAutoTable.finalY + 8;
            }

            // DINÁMICA MENSTRUAL
            const menstrBody = this.onlyFilled([
                ['Menarquia:', document.getElementById('edadMenarquia')?.value || '-', 'Menopausia:', document.getElementById('edadMenopausia')?.value || '-'],
                ['Días menstruación:', document.getElementById('diasMenstruacion')?.value || '-', 'Intervalo:', document.getElementById('intervaloPeriodo')?.value ? document.getElementById('intervaloPeriodo').value + ' días' : '-'],
                ['Caract. sangrado:', this.getCheckboxValues('caractSangrado').join(', ') || '-', ''],
                ['Dolor menstrual:', this.getCheckboxValues('dolorMenstrual').join(', ') || '-', ''],
                ['Anticonceptivo:', this.getCheckboxValues('anticonceptivo').join(', ') || '-', '']
            ]).map(r => {
                if (r.length === 2) return [r[0], { content: r[1], colSpan: 3 }];
                if (r.length === 3 && (!r[2] || r[2] === '')) return [r[0], { content: r[1], colSpan: 3 }];
                return r;
            });
            if (menstrBody.length) {
                if (yPos > 220) { doc.addPage(); yPos = 20; }
                this.addSectionHeader(doc, 'DINÁMICA MENSTRUAL', yPos, primaryColor, accentColor);
                yPos += 12;
                doc.autoTable({
                    startY: yPos,
                    margin: tableMargin,
                    body: menstrBody,
                    theme: 'grid',
                    alternateRowStyles: { fillColor: [247, 249, 252] },
                    styles: { fontSize: 8.5, cellPadding: 5, textColor: textDark, lineColor: [225, 230, 238], lineWidth: 0.3 },
                    columnStyles: {
                        0: { fontStyle: 'bold', textColor: primaryColor, cellWidth: 40, fillColor: [240, 246, 250] },
                        1: { cellWidth: 50, fillColor: [255, 255, 255] },
                        2: { fontStyle: 'bold', textColor: primaryColor, cellWidth: 40, fillColor: [240, 246, 250] },
                        3: { cellWidth: 50, fillColor: [255, 255, 255] }
                    }
                });
                yPos = doc.lastAutoTable.finalY + 8;
            }

            // DINÁMICA SEXUAL
            const lubricacion = this.getCheckboxValues('lubricacion').join(', ') || '-';
            const orgasmos = this.getCheckboxValues('orgasmos').join(', ') || '-';
            const eyaculacion = this.getCheckboxValues('eyaculacion').join(', ') || '-';
            const disfuncionOrganica = this.getCheckboxValues('disfuncionOrganica').join(', ') || '-';
            const dinamicaSexual = this.getCheckboxValues('dinamicaSexual').join(', ') || '-';
            const alteracionSensitiva = this.getCheckboxValues('alteracionSensitiva').join(', ') || '-';
            const dolorPenetracion = this.getRadioValue('dolorPenetracion');
            const dolorFondo = this.getCheckboxValues('dolorFondo').join(', ') || '-';
            const dolorIrradiado = this.getCheckboxValues('dolorIrradiado').join(', ') || '-';
            const vaginismo = this.getCheckboxValues('vaginismo').join(', ') || '-';
            const dolorPeneal = this.getCheckboxValues('dolorPeneal').join(', ') || '-';

            const sexualBody = this.onlyFilled([
                ['Lubricación:', lubricacion, 'Orgasmos:', orgasmos],
                ['Eyaculación:', eyaculacion, 'Disfunción orgásmica:', disfuncionOrganica],
                ['Dinámica sexual:', dinamicaSexual, ''],
                ['Alteración sensitiva:', alteracionSensitiva, ''],
                ['Dolor penetración:', dolorPenetracion, ''],
                ['Dolor fondo:', dolorFondo, ''],
                ['Dolor irradiado:', dolorIrradiado, ''],
                ['Vaginismo:', vaginismo, ''],
                ['Dolor peneal:', dolorPeneal, '']
            ]).map(r => {
                if (r.length === 2) return [r[0], { content: r[1], colSpan: 3 }];
                if (r.length === 3 && (!r[2] || r[2] === '')) return [r[0], { content: r[1], colSpan: 3 }];
                return r;
            });

            if (sexualBody.length) {
                if (yPos > 210) { doc.addPage(); yPos = 20; }
                this.addSectionHeader(doc, 'DINÁMICA SEXUAL', yPos, primaryColor, accentColor);
                yPos += 12;

                doc.autoTable({
                    startY: yPos,
                    margin: tableMargin,
                    body: sexualBody,
                    theme: 'grid',
                    alternateRowStyles: { fillColor: [247, 249, 252] },
                    styles: { fontSize: 7.5, cellPadding: 5, textColor: textDark, lineColor: [225, 230, 238], lineWidth: 0.3 },
                    columnStyles: {
                        0: { fontStyle: 'bold', textColor: primaryColor, cellWidth: 40, fillColor: [240, 246, 250] },
                        1: { cellWidth: 50, fillColor: [255, 255, 255] },
                        2: { fontStyle: 'bold', textColor: primaryColor, cellWidth: 40, fillColor: [240, 246, 250] },
                        3: { cellWidth: 50, fillColor: [255, 255, 255] }
                    }
                });
                yPos = doc.lastAutoTable.finalY + 8;
            }

            // ESTADO DEL PACIENTE
            const estadoVal = document.getElementById('estadoPaciente')?.value?.trim();
            if (estadoVal) {
                if (doc.lastAutoTable) yPos = Math.max(yPos, doc.lastAutoTable.finalY + 8);
                yPos = this.addTextSection(doc, 'ESTADO DEL PACIENTE', estadoVal, yPos, primaryColor, accentColor, textDark);
            }

            // GENITOURINARIO
            const reflejosPresentes = this.getCheckboxValues('reflejosPresentes').join(', ') || '-';

            const genitoBody = this.onlyFilled([
                ['Color:', document.getElementById('genitoColor')?.value || '-', 'Hidratación:', document.getElementById('genitoHidratacion')?.value || '-'],
                ['Lubricación:', document.getElementById('genitoLubricacion')?.value || '-', 'Cicatrices:', document.getElementById('genitoCicatrices')?.value || '-'],
                ['Clítoris:', document.getElementById('genitoClitoris')?.value || '-', 'Uretra:', document.getElementById('genitoUretra')?.value || '-'],
                ['Vagina:', document.getElementById('genitoVagina')?.value || '-', 'Prolapso:', document.getElementById('genitoProlapso')?.value || '-'],
                ['Valoración neuromotriz:', reflejosPresentes !== '-' || this.getRadioValue('reflejos') !== '-' ? reflejosPresentes + ' - ' + this.getRadioValue('reflejos') : '-', ''],
                ['Puntos tensión:', document.getElementById('puntosTension')?.value || '-', 'Dolor superficial:', document.getElementById('dolorSuperficial')?.value || '-'],
                ['Dolor profundo:', document.getElementById('dolorProfundo')?.value || '-', 'PERFECT:', document.getElementById('perfectScore')?.value || '-'],
                ['Movilidad coxis:', document.getElementById('movilidadCoxis')?.value ? document.getElementById('movilidadCoxis').value + ' cm' : '-', 'Mov. columna lumbar:', document.getElementById('movilidadColumna')?.value || '-'],
                ['Tos y estornudo:', document.getElementById('genitoTosEstornudo')?.value || '-', ''],
                ['Ano:', document.getElementById('genitoAno')?.value || '-', ''],
                ['NFCP:', document.getElementById('genitoNFCP')?.value || '-', '']
            ]).map(r => {
                if (r.length === 2) return [r[0], { content: r[1], colSpan: 3 }];
                if (r.length === 3 && (!r[2] || r[2] === '')) return [r[0], { content: r[1], colSpan: 3 }];
                return r;
            });

            if (genitoBody.length) {
                if (yPos > 210) { doc.addPage(); yPos = 20; }
                this.addSectionHeader(doc, 'GENITOURINARIO', yPos, primaryColor, accentColor);
                yPos += 12;

                doc.autoTable({
                    startY: yPos,
                    margin: tableMargin,
                    body: genitoBody,
                    theme: 'grid',
                    alternateRowStyles: { fillColor: [247, 249, 252] },
                    styles: { fontSize: 7.5, cellPadding: 5, textColor: textDark, lineColor: [225, 230, 238], lineWidth: 0.3 },
                    columnStyles: {
                        0: { fontStyle: 'bold', textColor: primaryColor, cellWidth: 40, fillColor: [240, 246, 250] },
                        1: { cellWidth: 50, fillColor: [255, 255, 255] },
                        2: { fontStyle: 'bold', textColor: primaryColor, cellWidth: 40, fillColor: [240, 246, 250] },
                        3: { cellWidth: 50, fillColor: [255, 255, 255] }
                    }
                });
                yPos = doc.lastAutoTable.finalY + 8;
            }

            // DESARROLLO DE LA ACTIVIDAD
            const desaVal = document.getElementById('desarrolloActividad')?.value?.trim();
            if (desaVal) {
                if (doc.lastAutoTable) yPos = Math.max(yPos, doc.lastAutoTable.finalY + 8);
                yPos = this.addTextSection(doc, 'DESARROLLO DE LA ACTIVIDAD', desaVal, yPos, primaryColor, accentColor, textDark);
            }

            // NOTAS DE ANÁLISIS Y PLAN
            const notasVal = document.getElementById('notasAnalisis')?.value?.trim();
            if (notasVal) {
                yPos = this.addTextSection(doc, 'NOTAS DE ANÁLISIS Y PLAN', notasVal, yPos, primaryColor, accentColor, textDark);
            }

            // OBJETIVOS
            const objVal = document.getElementById('objetivos')?.value?.trim();
            if (objVal) {
                yPos = this.addTextSection(doc, 'OBJETIVOS', objVal, yPos, primaryColor, accentColor, textDark);
            }

            // ATENCIÓN EN MÓDULO DE PISO PÉLVICO
            const atencionBody = this.onlyFilled([
                ['Sesiones:', document.getElementById('numSesiones')?.value || '-', 'Frecuencia:', document.getElementById('frecuenciaSesiones')?.value || '-'],
                ['Plan:', document.getElementById('planTratamiento')?.value || '-', '']
            ]).map(r => {
                if (r.length === 2) return [r[0], { content: r[1], colSpan: 3 }];
                if (r.length === 3 && (!r[2] || r[2] === '')) return [r[0], { content: r[1], colSpan: 3 }];
                return r;
            });

            if (atencionBody.length) {
                if (yPos > 230) { doc.addPage(); yPos = 20; }
                this.addSectionHeader(doc, 'ATENCIÓN EN MÓDULO DE PISO PÉLVICO', yPos, primaryColor, accentColor);
                yPos += 12;

                doc.autoTable({
                    startY: yPos,
                    margin: tableMargin,
                    body: atencionBody,
                    theme: 'grid',
                    alternateRowStyles: { fillColor: [247, 249, 252] },
                    styles: { fontSize: 8.5, cellPadding: 5, textColor: textDark, lineColor: [225, 230, 238], lineWidth: 0.3, valign: 'top' },
                    columnStyles: {
                        0: { fontStyle: 'bold', textColor: primaryColor, cellWidth: 40, fillColor: [240, 246, 250] },
                        1: { cellWidth: 50, fillColor: [255, 255, 255] },
                        2: { fontStyle: 'bold', textColor: primaryColor, cellWidth: 40, fillColor: [240, 246, 250] },
                        3: { cellWidth: 50, fillColor: [255, 255, 255] }
                    }
                });

                yPos = doc.lastAutoTable.finalY + 8;
            }

            // RECOMENDACIONES
            const recomBody = this.onlyFilled([
                ['Incontinencia:', document.getElementById('recomendacionesIncontinencia')?.value || '-'],
                ['Estreñimiento:', document.getElementById('recomendacionesEstrenimiento')?.value || '-'],
                ['Dispareunia:', document.getElementById('recomendacionesDispareunia')?.value || '-']
            ]);

            if (recomBody.length) {
                if (yPos > 220) { doc.addPage(); yPos = 20; }
                this.addSectionHeader(doc, 'RECOMENDACIONES', yPos, primaryColor, accentColor);
                yPos += 12;

                doc.autoTable({
                    startY: yPos,
                    margin: tableMargin,
                    body: recomBody,
                    theme: 'grid',
                    alternateRowStyles: { fillColor: [247, 249, 252] },
                    styles: { fontSize: 8.5, cellPadding: 5, textColor: textDark, lineColor: [225, 230, 238], lineWidth: 0.3, valign: 'top' },
                    columnStyles: {
                        0: { fontStyle: 'bold', textColor: primaryColor, cellWidth: 40, fillColor: [240, 246, 250] },
                        1: { cellWidth: 140, fillColor: [255, 255, 255] }
                    }
                });

                yPos = doc.lastAutoTable.finalY + 8;
            }

            // SIGNOS DE ALARMA
            const signosVal = document.getElementById('signosAlarma')?.value?.trim();
            if (signosVal) {
                if (doc.lastAutoTable) yPos = Math.max(yPos, doc.lastAutoTable.finalY + 8);
                yPos = this.addTextSection(doc, 'SIGNOS DE ALARMA', signosVal, yPos, primaryColor, accentColor, textDark);
            }

            // FOOTER EN TODAS LAS PÁGINAS
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setDrawColor(10, 148, 176);
                doc.setLineWidth(0.5);
                doc.line(12, 280, 198, 280);
                doc.setFontSize(7);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(150, 160, 170);
                doc.text('KINETIQ SPORTS · Sistema Inteligente de Evaluación Biomecánica', 12, 285);
                doc.text(`Página ${i} de ${pageCount}`, 198, 285, { align: 'right' });
            }

            // Adjuntar imágenes
            if (this.adjuntos && this.adjuntos.length > 0) {
                const imagenes = this.adjuntos.filter(a => a.tipo.startsWith('image/'));
                for (const imagen of imagenes) {
                    await this.agregarArchivoAlPDF(doc, imagen);
                }
            }

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

                    // Incrustar copia digital de seguridad en metadatos Subject
                    const rawPayload = JSON.stringify(reporteData);
                    const encodedData = btoa(unescape(encodeURIComponent(rawPayload)));
                    mainDoc.setSubject('KINETIQ_DATA:' + encodedData);
                    mainDoc.setTitle(filename);

                    pdfBytes = await mainDoc.save();
                }
            } catch (pdfLibErr) {
                console.warn('Advertencia procesando PDF con PDFLib:', pdfLibErr);
            }

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

            document.getElementById('confirmModal').classList.remove('active');

            if (dbSuccess) {
                this.showAlert('✓ PDF descargado y guardado en base de datos correctamente', 'success');
                setTimeout(() => window.location.href = 'bienvenida.html', 2000);
            } else {
                this.showAlert('⚠️ PDF descargado con copia digital de seguridad. Si hubo un problema al guardar en la base de datos, puedes subir este PDF más tarde con el botón "Cargar".', 'warning');
            }

        } catch (error) {
            console.error('Error en generateAndSavePDF:', error);
            document.getElementById('confirmModal').classList.remove('active');
            this.showAlert('Error al generar PDF: ' + error.message, 'error');
        }
    }

    addSectionHeader(doc, title, yPos, primaryColor, accentColor) {
        doc.setFillColor(...primaryColor);
        doc.roundedRect(12, yPos, 186, 9, 2, 2, 'F');
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 18, yPos + 6.5);
    }

    addTextSection(doc, title, text, yPos, primaryColor, accentColor, textDark) {
        if (!text || !text.trim()) return yPos;

        if (yPos > 240) {
            doc.addPage();
            yPos = 20;
        }

        this.addSectionHeader(doc, title, yPos, primaryColor, accentColor);
        yPos += 13;

        const lines = doc.splitTextToSize(text.trim(), 182);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...textDark);

        const lineHeight = 4.6;
        for (let i = 0; i < lines.length; i++) {
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
            doc.text(lines[i], 12, yPos);
            yPos += lineHeight;
        }

        yPos += 3;
        doc.setDrawColor(225, 230, 238);
        doc.setLineWidth(0.3);
        doc.line(12, yPos, 198, yPos);
        yPos += 7;

        return yPos;
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
            if (!adjunto?.tipo || !adjunto.tipo.startsWith('image/')) return;

            doc.addPage();
            const primaryColor = [10, 148, 176];
            const accentColor = [8, 125, 148];

            doc.setFillColor(...primaryColor);
            doc.rect(0, 0, 210, 35, 'F');
            doc.setFillColor(...accentColor);
            doc.rect(0, 32, 210, 3, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('ANEXO ADJUNTO', 15, 20);

            const img = new Image();
            img.src = adjunto.data;
            await new Promise((resolve) => {
                img.onload = () => {
                    const maxWidth = 180;
                    const maxHeight = 200;
                    let { width, height } = img;
                    if (width > height) {
                        if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
                    } else {
                        if (height > maxHeight) { width = (width * maxHeight) / height; height = maxHeight; }
                    }
                    doc.addImage(adjunto.data, adjunto.tipo.split('/')[1].toUpperCase(), (210 - width) / 2, 45, width, height);
                    resolve();
                };
            });
        } catch (error) {
            console.error('Error al agregar archivo adjunto:', error);
        }
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
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.reporte = new ReportePisoPelvico();
});
