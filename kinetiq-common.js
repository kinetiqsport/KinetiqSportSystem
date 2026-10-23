/**
 * Kinetiq Sport — Clinical Management & Biomechanical Evaluation System
 * Copyright (c) 2026 Esteban (@esteban0903). All rights reserved.
 * Proprietary and confidential. Unauthorized copying or distribution is strictly prohibited.
 */

// kinetiq-common.js - Configuración y utilidades compartidas por formularios y dashboard

(function() {
    // Profesionales por módulo (única fuente de verdad para formularios y estadísticas)
    const PROFESIONALES = {
        pisada: ['Jorge', 'Santiago', 'Mariana'],
        piso_pelvico: ['Nataly']
    };
    // Ícono de cada profesional en los botones de "Atendido por"
    const ICONO_PROFESIONAL = { Jorge: '👨‍⚕️', Santiago: '👨‍⚕️', Mariana: '👩‍⚕️', Nataly: '👩‍⚕️' };

    // Límites de archivos
    const MAX_ADJUNTO_MB = 10; // Cada adjunto se guarda en la base de datos
    const MAX_CARGA_MB = 15;   // Reporte PDF/JSON cargado (puede incluir adjuntos unidos)

    function todosLosProfesionales() {
        return [...new Set(Object.values(PROFESIONALES).flat())];
    }

    function escapeHtml(val) {
        return String(val ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Quita caracteres reservados de los filtros PostgREST (.or / .ilike) para que el texto
    // buscado no pueda alterar la consulta
    function sanitizeSearch(query) {
        return String(query ?? '').replace(/[,()"'\\*%:.]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Convierte valores antiguos como "5 días" al número que espera el select 0-7
    function normalizarDias(valor) {
        if (valor === null || valor === undefined || valor === '') return '';
        const n = parseInt(String(valor).replace(/\D/g, ''), 10);
        return Number.isFinite(n) && n >= 0 && n <= 7 ? String(n) : '';
    }

    function descargarArchivo(contenido, filename, mime) {
        const blob = new Blob([contenido], { type: mime });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // Respaldo local para el profesional cuando falla la base de datos (se recarga con "Cargar")
    function descargarRespaldoJSON(data, nombreBase) {
        const limpio = String(nombreBase || 'Reporte').replace(/[^\wáéíóúñÁÉÍÓÚÑ -]/g, '').trim() || 'Reporte';
        descargarArchivo(JSON.stringify(data, null, 2), `Respaldo_${limpio}_${Date.now()}.json`, 'application/json');
    }

    // Llena los <select data-profesionales="modulo"> conservando la opción vacía inicial
    function poblarProfesionales() {
        document.querySelectorAll('select[data-profesionales]').forEach(select => {
            const lista = PROFESIONALES[select.dataset.profesionales] || [];
            const actual = select.value;
            select.querySelectorAll('option:not([value=""])').forEach(o => o.remove());
            lista.forEach(nombre => {
                const option = document.createElement('option');
                option.value = nombre;
                option.textContent = nombre;
                select.appendChild(option);
            });
            if (lista.includes(actual)) select.value = actual;
            else if (!select.querySelector('option[value=""]') && lista.length) select.value = lista[0];
        });
    }

    // Llena los <select data-dias> con las opciones 0 a 7
    function poblarSelectsDias() {
        document.querySelectorAll('select[data-dias]').forEach(select => {
            if (select.options.length > 1) return;
            for (let i = 0; i <= 7; i++) {
                const option = document.createElement('option');
                option.value = String(i);
                option.textContent = i === 1 ? '1 día' : `${i} días`;
                select.appendChild(option);
            }
        });
    }

    // ---------- Índice de secciones con progreso (formularios) ----------
    function camposDeSeccion(section) {
        const grupos = new Map();
        section.querySelectorAll('input, select, textarea').forEach(el => {
            if (el.type === 'file' || el.type === 'hidden' || el.readOnly || el.disabled) return;
            if (el.closest('[data-progreso-ignorar]')) return;
            if (el.type === 'checkbox' && !el.name) return; // Casillas sueltas: "no marcado" también es una respuesta
            const clave = (el.type === 'radio' || el.type === 'checkbox') ? `${el.type}:${el.name}` : `id:${el.id || el.name}`;
            if (!grupos.has(clave)) grupos.set(clave, []);
            grupos.get(clave).push(el);
        });
        let llenos = 0;
        grupos.forEach(els => {
            const lleno = els.some(el => (el.type === 'radio' || el.type === 'checkbox') ? el.checked : String(el.value || '').trim() !== '');
            if (lleno) llenos++;
        });
        return { total: grupos.size, llenos };
    }

    function initProgresoFormulario() {
        const form = document.getElementById('reportForm');
        if (!form || form.querySelector('.form-progress')) return;
        const secciones = [...form.querySelectorAll(':scope > section.section')]
            .filter(s => s.querySelector('.section-header h2') && camposDeSeccion(s).total > 0);
        if (secciones.length < 2) return;

        const nav = document.createElement('nav');
        nav.className = 'form-progress';
        nav.setAttribute('aria-label', 'Secciones del formulario');
        nav.innerHTML = `
            <div class="form-progress-top">
                <span class="form-progress-label">Progreso del formulario</span>
                <span class="form-progress-pct">0%</span>
            </div>
            <div class="form-progress-bar"><span></span></div>
            <div class="form-progress-pills"></div>
        `;
        const pillsCont = nav.querySelector('.form-progress-pills');
        const pills = secciones.map((sec, i) => {
            if (!sec.id) sec.id = `seccion-${i + 1}`;
            const titulo = sec.querySelector('.section-header h2').textContent.trim();
            const corto = titulo.charAt(0) + titulo.slice(1).toLowerCase();
            const pill = document.createElement('button');
            pill.type = 'button';
            pill.className = 'form-progress-pill';
            pill.innerHTML = `<span class="pill-check" aria-hidden="true"></span><span class="pill-text">${escapeHtml(corto)}</span>`;
            pill.addEventListener('click', () => {
                const y = sec.getBoundingClientRect().top + window.scrollY - nav.offsetHeight - 12;
                window.scrollTo({ top: y, behavior: 'smooth' });
            });
            pillsCont.appendChild(pill);
            return pill;
        });
        form.insertBefore(nav, form.firstElementChild);

        const actualizar = () => {
            let total = 0, llenos = 0;
            secciones.forEach((sec, i) => {
                const c = camposDeSeccion(sec);
                total += c.total;
                llenos += c.llenos;
                pills[i].classList.toggle('partial', c.llenos > 0 && c.llenos < c.total);
                pills[i].classList.toggle('done', c.total > 0 && c.llenos === c.total);
                pills[i].title = `${c.llenos} de ${c.total} campos completos`;
            });
            const pct = total ? Math.round((llenos / total) * 100) : 0;
            nav.querySelector('.form-progress-pct').textContent = `${pct}%`;
            nav.querySelector('.form-progress-bar span').style.width = `${pct}%`;
        };
        form.addEventListener('input', actualizar);
        form.addEventListener('change', actualizar);
        form.addEventListener('reset', () => setTimeout(actualizar, 0));
        // Los datos cargados por código (paciente, PDF, JSON) no disparan eventos
        setInterval(actualizar, 1500);
        actualizar();

        if ('IntersectionObserver' in window) {
            const obs = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    const i = secciones.indexOf(entry.target);
                    pills.forEach((p, j) => p.classList.toggle('active', j === i));
                    pills[i].scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
                });
            }, { rootMargin: '-35% 0px -55% 0px' });
            secciones.forEach(s => obs.observe(s));
        }
    }

    // ---------- Escala de dolor (EVA) como botones 1-10 ----------
    const COLORES_EVA = ['#2E9E5B', '#4CAF50', '#7CB342', '#C0CA33', '#F4B400', '#F59E0B', '#F57C00', '#EF6C00', '#E64A19', '#C62828'];

    function initEscalaDolor() {
        const select = document.getElementById('escalaDolor');
        if (!select || select.dataset.mejorado) return;
        select.dataset.mejorado = '1';

        const cont = document.createElement('div');
        cont.className = 'eva-scale';
        cont.setAttribute('role', 'radiogroup');
        cont.setAttribute('aria-label', 'Escala del dolor de 1 a 10');
        const botones = [];
        for (let i = 1; i <= 10; i++) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'eva-btn';
            b.textContent = i;
            b.style.setProperty('--eva-color', COLORES_EVA[i - 1]);
            b.setAttribute('role', 'radio');
            b.addEventListener('click', () => {
                select.value = select.value === String(i) ? '' : String(i);
                select.dispatchEvent(new Event('change', { bubbles: true }));
                sincronizar();
            });
            botones.push(b);
            cont.appendChild(b);
        }
        const leyenda = document.createElement('div');
        leyenda.className = 'eva-legend';

        const sincronizar = () => {
            const v = parseInt(select.value, 10);
            botones.forEach((b, i) => {
                const activo = v === i + 1;
                b.classList.toggle('selected', activo);
                b.setAttribute('aria-checked', activo ? 'true' : 'false');
            });
            const opt = select.selectedOptions[0];
            leyenda.textContent = v ? (opt ? opt.textContent : String(v)) : 'Sin seleccionar · 1 = muy leve, 10 = máximo';
            leyenda.style.color = v ? COLORES_EVA[v - 1] : '';
        };

        select.classList.add('eva-select-oculto');
        select.setAttribute('tabindex', '-1');
        select.setAttribute('aria-hidden', 'true');
        select.insertAdjacentElement('afterend', cont);
        cont.insertAdjacentElement('afterend', leyenda);
        select.addEventListener('change', sincronizar);
        select.form?.addEventListener('reset', () => setTimeout(sincronizar, 0));
        setInterval(sincronizar, 1500);
        sincronizar();
    }

    // ---------- Zonas de dolor ----------
    // Clasifica texto libre ("inserción del gastrocnemio bilateral", "parte medial del muslo derecho"…)
    // en regiones anatómicas. Tolera tildes, mayúsculas y errores de digitación frecuentes.
    const ZONAS_DOLOR = [
        { zona: 'Rodilla', patrones: [/rod[io]ll/, /rotul/, /patel/, /menisc/, /cruzado/, /\blca\b/, /poplite/, /condromalac/, /pata de ganso/, /cintilla/, /iliotibial/] },
        { zona: 'Tobillo / Aquiles', patrones: [/tobill/, /aquil/, /maleol/, /cuello del? pie/, /peroneo/, /inversion forzada/] },
        { zona: 'Pie', patrones: [/(?<!cuello del? )\bpies?\b/, /plantar/, /fasci/, /talon/, /metatar/, /metatrac/, /hall?ux/, /juanete/, /empeine/, /\bdedos? del pie/, /primer dedo/] },
        { zona: 'Pierna (gemelo / tibia)', patrones: [/pierna/, /peirna/, /gemel/, /gastrocnem/, /soleo/, /pantorrill/, /\btibia/, /tibial/, /perone/, /periostit/, /canilla/, /compartimental/] },
        { zona: 'Muslo', patrones: [/muslo/, /isquio/, /cuadricep/, /aductor/, /\bfemoral/, /\bfemur/, /recto anterior/] },
        // Incluye errores frecuentes al escribir "cadera" (cedar, cedra, cedera)
        { zona: 'Cadera / ingle / glúteo', patrones: [/cadera/, /\bced(ar|ra|era)\b/, /ingle/, /inguinal/, /pubi/, /pubalg/, /glute/, /nalga/, /piriforme/, /psoas/, /pelvi/, /trocant/, /iliac/] },
        { zona: 'Zona lumbar', patrones: [/lumba/, /espalda baja/, /baja de la espalda/, /cintura/, /\bl[1-5]\b/, /\bs1\b/, /sacr/, /ciati/, /coxis/] },
        { zona: 'Espalda media / tórax', patrones: [/dorsal/, /espalda media/, /espalda alta/, /alta de la espalda/, /pecho/, /costill/, /torac/, /escapul/, /omoplato/] },
        { zona: 'Cuello / cervical', patrones: [/cervic/, /\bcuello\b(?! del? pie)/, /trapecio/] },
        { zona: 'Hombro / brazo', patrones: [/hombro/, /manguito/, /supra ?espin/, /infra ?espin/, /glenohumer/, /labrum/, /deltoid/, /clavicul/, /acromi/, /\bbrazo/] },
        { zona: 'Codo / antebrazo', patrones: [/\bcodo/, /epicond/, /epitrocl/, /antebrazo/, /\bradio\b/, /\bcubito/] },
        { zona: 'Muñeca / mano', patrones: [/muneca/, /\bmanos?\b/, /pulgar/, /agarre/, /carpo/, /falange/] },
        { zona: 'Miembros inferiores (general)', patrones: [/miembros? inferior/, /\bpiernas\b/] }
    ];
    // Espalda sin zona precisa: sólo cuenta si no se detectó lumbar ni espalda media
    const ESPALDA_GENERAL = { zona: 'Espalda (sin especificar)', patrones: [/\bespalda\b/, /columna/, /escoliosis/] };
    const SIN_DOLOR = /^(no|ninguno|ninguna|n\/a|na|-|no refiere( dolor)?|sin dolor|no presenta( dolor)?)\.?$/;

    // Consultas sin zona de dolor: o no hay molestias, o es un chequeo / valoración de rendimiento
    const SIN_MOLESTIAS = [/sin (molestias|dolor|alteraciones)/, /no refiere (dolor|molestias)/, /no presenta (dolor|molestias)/, /asintomatic/, /^no\.?$/];
    const CHEQUEO = [/valoraci/, /evalua/, /evalci/, /chequeo/, /preparaci/, /rendi?e?mi?ento/, /fuerza/, /potencia/, /estado fisico/, /fo?r?talecimiento/, /record/, /maraton/, /running/, /perfil/, /movilidad/];

    function normalizar(texto) {
        return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
    }

    // 'sin_molestias' | 'chequeo' | null. Usar sólo cuando zonasDolor() no encontró ninguna zona.
    function tipoConsultaSinZona(texto) {
        const t = normalizar(texto);
        if (!t) return null;
        if (SIN_MOLESTIAS.some(p => p.test(t))) return 'sin_molestias';
        if (CHEQUEO.some(p => p.test(t))) return 'chequeo';
        return null;
    }

    function zonasDolor(texto) {
        const t = normalizar(texto);
        if (!t || SIN_DOLOR.test(t)) return [];
        const zonas = ZONAS_DOLOR.filter(z => z.patrones.some(p => p.test(t))).map(z => z.zona);
        const espaldaPrecisa = zonas.includes('Zona lumbar') || zonas.includes('Espalda media / tórax');
        if (!espaldaPrecisa && ESPALDA_GENERAL.patrones.some(p => p.test(t))) zonas.push(ESPALDA_GENERAL.zona);
        return zonas;
    }

    // ---------- Dolor (EVA) ----------
    // Usa el campo "escala del dolor"; si está vacío, busca "N/10" en el texto ("dolor 7/10 EVA").
    function evaDe(json) {
        const j = json || {};
        const campo = parseInt(j.escalaDolor, 10);
        if (campo >= 0 && campo <= 10 && String(j.escalaDolor).trim() !== '') return campo;
        const texto = `${j.refiereDolor || ''} ${j.motivoConsulta || ''} ${j.localizacionDolor || ''}`;
        const m = texto.match(/(?:^|[^\d])(10|[0-9])\s*\/\s*10\b/);
        return m ? parseInt(m[1], 10) : null;
    }

    // ---------- Deportes ----------
    // Agrupa el texto libre ("runnin g", "gym y running", "crossfir"…) en deportes.
    const DEPORTES = [
        { deporte: 'Running', patrones: [/\bru+n+i*n?g?\b/, /runn?i?n ?g/, /runnign/, /runing/, /corre/, /trot/, /atletismo/, /maraton/, /trail/] },
        { deporte: 'Gimnasio / fuerza', patrones: [/\bgym\b/, /gimnasi/, /gimansi/, /pesas/, /fuerza/, /fortalec/, /funcional/, /funsional/, /calis?tenia/, /calsitenia/, /hyrox/, /action black/, /ejercicio en casa/] },
        { deporte: 'CrossFit', patrones: [/cr[io]+ss? ?fi[tr]/] },
        { deporte: 'Ciclismo / BMX', patrones: [/cicli/, /ciclying/, /cicling/, /bici/, /bcicleta/, /spinning/, /\bbmx\b/] },
        { deporte: 'Triatlón', patrones: [/triatl/] },
        { deporte: 'Natación', patrones: [/natac/, /nadar/] },
        { deporte: 'Fútbol', patrones: [/futbol/] },
        { deporte: 'Hockey', patrones: [/ho[cg]?h?key/, /hochey/] },
        { deporte: 'Patinaje', patrones: [/patinaje/] },
        { deporte: 'Pilates / barre', patrones: [/pilates/, /\bbarre\b/, /yoga/] },
        { deporte: 'Baile / danza', patrones: [/bail/, /ballet/, /dan[sz]a/, /rumba/, /acrobacia/] },
        { deporte: 'Tenis', patrones: [/tenn?is/] },
        { deporte: 'Artes marciales / combate', patrones: [/jiu ?jitsu/, /mu[h]?ay ?tha[iy]/, /boxeo/, /kick ?boxing/, /karate/, /judo/] },
        { deporte: 'Baloncesto', patrones: [/baloncesto/, /basquet/] },
        { deporte: 'Voleibol', patrones: [/vol+e?y/, /voleibol/] },
        { deporte: 'Rugby', patrones: [/rugb/] },
        { deporte: 'Caminar / senderismo', patrones: [/camina/, /senderismo/] }
    ];
    const SIN_DEPORTE = /^(no|niega|ninguno|na|ko|sedentari[oa]|sedentarismo|no realiza( deporte)?|no,? iba al gym)\b/;

    // Devuelve { sinDeporte: true } o { deportes: [...] } (vacío si no se reconoce)
    function clasificarDeporte(texto) {
        const t = normalizar(texto).replace(/[,.;]+$/, '');
        if (!t) return { deportes: [] };
        if (SIN_DEPORTE.test(t) || /^sedentari/.test(t)) return { sinDeporte: true, deportes: [] };
        return { deportes: DEPORTES.filter(d => d.patrones.some(p => p.test(t))).map(d => d.deporte) };
    }

    // ---------- Piso pélvico ----------
    const MOTIVOS_PELVICOS = [
        { motivo: 'Embarazo', patrones: [/gestante/, /embaraz/, /gestacion/, /\bsemana \d/, /\d+ ?\+ ?\d/] },
        { motivo: 'Posparto', patrones: [/post ?parto/, /posparto/, /puerper/, /cesarea/] },
        { motivo: 'Incontinencia urinaria', patrones: [/incontinencia/, /escapes? (urinari|de orina)/, /goteo/, /perdida de orina/] },
        { motivo: 'Prolapso', patrones: [/prolapso/] },
        { motivo: 'Dolor sexual', patrones: [/dispareunia/, /vaginismo/, /dolor (a|en) la penetracion/] },
        { motivo: 'Estreñimiento / defecatorio', patrones: [/estren/, /hemorroid/, /incontinencia fecal/] },
        { motivo: 'Dolor pélvico / perineal', patrones: [/pelvic/, /perine/, /pubic/, /pubis/, /cocc?ix/, /coxis/, /vulv/] }
    ];

    // Motivo de una consulta del módulo de piso pélvico: categorías pélvicas o, si no hay,
    // 'Musculoesquelético' (Nataly también atiende cervicalgias, hombros, tobillos… con este formulario)
    function motivoPelvico(json) {
        const j = json || {};
        const pelvicos = t => MOTIVOS_PELVICOS.filter(m => m.patrones.some(p => p.test(t))).map(m => m.motivo);
        const dx = normalizar(j.dxMedico);
        const refiere = normalizar(j.refiereDolor);
        // Manda el Dx médico: el relato puede mencionar antecedentes (p. ej. un parto anterior)
        // que no son el motivo de la consulta
        const dxPelvico = pelvicos(dx);
        if (dxPelvico.length) {
            const extra = pelvicos(refiere).filter(m => !dxPelvico.includes(m));
            return { motivos: [...dxPelvico, ...extra], zonas: [] };
        }
        const dxZonas = zonasDolor(dx);
        if (dxZonas.length) return { motivos: ['Musculoesquelético'], zonas: dxZonas };
        const refPelvico = pelvicos(refiere);
        if (refPelvico.length) return { motivos: refPelvico, zonas: [] };
        const refZonas = zonasDolor(refiere);
        return { motivos: refZonas.length ? ['Musculoesquelético'] : [], zonas: refZonas };
    }

    function especialidadQueRemite(texto) {
        const t = normalizar(texto);
        if (!t || /^(no|ninguno|na|-)$/.test(t)) return null;
        if (/ginec/.test(t)) return 'Ginecología';
        if (/fisiatr/.test(t)) return 'Fisiatría';
        if (/urolog/.test(t)) return 'Urología';
        if (/ortoped/.test(t)) return 'Ortopedia';
        if (/coloproct|proctolog/.test(t)) return 'Coloproctología';
        if (/obstet/.test(t)) return 'Obstetricia';
        return 'Otro médico';
    }

    // ---------- Estilo de los reportes PDF (jsPDF + AutoTable) ----------
    const TEMAS_PDF = {
        pisada: {
            acento: [10, 148, 176], acentoClaro: [127, 227, 242], acentoSuave: [230, 246, 250],
            oscuro: [11, 20, 23], oscuro2: [15, 42, 49]
        },
        piso_pelvico: {
            acento: [142, 36, 170], acentoClaro: [240, 196, 247], acentoSuave: [245, 233, 248],
            oscuro: [20, 11, 23], oscuro2: [42, 15, 49]
        }
    };
    const PDF_BASE = {
        tinta: [15, 26, 31], tintaSuave: [91, 107, 115], tintaTenue: [138, 152, 159],
        linea: [227, 233, 236], etiqueta: [246, 248, 249]
    };

    const pdf = {
        // Logo ya preparado para el PDF: JPEG de 260 px sobre blanco (~10 KB).
        // El PNG original con transparencia ocupaba ~1 MB dentro del PDF porque jsPDF lo guarda sin comprimir.
        logoJpeg: null,

        cargarLogo() {
            if (pdf.logoJpeg || pdf._cargandoLogo) return pdf._cargandoLogo;
            pdf._cargandoLogo = new Promise(resolve => {
                const img = new Image();
                img.onload = () => {
                    const lado = 260;
                    const canvas = document.createElement('canvas');
                    canvas.width = lado;
                    canvas.height = lado;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, lado, lado);
                    ctx.drawImage(img, 0, 0, lado, lado);
                    pdf.logoJpeg = canvas.toDataURL('image/jpeg', 0.9);
                    resolve(pdf.logoJpeg);
                };
                img.onerror = () => resolve(null);
                img.src = 'kinetiq_logo.png';
            });
            return pdf._cargandoLogo;
        },

        tema(modulo) {
            return { ...PDF_BASE, ...(TEMAS_PDF[modulo] || TEMAS_PDF.pisada) };
        },

        // Prepara el documento: guarda el tema y aplica el estilo a todas las tablas
        preparar(doc, modulo) {
            const tema = pdf.tema(modulo);
            doc.__tema = tema;
            doc.__seccion = 0;
            const autoTableOriginal = doc.autoTable.bind(doc);
            doc.autoTable = (opts) => autoTableOriginal(pdf.estiloTabla(tema, opts));
            return tema;
        },

        estiloTabla(tema, opts) {
            const columnStyles = {};
            Object.entries(opts.columnStyles || {}).forEach(([k, st]) => {
                const esEtiqueta = st.fontStyle === 'bold';
                columnStyles[k] = {
                    ...st,
                    fillColor: esEtiqueta ? tema.etiqueta : [255, 255, 255],
                    textColor: esEtiqueta ? tema.tintaSuave : tema.tinta
                };
                if (esEtiqueta) columnStyles[k].fontSize = 8;
            });
            // Todas las tablas al ancho completo de la página (186 mm entre márgenes)
            const anchos = Object.values(columnStyles).map(c => c.cellWidth);
            if (anchos.length && anchos.every(w => typeof w === 'number')) {
                const total = anchos.reduce((a, b) => a + b, 0);
                if (total > 0 && Math.abs(total - 186) > 0.5) {
                    Object.values(columnStyles).forEach(c => { c.cellWidth = c.cellWidth * 186 / total; });
                }
            }
            const base = opts.styles || {};
            return {
                ...opts,
                theme: 'grid',
                styles: {
                    ...base,
                    font: 'helvetica',
                    fontSize: Math.min(base.fontSize || 9, 9),
                    textColor: tema.tinta,
                    lineColor: tema.linea,
                    lineWidth: 0.25,
                    cellPadding: { top: 3.4, bottom: 3.4, left: 3.6, right: 3.6 }
                },
                headStyles: undefined,
                alternateRowStyles: {},
                columnStyles
            };
        },

        // Encabezado oscuro de la primera página. Devuelve la Y donde empieza el contenido.
        encabezado(doc, { etiqueta, titulo, paciente, cedula }) {
            const t = doc.__tema;
            doc.setFillColor(...t.oscuro);
            doc.rect(0, 0, 210, 40, 'F');
            // Brillos de color (como en la app)
            try {
                doc.setGState(new doc.GState({ opacity: 0.22 }));
                doc.setFillColor(...t.acento);
                doc.circle(18, 2, 34, 'F');
                doc.setGState(new doc.GState({ opacity: 0.12 }));
                doc.setFillColor(...t.acentoClaro);
                doc.circle(200, 6, 24, 'F'); // dentro de la franja oscura (0-40 mm)
                doc.setGState(new doc.GState({ opacity: 1 }));
            } catch (e) {}
            doc.setFillColor(...t.acento);
            doc.rect(0, 39, 210, 1.2, 'F');

            doc.setFillColor(255, 255, 255);
            doc.roundedRect(12, 8, 24, 24, 3.5, 3.5, 'F');
            try {
                if (pdf.logoJpeg) doc.addImage(pdf.logoJpeg, 'JPEG', 13.5, 9.5, 21, 21);
                else doc.addImage('kinetiq_logo.png', 'PNG', 13.5, 9.5, 21, 21, undefined, 'FAST');
            } catch (e) {
                doc.setTextColor(...t.acento);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                doc.text('KS', 24, 22.5, { align: 'center' });
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(...t.acentoClaro);
            doc.text(etiqueta.toUpperCase(), 42, 16.5);
            doc.setFontSize(17);
            doc.setTextColor(255, 255, 255);
            doc.text(titulo, 42, 25);

            const fecha = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(160, 175, 182);
            doc.text('PACIENTE', 198, 14, { align: 'right' });
            doc.setFontSize(10.5);
            doc.setTextColor(255, 255, 255);
            doc.text(doc.splitTextToSize(paciente || 'Paciente', 70)[0], 198, 20.5, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(190, 202, 207);
            doc.text([cedula ? `CC ${cedula}` : '', fecha].filter(Boolean).join('  ·  '), 198, 26.5, { align: 'right' });
            return 52;
        },

        // Título de sección con número en insignia, como las tarjetas de los formularios
        seccion(doc, titulo, y) {
            const t = doc.__tema;
            doc.__seccion = (doc.__seccion || 0) + 1;
            const numero = String(doc.__seccion).padStart(2, '0');
            doc.setFillColor(...t.acentoSuave);
            doc.roundedRect(12, y, 8.5, 8, 2, 2, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(...t.acento);
            doc.text(numero, 16.25, y + 5.5, { align: 'center' });

            const texto = titulo.charAt(0) + titulo.slice(1).toLowerCase();
            doc.setFontSize(11);
            doc.setTextColor(...t.tinta);
            doc.text(texto, 24, y + 5.7);
            const fin = 24 + doc.getTextWidth(texto) + 4;
            doc.setDrawColor(...t.linea);
            doc.setLineWidth(0.3);
            if (fin < 198) doc.line(fin, y + 4, 198, y + 4);
        },

        // Encabezado de página de anexo (imágenes adjuntas)
        anexo(doc, nombre) {
            const t = doc.__tema;
            doc.__paginasAnexo = doc.__paginasAnexo || new Set();
            doc.__paginasAnexo.add(doc.getNumberOfPages());
            doc.setFillColor(...t.oscuro);
            doc.rect(0, 0, 210, 24, 'F');
            doc.setFillColor(...t.acento);
            doc.rect(0, 23, 210, 1, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(...t.acentoClaro);
            doc.text('ANEXO ADJUNTO', 14, 11);
            doc.setFontSize(11);
            doc.setTextColor(255, 255, 255);
            doc.text(doc.splitTextToSize(nombre || 'Archivo adjunto', 180)[0], 14, 17.5);
        },

        // Pie en todas las páginas y encabezado mínimo a partir de la segunda
        pie(doc, subtitulo, paciente) {
            const t = doc.__tema;
            const total = doc.getNumberOfPages();
            for (let i = 1; i <= total; i++) {
                doc.setPage(i);
                if (i > 1 && !doc.__paginasAnexo?.has(i)) {
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(7.5);
                    doc.setTextColor(...t.acento);
                    doc.text('KINETIQ SPORTS', 12, 10);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(...t.tintaTenue);
                    doc.text(paciente || '', 198, 10, { align: 'right' });
                    doc.setDrawColor(...t.linea);
                    doc.setLineWidth(0.3);
                    doc.line(12, 12.5, 198, 12.5);
                }
                doc.setDrawColor(...t.linea);
                doc.setLineWidth(0.3);
                doc.line(12, 281, 198, 281);
                doc.setFillColor(...t.acento);
                doc.roundedRect(12, 284.2, 2.2, 2.2, 0.6, 0.6, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7.5);
                doc.setTextColor(...t.tinta);
                doc.text('Kinetiq Sports', 16, 286);
                const ancho = doc.getTextWidth('Kinetiq Sports');
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...t.tintaTenue);
                doc.text(`·  ${subtitulo}  ·  Información clínica confidencial`, 16 + ancho + 1.5, 286);
                doc.text(`Página ${i} de ${total}`, 198, 286, { align: 'right' });
            }
        }
    };

    // ---------- Botones de opciones (reemplazan desplegables cortos) ----------
    // <select data-botones> se muestra como botones; data-botones="compacto" para filas de números.
    // El <select> sigue existiendo (oculto), así que guardar, cargar y el PDF no cambian.
    const ICONOS_OPCION = { si: '✓', no: '✕', femenino: '♀', masculino: '♂', parcialmente: '◐' };

    // Sexo: "♂ M", "♀ F" y "Otro ▾" con el resto de opciones (No binario, Intersexual…).
    // Al elegir una del menú, el tercer botón muestra su abreviatura (NB, IS, PND, N/E).
    const ABREVIATURAS_SEXO = { 'no binario': 'NB', intersexual: 'IS', 'prefiere no decir': 'PND', 'no especificado': 'N/E' };

    function initSelectorSexo(select) {
        const opciones = [...select.options].filter(o => o.value !== '');
        const principales = opciones.filter(o => ['masculino', 'femenino'].includes(normalizar(o.value)));
        const otras = opciones.filter(o => !principales.includes(o));
        select.dataset.mejorado = '1';

        const cont = document.createElement('div');
        cont.className = 'opt-botones sexo';
        cont.setAttribute('role', 'radiogroup');
        cont.setAttribute('aria-label', 'Sexo');

        const elegir = valor => {
            select.value = valor;
            select.dispatchEvent(new Event('input', { bubbles: true }));
            select.dispatchEvent(new Event('change', { bubbles: true }));
            sincronizar();
        };

        const botones = principales.map(o => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'opt-btn';
            b.setAttribute('role', 'radio');
            b.title = o.textContent.trim();
            const clave = normalizar(o.value);
            b.innerHTML = `<span class="opt-icono" aria-hidden="true">${ICONOS_OPCION[clave]}</span>${clave === 'masculino' ? 'M' : 'F'}`;
            b.addEventListener('click', () => elegir(select.value === o.value ? '' : o.value));
            cont.appendChild(b);
            return { b, valor: o.value };
        });

        // Botón "Otro" con su menú
        const envoltura = document.createElement('div');
        envoltura.className = 'opt-otro';
        const otro = document.createElement('button');
        otro.type = 'button';
        otro.className = 'opt-btn';
        otro.setAttribute('aria-haspopup', 'listbox');
        otro.setAttribute('aria-expanded', 'false');
        const menu = document.createElement('div');
        menu.className = 'opt-menu';
        menu.setAttribute('role', 'listbox');
        menu.hidden = true;
        otras.forEach(o => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'opt-menu-item';
            item.setAttribute('role', 'option');
            item.dataset.valor = o.value;
            const abrev = ABREVIATURAS_SEXO[normalizar(o.value)];
            item.innerHTML = `${escapeHtml(o.textContent.trim())}${abrev ? `<span>${abrev}</span>` : ''}`;
            item.addEventListener('click', () => {
                elegir(select.value === o.value ? '' : o.value);
                cerrarMenu();
                otro.focus();
            });
            menu.appendChild(item);
        });
        const abrirMenu = () => { menu.hidden = false; otro.setAttribute('aria-expanded', 'true'); };
        const cerrarMenu = () => { menu.hidden = true; otro.setAttribute('aria-expanded', 'false'); };
        otro.addEventListener('click', () => (menu.hidden ? abrirMenu() : cerrarMenu()));
        document.addEventListener('click', e => { if (!envoltura.contains(e.target)) cerrarMenu(); });
        envoltura.addEventListener('keydown', e => { if (e.key === 'Escape') { cerrarMenu(); otro.focus(); } });
        envoltura.appendChild(otro);
        envoltura.appendChild(menu);
        cont.appendChild(envoltura);

        const sincronizar = () => {
            botones.forEach(({ b, valor }) => {
                const activo = select.value === valor;
                b.classList.toggle('selected', activo);
                b.setAttribute('aria-checked', activo ? 'true' : 'false');
            });
            const elegidaOtra = otras.find(o => o.value === select.value);
            otro.classList.toggle('selected', !!elegidaOtra);
            otro.innerHTML = elegidaOtra
                ? `${escapeHtml(ABREVIATURAS_SEXO[normalizar(elegidaOtra.value)] || elegidaOtra.textContent.trim())}<span class="opt-flecha" aria-hidden="true">▾</span>`
                : `Otro<span class="opt-flecha" aria-hidden="true">▾</span>`;
            otro.title = elegidaOtra ? elegidaOtra.textContent.trim() : 'Otras opciones';
            menu.querySelectorAll('.opt-menu-item').forEach(i => i.classList.toggle('selected', i.dataset.valor === select.value));
        };

        select.classList.add('eva-select-oculto');
        select.setAttribute('tabindex', '-1');
        select.setAttribute('aria-hidden', 'true');
        select.insertAdjacentElement('afterend', cont);
        select.addEventListener('change', sincronizar);
        select.form?.addEventListener('reset', () => setTimeout(sincronizar, 0));
        setInterval(sincronizar, 1500);
        sincronizar();
    }

    function initBotonesOpciones() {
        document.querySelectorAll('select[data-botones]').forEach(select => {
            if (select.dataset.mejorado) return;
            if (select.dataset.botones === 'sexo') return initSelectorSexo(select);
            const opciones = [...select.options].filter(o => o.value !== '');
            if (!opciones.length) return;
            select.dataset.mejorado = '1';

            const cont = document.createElement('div');
            cont.className = 'opt-botones' + (select.dataset.botones === 'compacto' ? ' compacto' : '');
            // Piso pélvico: mismo formato que sus opciones de círculo (p. ej. "Deseo miccional")
            const estiloRadio = select.dataset.botones === 'si' && document.body.classList.contains('modulo-pelvico');
            if (estiloRadio) cont.classList.add('estilo-radio');
            cont.setAttribute('role', 'radiogroup');
            const label = select.id ? document.querySelector(`label[for="${select.id}"]`) : null;
            if (label) cont.setAttribute('aria-label', label.textContent.replace(/[:*]/g, '').trim());

            const botones = opciones.map(o => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'opt-btn';
                b.setAttribute('role', 'radio');
                const clave = normalizar(o.value);
                // Profesionales: ícono de profesional de la salud junto al nombre
                const icono = select.dataset.botones === 'profesional' ? (ICONO_PROFESIONAL[o.value] || '🧑‍⚕️') : ICONOS_OPCION[clave];
                // "-" del Lunge se muestra como signo menos tipográfico
                const compacto = select.dataset.botones === 'compacto';
                // data-corto: etiqueta abreviada en el botón; el valor guardado no cambia
                const texto = o.value === '-' ? '−' : (o.dataset.corto || (compacto ? o.value : o.textContent.trim()));
                if (compacto || o.dataset.corto) b.title = o.textContent.trim();
                if (estiloRadio) b.innerHTML = `<span class="opt-circulo" aria-hidden="true"></span>${escapeHtml(texto)}`;
                else b.innerHTML = icono ? `<span class="opt-icono" aria-hidden="true">${icono}</span>${escapeHtml(texto)}` : escapeHtml(texto);
                b.dataset.valor = o.value;
                if (clave === 'si') b.classList.add('opt-si');
                if (clave === 'no') b.classList.add('opt-no');
                b.addEventListener('click', () => {
                    // Volver a pulsar la opción marcada la desmarca (salvo si el select no admite vacío, p. ej. Nataly)
                    const admiteVacio = !!select.querySelector('option[value=""]');
                    select.value = select.value === o.value && admiteVacio ? '' : o.value;
                    select.dispatchEvent(new Event('input', { bubbles: true }));
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    sincronizar();
                });
                cont.appendChild(b);
                return b;
            });

            const sincronizar = () => {
                botones.forEach(b => {
                    const activo = b.dataset.valor === select.value;
                    b.classList.toggle('selected', activo);
                    b.setAttribute('aria-checked', activo ? 'true' : 'false');
                });
            };

            // Si la validación marca el campo como faltante (rojo), los botones también lo muestran
            new MutationObserver(() => cont.classList.toggle('field-missing', select.classList.contains('field-missing')))
                .observe(select, { attributes: true, attributeFilter: ['class'] });

            select.classList.add('eva-select-oculto');
            select.setAttribute('tabindex', '-1');
            select.setAttribute('aria-hidden', 'true');
            select.insertAdjacentElement('afterend', cont);
            select.addEventListener('change', sincronizar);
            select.form?.addEventListener('reset', () => setTimeout(sincronizar, 0));
            // Los datos cargados por código (paciente, PDF, JSON) no disparan eventos
            setInterval(sincronizar, 1500);
            sincronizar();
        });
    }

    // ---------- Texto del formulario siempre en MAYÚSCULAS ----------
    // Unifica cómo se ve lo escrito (en pantalla, en la base y en el PDF).
    const SELECTOR_TEXTO = '#reportForm input[type="text"], #reportForm input:not([type]), #reportForm textarea';

    function aMayusculas(el) {
        const mayus = el.value.toLocaleUpperCase('es');
        if (mayus === el.value) return;
        // Conservar la posición del cursor (la longitud no cambia)
        const inicio = el.selectionStart, fin = el.selectionEnd;
        el.value = mayus;
        if (document.activeElement === el && inicio != null) el.setSelectionRange(inicio, fin);
    }

    // También pasa a mayúsculas lo cargado de reportes anteriores antes de guardar o exportar
    function textoAMayusculas() {
        document.querySelectorAll(SELECTOR_TEXTO).forEach(aMayusculas);
    }

    function initMayusculas() {
        document.querySelectorAll(SELECTOR_TEXTO).forEach(el => el.setAttribute('autocapitalize', 'characters'));
        document.addEventListener('input', e => {
            if (e.target.matches && e.target.matches(SELECTOR_TEXTO)) aMayusculas(e.target);
        });
    }

    window.Kinetiq = {
        PROFESIONALES,
        MAX_ADJUNTO_MB,
        MAX_CARGA_MB,
        todosLosProfesionales,
        escapeHtml,
        sanitizeSearch,
        normalizarDias,
        descargarArchivo,
        descargarRespaldoJSON,
        normalizar,
        zonasDolor,
        tipoConsultaSinZona,
        evaDe,
        clasificarDeporte,
        motivoPelvico,
        especialidadQueRemite,
        textoAMayusculas,
        pdf
    };

    function initUI() {
        poblarProfesionales();
        poblarSelectsDias();
        initBotonesOpciones();
        initEscalaDolor();
        initProgresoFormulario();
        initMayusculas();
        // En los formularios, dejar listo el logo liviano para el PDF
        if (document.getElementById('reportForm')) pdf.cargarLogo();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }
})();
