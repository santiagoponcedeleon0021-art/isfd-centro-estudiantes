function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('admin-tab-' + tabName).classList.remove('hidden');

    document.querySelectorAll('[id^="tab-btn-"]').forEach(btn => {
        btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
        btn.classList.add('text-slate-600', 'hover:bg-slate-100');
    });
    const activeBtn = document.getElementById('tab-btn-' + tabName);
    if (activeBtn) {
        activeBtn.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
        activeBtn.classList.remove('text-slate-600', 'hover:bg-slate-100');
    }

    if (tabName === 'solicitudes') renderAdminSolicitudes();
    if (tabName === 'novedades') renderAdminNovedades();
    if (tabName === 'material') populateAdminMaterialForm();
    if (tabName === 'carreras') renderAdminCareers();
    if (tabName === 'alumnos') renderAdminAlumnos();
}

async function renderAdminDashboard() {
    await renderAdminSolicitudes();
    await renderAdminNovedades();
    await populateAdminMaterialForm();
    await renderAdminCareers();
    await renderAdminAlumnos();
}

// --- SOLICITUDES (CONSERVA USUARIO Y CLAVE PROPUESTOS) ---
async function renderAdminSolicitudes() {
    const { data: solicitudes } = await _db.from('solicitudes').select('*').eq('estado', 'pendiente');
    const container = document.getElementById('admin-solicitudes-list');
    const badge = document.getElementById('badge-solicitudes-count');
    if (badge) badge.innerText = solicitudes ? solicitudes.length : 0;
    if (!container) return;

    if (!solicitudes || solicitudes.length === 0) {
        container.innerHTML = `<p class="text-slate-500 text-sm py-4 text-center">No hay solicitudes pendientes.</p>`;
        return;
    }

    const { data: careers } = await _db.from('carreras').select('*');
    container.innerHTML = solicitudes.map(s => {
        const car = careers ? careers.find(c => c.id === s.carrera) : null;
        const propUser = s.usuario || (s.nombre.toLowerCase().split(' ')[0] + Math.floor(Math.random() * 900 + 100));

        return `
            <div class="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h4 class="font-bold text-slate-900">${s.nombre} <span class="text-xs font-normal text-slate-500">(DNI: ${s.dni})</span></h4>
                    <p class="text-xs text-slate-600">${car ? car.name : s.carrera} • ${s.anio}</p>
                    <p class="text-xs text-slate-600 mt-1"><i class="fa-brands fa-whatsapp text-emerald-600 mr-1"></i>Contacto: ${s.contacto || 'No indicado'}</p>
                    <p class="text-xs text-indigo-700 font-semibold mt-1">Usuario propuesto: <span class="font-mono bg-indigo-50 px-2 py-0.5 rounded">${propUser}</span></p>
                </div>
                <div class="flex items-center space-x-2 flex-shrink-0">
                    <button onclick="aprobarSolicitud(${s.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-md flex items-center space-x-1.5">
                        <i class="fa-solid fa-check"></i>
                        <span>Confirmar y Dar de Alta</span>
                    </button>
                    <button onclick="rechazarSolicitud(${s.id})" class="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-semibold px-3 py-2.5 rounded-xl" title="Rechazar solicitud">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function aprobarSolicitud(id) {
    const { data: s, error: fetchErr } = await _db.from('solicitudes').select('*').eq('id', id).single();
    if (fetchErr || !s) {
        alert('No se pudo obtener la solicitud.');
        return;
    }

    const username = s.usuario || (s.nombre.toLowerCase().split(' ')[0] + Math.floor(Math.random() * 900 + 100));
    const pass = s.pass || 'isfd2026';

    const { data: existentes } = await _db.from('alumnos').select('id').eq('usuario', username);
    if (existentes && existentes.length > 0) {
        alert(`El usuario "${username}" ya está registrado. Podés editarlo luego desde Alumnos.`);
        return;
    }

    const { error: errAlumno } = await _db.from('alumnos').insert([{
        nombre: s.nombre,
        dni: s.dni,
        carrera: s.carrera,
        anio: s.anio,
        usuario: username,
        pass: pass,
        contacto: s.contacto || ''
    }]);

    if (errAlumno) {
        alert('Error al dar de alta al alumno: ' + errAlumno.message);
        return;
    }

    await _db.from('solicitudes').delete().eq('id', id);
    alert(`¡Alumno "${s.nombre}" dado de alta! Ya puede ingresar con su usuario "${username}" y la contraseña que propuso.`);
    await renderAdminDashboard();
}

async function rechazarSolicitud(id) {
    if (!confirm('¿Rechazar y eliminar esta solicitud pendiente?')) return;
    await _db.from('solicitudes').delete().eq('id', id);
    await renderAdminSolicitudes();
}

// --- NOVEDADES (CREAR, EDITAR Y BORRAR) ---
async function renderAdminNovedades() {
    const { data: novedades } = await _db.from('novedades').select('*').order('created_at', { ascending: false });
    const container = document.getElementById('admin-novedades-list');
    if (!container) return;
    container.innerHTML = !novedades || novedades.length === 0
        ? `<p class="text-slate-500 text-sm">No hay publicaciones.</p>`
        : novedades.map(n => `
            <div class="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex justify-between items-start gap-3">
                <div>
                    <div class="flex items-center space-x-2">
                        <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${n.tipo === 'aviso' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}">${n.tipo === 'aviso' ? 'Comunicado' : 'Fecha'}</span>
                        ${n.fecha_txt ? `<span class="text-[11px] font-semibold text-slate-500">${n.fecha_txt}</span>` : ''}
                    </div>
                    <h4 class="font-bold text-slate-900 text-sm mt-1">${n.titulo}</h4>
                    <p class="text-xs text-slate-600 mt-1 line-clamp-2">${n.descripcion || ''}</p>
                </div>
                <div class="flex items-center space-x-1.5 flex-shrink-0">
                    <button onclick="openEditNovedadModal(${n.id})" class="text-indigo-600 hover:bg-indigo-50 text-xs px-3 py-1.5 rounded-lg bg-white border border-slate-200" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteNovedad(${n.id})" class="text-rose-600 hover:bg-rose-50 text-xs px-3 py-1.5 rounded-lg bg-white border border-slate-200" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `).join('');
}

async function handleSaveNovedad(event) {
    event.preventDefault();
    const tipo = document.getElementById('nov-tipo').value;
    const titulo = document.getElementById('nov-titulo').value;
    const fecha_txt = document.getElementById('nov-fecha-txt') ? document.getElementById('nov-fecha-txt').value : '';
    const descripcion = document.getElementById('nov-desc').value;
    const { error } = await _db.from('novedades').insert([{ tipo, titulo, fecha_txt, descripcion }]);
    if (error) { alert('Error al publicar: ' + error.message); return; }
    alert('¡Publicado!');
    event.target.reset();
    toggleNovFechaField();
    await renderAdminNovedades();
}

async function openEditNovedadModal(id) {
    const { data: nov, error } = await _db.from('novedades').select('*').eq('id', id).single();
    if (error || !nov) return;

    document.getElementById('edit-nov-id').value = nov.id;
    document.getElementById('edit-nov-tipo').value = nov.tipo;
    document.getElementById('edit-nov-titulo').value = nov.titulo;
    document.getElementById('edit-nov-fecha-txt').value = nov.fecha_txt || '';
    document.getElementById('edit-nov-desc').value = nov.descripcion || '';

    toggleEditNovFechaField();
    document.getElementById('edit-novedad-modal').classList.remove('hidden');
}

function closeEditNovedadModal() {
    document.getElementById('edit-novedad-modal').classList.add('hidden');
}

function toggleEditNovFechaField() {
    const tipo = document.getElementById('edit-nov-tipo').value;
    const divFecha = document.getElementById('div-edit-nov-fecha');
    if (tipo === 'fecha') divFecha.classList.remove('hidden');
    else divFecha.classList.add('hidden');
}

async function handleUpdateNovedad(event) {
    event.preventDefault();
    const id = document.getElementById('edit-nov-id').value;
    const tipo = document.getElementById('edit-nov-tipo').value;
    const titulo = document.getElementById('edit-nov-titulo').value.trim();
    const fecha_txt = tipo === 'fecha' ? document.getElementById('edit-nov-fecha-txt').value.trim() : '';
    const descripcion = document.getElementById('edit-nov-desc').value.trim();

    const { error } = await _db.from('novedades').update({ tipo, titulo, fecha_txt, descripcion }).eq('id', id);
    if (error) {
        alert('Error al actualizar novedad: ' + error.message);
        return;
    }

    closeEditNovedadModal();
    alert('¡Novedad actualizada!');
    await renderAdminNovedades();
}

async function deleteNovedad(id) {
    if (!confirm('¿Eliminar esta publicación?')) return;
    await _db.from('novedades').delete().eq('id', id);
    await renderAdminNovedades();
}

// --- MATERIAL DE ESTUDIO (SUBIR, LISTAR, EDITAR Y BORRAR) ---
async function populateAdminMaterialForm() {
    const { data: careers } = await _db.from('carreras').select('*');
    if (careers) {
        cachedCareers = careers;
        const select = document.getElementById('up-carrera');
        if (select) {
            select.innerHTML = careers.map(car => `<option value="${car.id}">${car.name}</option>`).join('');
            updateAdminMateriasSelect();
        }
    }
    await renderAdminApuntes();
}

function updateAdminMateriasSelect() {
    const carId = document.getElementById('up-carrera').value;
    const anio = document.getElementById('up-anio').value;
    const car = cachedCareers.find(c => c.id === carId);
    const matSelect = document.getElementById('up-materia');
    if (!matSelect) return;
    if (car && car.materias && car.materias[anio] && car.materias[anio].length > 0) {
        matSelect.innerHTML = car.materias[anio].map(m => `<option value="${m}">${m}</option>`).join('');
    } else {
        matSelect.innerHTML = `<option value="General">General</option>`;
    }
}

async function handleUploadMaterial(event) {
    event.preventDefault();
    const carrera = document.getElementById('up-carrera').value;
    const anio = document.getElementById('up-anio').value;
    const materia = document.getElementById('up-materia').value;
    const tipo = document.getElementById('up-tipo').value;
    const titulo = document.getElementById('up-titulo').value.trim();
    const descripcion = document.getElementById('up-desc').value.trim();
    const fileInput = document.getElementById('up-file');

    const file = fileInput.files[0];
    if (!file) return;

    const fileName = `${Date.now()}_${file.name}`;
    const { error: uploadErr } = await _db.storage.from('materiales').upload(fileName, file);
    if (uploadErr) {
        alert('Error al subir archivo: ' + uploadErr.message);
        return;
    }

    const { data: urlData } = _db.storage.from('materiales').getPublicUrl(fileName);

    const { error: insertErr } = await _db.from('apuntes').insert([{
        carrera, anio, materia, tipo, titulo, descripcion, file_url: urlData.publicUrl
    }]);

    if (insertErr) {
        alert('Error al guardar el apunte: ' + insertErr.message);
        return;
    }

    alert('¡Material subido con éxito!');
    event.target.reset();
    await populateAdminMaterialForm();
}

async function renderAdminApuntes() {
    const container = document.getElementById('admin-apuntes-list');
    if (!container) return;

    const filterInput = document.getElementById('admin-search-apuntes');
    const query = filterInput ? filterInput.value.toLowerCase().trim() : '';

    const { data: apuntes } = await _db.from('apuntes').select('*').order('id', { ascending: false });
    if (!apuntes || apuntes.length === 0) {
        container.innerHTML = `<p class="text-slate-500 text-sm">No hay apuntes cargados todavía.</p>`;
        return;
    }

    const filtered = apuntes.filter(ap =>
        ap.titulo.toLowerCase().includes(query) ||
        ap.materia.toLowerCase().includes(query) ||
        (ap.descripcion && ap.descripcion.toLowerCase().includes(query))
    );

    if (filtered.length === 0) {
        container.innerHTML = `<p class="text-slate-500 text-sm">No se encontraron apuntes con ese filtro.</p>`;
        return;
    }

    container.innerHTML = filtered.map(ap => {
        const car = cachedCareers.find(c => c.id === ap.carrera);
        const carName = car ? car.name : ap.carrera;
        return `
            <div class="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex justify-between items-start gap-3">
                <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-1.5 mb-1">
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${ap.tipo === 'PDF' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-blue-50 text-blue-600 border-blue-200'}">${ap.tipo}</span>
                        <span class="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">${ap.materia}</span>
                        <span class="text-[10px] text-slate-500">${carName} • ${ap.anio}</span>
                    </div>
                    <h4 class="font-bold text-slate-900 text-sm truncate">${ap.titulo}</h4>
                    ${ap.descripcion ? `<p class="text-xs text-slate-600 mt-0.5 line-clamp-2">${ap.descripcion}</p>` : ''}
                </div>
                <div class="flex items-center space-x-1.5 flex-shrink-0">
                    <a href="${ap.file_url}" target="_blank" class="text-slate-600 hover:bg-slate-200 text-xs px-2.5 py-1.5 rounded-lg bg-white border border-slate-200" title="Ver / Descargar"><i class="fa-solid fa-eye"></i></a>
                    <button onclick="openEditApunteModal(${ap.id})" class="text-indigo-600 hover:bg-indigo-50 text-xs px-2.5 py-1.5 rounded-lg bg-white border border-slate-200" title="Editar apunte"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteApunte(${ap.id}, '${ap.titulo.replace(/'/g, "\\'")}')" class="text-rose-600 hover:bg-rose-50 text-xs px-2.5 py-1.5 rounded-lg bg-white border border-slate-200" title="Eliminar apunte"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');
}

function updateEditApunteMateriasSelect(selectedMat = null) {
    const carId = document.getElementById('edit-ap-carrera').value;
    const anio = document.getElementById('edit-ap-anio').value;
    const car = cachedCareers.find(c => c.id === carId);
    const matSelect = document.getElementById('edit-ap-materia');
    if (!matSelect) return;

    let options = [];
    if (car && car.materias && car.materias[anio] && car.materias[anio].length > 0) {
        options = [...car.materias[anio]];
    } else {
        options = ['General'];
    }
    if (selectedMat && !options.includes(selectedMat)) {
        options.unshift(selectedMat);
    }

    matSelect.innerHTML = options.map(m => `<option value="${m}">${m}</option>`).join('');
    if (selectedMat) matSelect.value = selectedMat;
}

async function openEditApunteModal(id) {
    const { data: ap, error } = await _db.from('apuntes').select('*').eq('id', id).single();
    if (error || !ap) {
        alert('No se pudo cargar el apunte.');
        return;
    }

    if (cachedCareers.length === 0) {
        const { data: careers } = await _db.from('carreras').select('*');
        cachedCareers = careers || [];
    }

    const carSelect = document.getElementById('edit-ap-carrera');
    carSelect.innerHTML = cachedCareers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    document.getElementById('edit-ap-id').value = ap.id;
    document.getElementById('edit-ap-current-url').value = ap.file_url || '';
    carSelect.value = ap.carrera;
    document.getElementById('edit-ap-anio').value = ap.anio;
    updateEditApunteMateriasSelect(ap.materia);

    document.getElementById('edit-ap-tipo').value = ap.tipo;
    document.getElementById('edit-ap-titulo').value = ap.titulo;
    document.getElementById('edit-ap-desc').value = ap.descripcion || '';
    document.getElementById('edit-ap-file').value = '';

    document.getElementById('edit-apunte-modal').classList.remove('hidden');
}

function closeEditApunteModal() {
    document.getElementById('edit-apunte-modal').classList.add('hidden');
}

async function handleUpdateApunte(event) {
    event.preventDefault();
    const id = document.getElementById('edit-ap-id').value;
    const carrera = document.getElementById('edit-ap-carrera').value;
    const anio = document.getElementById('edit-ap-anio').value;
    const materia = document.getElementById('edit-ap-materia').value;
    const tipo = document.getElementById('edit-ap-tipo').value;
    const titulo = document.getElementById('edit-ap-titulo').value.trim();
    const descripcion = document.getElementById('edit-ap-desc').value.trim();
    const fileInput = document.getElementById('edit-ap-file');
    let file_url = document.getElementById('edit-ap-current-url').value;

    if (fileInput.files && fileInput.files.length > 0) {
        const newFile = fileInput.files[0];
        const newFileName = `${Date.now()}_${newFile.name}`;
        const { error: uploadErr } = await _db.storage.from('materiales').upload(newFileName, newFile);
        if (uploadErr) {
            alert('Error al subir el nuevo archivo: ' + uploadErr.message);
            return;
        }
        const { data: urlData } = _db.storage.from('materiales').getPublicUrl(newFileName);

        if (file_url && file_url.includes('/materiales/')) {
            const oldPath = decodeURIComponent(file_url.split('/materiales/')[1]);
            await _db.storage.from('materiales').remove([oldPath]);
        }
        file_url = urlData.publicUrl;
    }

    const { error } = await _db.from('apuntes').update({
        carrera, anio, materia, tipo, titulo, descripcion, file_url
    }).eq('id', id);

    if (error) {
        alert('Error al actualizar apunte: ' + error.message);
        return;
    }

    closeEditApunteModal();
    alert('¡Apunte actualizado correctamente!');
    await renderAdminApuntes();
}

async function deleteApunte(id, titulo) {
    if (!confirm(`¿Eliminar el apunte "${titulo}"? Se borrará también el archivo asociado.`)) return;

    const { data: ap } = await _db.from('apuntes').select('file_url').eq('id', id).single();

    await _db.from('favoritos').delete().eq('apunte_id', id);

    const { error } = await _db.from('apuntes').delete().eq('id', id);
    if (error) {
        alert('Error al eliminar apunte: ' + error.message);
        return;
    }

    if (ap && ap.file_url && ap.file_url.includes('/materiales/')) {
        const filePath = decodeURIComponent(ap.file_url.split('/materiales/')[1]);
        await _db.storage.from('materiales').remove([filePath]);
    }

    alert('Apunte eliminado.');
    await renderAdminApuntes();
}

// --- CARRERAS Y MATERIAS ---
async function renderAdminCareers() {
    const { data: careers } = await _db.from('carreras').select('*');
    cachedCareers = careers || [];
    const matCarSelect = document.getElementById('mat-car-select');
    if (matCarSelect) {
        matCarSelect.innerHTML = cachedCareers.map(car => `<option value="${car.id}">${car.name}</option>`).join('');
        updateMatAnioSelect();
    }

    const container = document.getElementById('admin-careers-list');
    if (!container) return;
    container.innerHTML = cachedCareers.map(car => {
        let years = '';
        for (let i = 1; i <= car.duration; i++) {
            const yKey = `${i}° Año`;
            const mats = (car.materias && car.materias[yKey]) ? car.materias[yKey] : [];
            years += `<div class="mt-2 pt-2 border-t border-slate-200"><span class="text-[11px] font-bold text-indigo-600">${yKey}</span><div class="flex flex-wrap gap-1 mt-1">${mats.map(m => `<span class="bg-white border text-slate-700 text-[10px] px-2 py-0.5 rounded-lg flex items-center">${m}<button onclick="deleteMateria('${car.id}', '${yKey}', '${m.replace(/'/g, "\\'")}')" class="ml-1 text-rose-500 font-bold">×</button></span>`).join('')}</div></div>`;
        }
        return `<div class="bg-slate-50 rounded-2xl border border-slate-200 p-4"><div class="flex justify-between items-center"><h4 class="font-bold text-slate-900 text-sm">${car.name}</h4><button onclick="deleteCareer('${car.id}')" class="text-rose-600 text-xs px-2 py-1 rounded bg-white border">Eliminar</button></div>${years}</div>`;
    }).join('');
}

function updateMatAnioSelect() {
    const carId = document.getElementById('mat-car-select').value;
    const car = cachedCareers.find(c => c.id === carId);
    if (!car) return;
    let opts = '';
    for (let i = 1; i <= car.duration; i++) opts += `<option value="${i}° Año">${i}° Año</option>`;
    const anioSelect = document.getElementById('mat-anio-select');
    if (anioSelect) anioSelect.innerHTML = opts;
}

async function handleAddMateria(event) {
    event.preventDefault();
    const carId = document.getElementById('mat-car-select').value;
    const anio = document.getElementById('mat-anio-select').value;
    const nuevaMateria = document.getElementById('mat-nombre-input').value.trim();
    const { data: car } = await _db.from('carreras').select('*').eq('id', carId).single();
    let mats = car.materias || {};
    if (!mats[anio]) mats[anio] = [];
    mats[anio].push(nuevaMateria);
    await _db.from('carreras').update({ materias: mats }).eq('id', carId);
    alert('¡Materia agregada!');
    document.getElementById('mat-nombre-input').value = '';
    await renderAdminCareers();
}

async function deleteMateria(carId, anio, matName) {
    const { data: car } = await _db.from('carreras').select('*').eq('id', carId).single();
    let mats = car.materias || {};
    mats[anio] = mats[anio].filter(m => m !== matName);
    await _db.from('carreras').update({ materias: mats }).eq('id', carId);
    await renderAdminCareers();
}

async function handleSaveCareer(event) {
    event.preventDefault();
    const name = document.getElementById('car-nombre').value;
    const type = document.getElementById('car-tipo').value;
    const duration = parseInt(document.getElementById('car-duracion').value);
    const title = document.getElementById('car-titulo').value;
    const description = document.getElementById('car-desc').value;
    const matsText = document.getElementById('car-materias-init').value;
    let matsObj = {};
    const matsList = matsText ? matsText.split(',').map(m => m.trim()).filter(Boolean) : [];
    for (let i = 1; i <= duration; i++) matsObj[`${i}° Año`] = i === 1 ? matsList : [];
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15) + '_' + Date.now().toString().slice(-4);
    await _db.from('carreras').insert([{ id, name, type, duration, title, description, materias: matsObj }]);
    alert('¡Carrera creada!');
    event.target.reset();
    await renderAdminCareers();
}

async function deleteCareer(id) {
    if (!confirm('¿Eliminar carrera?')) return;
    await _db.from('carreras').delete().eq('id', id);
    await renderAdminCareers();
}

// --- ALUMNOS (LISTAR, EDITAR Y DAR DE BAJA) ---
async function renderAdminAlumnos() {
    const { data: alumnos } = await _db.from('alumnos').select('*').order('nombre', { ascending: true });
    const { data: careers } = await _db.from('carreras').select('*');
    const tbody = document.getElementById('admin-alumnos-tbody');
    if (!tbody) return;

    if (!alumnos || alumnos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-500">No hay alumnos registrados todavía.</td></tr>`;
        return;
    }

    tbody.innerHTML = alumnos.map(al => {
        const car = careers ? careers.find(c => c.id === al.carrera) : null;
        return `
            <tr class="border-b hover:bg-slate-50">
                <td class="p-3 font-bold text-slate-900">${al.nombre}</td>
                <td class="p-3 text-slate-600">${al.dni}</td>
                <td class="p-3 text-slate-600">${car ? car.name : al.carrera} <span class="text-xs bg-slate-100 px-2 py-0.5 rounded-full font-semibold">${al.anio}</span></td>
                <td class="p-3">
                    <span class="font-mono text-indigo-600 font-semibold">${al.usuario}</span>
                    ${al.contacto ? `<br><span class="text-xs text-slate-500"><i class="fa-brands fa-whatsapp text-emerald-600 mr-1"></i>${al.contacto}</span>` : ''}
                </td>
                <td class="p-3 text-center">
                    <div class="inline-flex items-center space-x-2">
                        <button onclick="openEditAlumnoModal(${al.id})" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-semibold" title="Editar usuario">
                            <i class="fa-solid fa-pen mr-1"></i>Editar
                        </button>
                        <button onclick="deleteAlumno(${al.id}, '${al.nombre.replace(/'/g, "\\'")}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-1.5 rounded-lg text-xs font-semibold" title="Dar de baja">
                            <i class="fa-solid fa-user-xmark mr-1"></i>Baja
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function openEditAlumnoModal(id) {
    const { data: al, error } = await _db.from('alumnos').select('*').eq('id', id).single();
    if (error || !al) {
        alert('No se pudo cargar el alumno.');
        return;
    }

    const { data: careers } = await _db.from('carreras').select('*');
    const carSelect = document.getElementById('edit-al-carrera');
    if (careers && carSelect) {
        carSelect.innerHTML = careers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    document.getElementById('edit-al-id').value = al.id;
    document.getElementById('edit-al-nombre').value = al.nombre;
    document.getElementById('edit-al-dni').value = al.dni;
    document.getElementById('edit-al-carrera').value = al.carrera;
    document.getElementById('edit-al-anio').value = al.anio;
    document.getElementById('edit-al-usuario').value = al.usuario;
    document.getElementById('edit-al-pass').value = al.pass;
    document.getElementById('edit-al-contacto').value = al.contacto || '';

    document.getElementById('edit-alumno-modal').classList.remove('hidden');
}

function closeEditAlumnoModal() {
    document.getElementById('edit-alumno-modal').classList.add('hidden');
}

async function handleUpdateAlumno(event) {
    event.preventDefault();
    const id = document.getElementById('edit-al-id').value;
    const nombre = document.getElementById('edit-al-nombre').value.trim();
    const dni = document.getElementById('edit-al-dni').value.trim();
    const carrera = document.getElementById('edit-al-carrera').value;
    const anio = document.getElementById('edit-al-anio').value;
    const usuario = document.getElementById('edit-al-usuario').value.trim();
    const pass = document.getElementById('edit-al-pass').value.trim();
    const contacto = document.getElementById('edit-al-contacto').value.trim();

    const { error } = await _db.from('alumnos').update({
        nombre, dni, carrera, anio, usuario, pass, contacto
    }).eq('id', id);

    if (error) {
        alert('Error al actualizar alumno: ' + error.message);
        return;
    }

    closeEditAlumnoModal();
    alert('¡Datos del alumno actualizados!');
    await renderAdminAlumnos();
}

async function deleteAlumno(id, nombre) {
    if (!confirm(`¿Seguro que querés dar de baja al alumno "${nombre}"? Perderá el acceso a la plataforma.`)) return;
    const { error } = await _db.from('alumnos').delete().eq('id', id);
    if (error) {
        alert('Error al dar de baja: ' + error.message);
        return;
    }
    alert('Alumno dado de baja correctamente.');
    await renderAdminAlumnos();
}

// --- IDENTIDAD ---
function handleSaveIdentity(event) {
    event.preventDefault();
    const name = document.getElementById('input-brand-name').value;
    const subtitle = document.getElementById('input-brand-subtitle').value;
    localStorage.setItem('isfd_identity', JSON.stringify({ logo: 'logo.jpg', name, subtitle }));
    loadIdentity();
    alert('¡Identidad guardada!');
}