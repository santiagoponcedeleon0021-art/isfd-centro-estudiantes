let selectedCareerId = null;
let selectedYear = null;
let selectedMateria = null;
let cachedCareers = [];

let materiaChatChannel = null;
let materiaChatPollInterval = null;
let lastRenderedChatCount = 0;
let replyingToMessage = null;

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function attachImageFallbacks() {
    document.querySelectorAll('img').forEach(img => {
        img.addEventListener('error', function onImgError() {
            if (!this.dataset.fallbackApplied) {
                this.dataset.fallbackApplied = 'true';
                this.src = 'assets/img/logo.jpg';
            }
        }, { once: true });
    });
}

function loadIdentity() {
    const identity = JSON.parse(localStorage.getItem('isfd_identity')) || {
        logo: 'logo.jpg',
        name: 'Centro de Estudiantes',
        subtitle: 'ISFD Mercedes • Corrientes'
    };
    const titleEl = document.getElementById('brand-title');
    const subtitleEl = document.getElementById('brand-subtitle');
    const footerTitleEl = document.getElementById('footer-brand-title');

    if (titleEl) titleEl.innerText = identity.name;
    if (subtitleEl) subtitleEl.innerText = identity.subtitle;
    if (footerTitleEl) footerTitleEl.innerText = identity.name + ' - ISFD Mercedes';

    document.querySelectorAll('#nav-logo-img, .modal-logo-img, .footer-logo-img, #preview-logo-box').forEach(img => {
        if (img) img.src = identity.logo;
    });

    attachImageFallbacks();

    if (currentUser) {
        const favLink1 = document.getElementById('nav-favoritos-link');
        const favLink2 = document.getElementById('mobile-favoritos-link');
        if (favLink1) favLink1.classList.remove('hidden');
        if (favLink2) favLink2.classList.remove('hidden');
    } else {
        const favLink1 = document.getElementById('nav-favoritos-link');
        const favLink2 = document.getElementById('mobile-favoritos-link');
        if (favLink1) favLink1.classList.add('hidden');
        if (favLink2) favLink2.classList.add('hidden');
    }
}

async function switchView(viewId, param1, param2) {
    stopMateriaChatLiveUpdates();

    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    const targetView = document.getElementById('view-' + viewId);
    if (targetView) targetView.classList.remove('hidden');
    window.scrollTo(0, 0);

    if (viewId === 'home') {
        await renderHomeCareers();
        await renderHeroLatestNotice();
    } else if (viewId === 'novedades') {
        await renderPublicNovedades();
    } else if (viewId === 'carreras') {
        await renderCareersView(param1);
    } else if (viewId === 'materia') {
        selectedCareerId = param1;
        selectedYear = param2.anio;
        selectedMateria = param2.materia;
        lastRenderedChatCount = 0;
        await renderMateriaView();
        startMateriaChatLiveUpdates();
    } else if (viewId === 'favoritos') {
        await renderFavoritosView();
    } else if (viewId === 'solicitud') {
        await populateSolicitudCarreras();
    } else if (viewId === 'admin') {
        if (!currentUser || currentUser.role !== 'admin') {
            alert('Acceso no autorizado.');
            openLoginModal();
            switchView('home');
            return;
        }
        await renderAdminDashboard();
    }
    loadIdentity();
    updateNavAuth();
}

async function renderHeroLatestNotice() {
    const { data: novedades } = await _db.from('novedades').select('*').order('created_at', { ascending: false }).limit(1);
    const latest = novedades && novedades[0];
    const container = document.getElementById('hero-latest-notice');
    if (!container) return;
    if (!latest) {
        container.innerHTML = `<p class="text-xs text-indigo-200">No hay avisos recientes.</p>`;
        return;
    }
    container.innerHTML = `<p class="font-bold text-white">${escapeHtml(latest.titulo)}</p><p class="text-xs text-indigo-200 line-clamp-2">${escapeHtml(latest.descripcion)}</p>`;
}

async function renderPublicNovedades() {
    const { data: novedades } = await _db.from('novedades').select('*').order('created_at', { ascending: false });
    const avisosContainer = document.getElementById('public-novedades-list');
    const calendarioContainer = document.getElementById('public-calendario-list');
    if (!novedades) return;
    const avisos = novedades.filter(n => n.tipo === 'aviso');
    const fechas = novedades.filter(n => n.tipo === 'fecha');

    if (avisosContainer) {
        avisosContainer.innerHTML = avisos.length === 0
            ? `<p class="text-slate-500 text-sm">No hay comunicados.</p>`
            : avisos.map(a => `<div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-2"><span class="bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-1 rounded-full">Comunicado</span><h4 class="font-bold text-slate-900 text-lg">${escapeHtml(a.titulo)}</h4><p class="text-slate-600 text-sm leading-relaxed">${escapeHtml(a.descripcion)}</p></div>`).join('');
    }

    if (calendarioContainer) {
        calendarioContainer.innerHTML = fechas.length === 0
            ? `<p class="text-indigo-200 text-sm">No hay fechas agendadas.</p>`
            : fechas.map(f => `<div class="bg-indigo-950/60 rounded-2xl p-4 border border-indigo-500/30 space-y-1"><span class="text-[11px] font-bold text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full">${escapeHtml(f.fecha_txt || 'Próximamente')}</span><h4 class="font-bold text-white text-sm mt-1">${escapeHtml(f.titulo)}</h4><p class="text-xs text-indigo-200">${escapeHtml(f.descripcion)}</p></div>`).join('');
    }
}

async function renderHomeCareers() {
    const { data: careers } = await _db.from('carreras').select('*');
    cachedCareers = careers || [];
    const grid = document.getElementById('home-careers-grid');
    if (!grid) return;
    if (!careers || careers.length === 0) {
        grid.innerHTML = `<p class="col-span-full text-center text-slate-500">No hay carreras cargadas.</p>`;
        return;
    }

    grid.innerHTML = careers.map(car => `
        <div onclick="switchView('carreras', '${car.id}')" class="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between group">
            <div>
                <div class="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 text-xl group-hover:scale-110 transition-transform"><i class="fa-solid fa-graduation-cap"></i></div>
                <span class="text-[11px] font-bold text-indigo-600 uppercase">${escapeHtml(car.type)} • ${car.duration} Años</span>
                <h4 class="text-base sm:text-lg font-bold text-slate-900 mt-1">${escapeHtml(car.name)}</h4>
                <p class="text-xs text-slate-500 mt-2 line-clamp-2">${escapeHtml(car.description || car.title)}</p>
            </div>
            <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-indigo-600"><span>Ver apuntes</span><i class="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i></div>
        </div>
    `).join('');
}

async function renderCareersView(activeId) {
    const { data: careers } = await _db.from('carreras').select('*');
    if (!careers || careers.length === 0) return;
    cachedCareers = careers;
    const currentCar = careers.find(c => c.id === activeId) || careers[0];
    selectedCareerId = currentCar.id;

    const tabsContainer = document.getElementById('careers-tabs');
    if (tabsContainer) {
        tabsContainer.innerHTML = careers.map(car => `
            <button onclick="renderCareersView('${car.id}')" class="px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-semibold transition-all flex items-center space-x-2 ${car.id === currentCar.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200'}">
                <i class="fa-solid fa-graduation-cap"></i><span>${escapeHtml(car.name)}</span>
            </button>
        `).join('');
    }

    let yearsHtml = '';
    for (let i = 1; i <= currentCar.duration; i++) {
        const yearName = `${i}° Año`;
        const materias = currentCar.materias && currentCar.materias[yearName] ? currentCar.materias[yearName] : [];
        yearsHtml += `
            <div class="bg-white rounded-3xl border border-slate-200 p-5 sm:p-8 mb-6 shadow-sm">
                <div class="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                    <div class="flex items-center space-x-3"><div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">${i}°</div><h3 class="text-lg sm:text-xl font-bold text-slate-900">${yearName}</h3></div>
                    <span class="text-xs font-semibold bg-slate-100 text-slate-600 px-3 py-1 rounded-full">${materias.length} Materias</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${materias.length === 0 ? `<p class="text-xs text-slate-400 col-span-full">Sin materias cargadas.</p>` : materias.map(mat => `
                        <div onclick="switchView('materia', '${currentCar.id}', { anio: '${yearName}', materia: '${mat.replace(/'/g, "\\'")}' })" class="bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl p-4 sm:p-5 cursor-pointer transition-all flex flex-col justify-between group">
                            <div><span class="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">${yearName}</span><h4 class="font-bold text-slate-900 text-sm sm:text-base mt-2">${escapeHtml(mat)}</h4></div>
                            <div class="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs font-semibold text-indigo-600"><span>Acceder al Foro y Apuntes</span><i class="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    const detailContainer = document.getElementById('career-detail-container');
    if (detailContainer) {
        detailContainer.innerHTML = `<div class="bg-indigo-900 text-white rounded-3xl p-6 sm:p-8 mb-8 shadow-xl"><span class="text-xs font-semibold bg-indigo-500/30 text-indigo-200 px-3 py-1 rounded-full uppercase">${escapeHtml(currentCar.type)} • Título: ${escapeHtml(currentCar.title)}</span><h2 class="text-xl sm:text-3xl font-extrabold mt-3">${escapeHtml(currentCar.name)}</h2><p class="text-indigo-200 text-xs sm:text-sm mt-2">${escapeHtml(currentCar.description)}</p></div>${yearsHtml}`;
    }
}

async function renderMateriaView() {
    const { data: careers } = await _db.from('carreras').select('*');
    const car = careers ? careers.find(c => c.id === selectedCareerId) : null;
    const titleEl = document.getElementById('materia-title');
    const subtitleEl = document.getElementById('materia-subtitle');
    const backBtn = document.getElementById('btn-back-to-career');

    if (titleEl) titleEl.innerText = selectedMateria;
    if (subtitleEl) subtitleEl.innerText = `${car ? car.name : ''} • ${selectedYear}`;
    if (backBtn) backBtn.setAttribute('onclick', `switchView('carreras', '${selectedCareerId}')`);

    const chatAutor = document.getElementById('chat-autor');
    if (chatAutor) {
        if (currentUser) {
            chatAutor.value = currentUser.name || currentUser.username;
            chatAutor.readOnly = true;
        } else {
            chatAutor.value = '';
            chatAutor.readOnly = false;
        }
    }

    await filterApuntes();
    await renderMateriaChat();
}

async function filterApuntes() {
    const searchInput = document.getElementById('search-apuntes');
    const query = searchInput ? searchInput.value.toLowerCase() : '';
    const { data: apuntes } = await _db.from('apuntes').select('*').eq('carrera', selectedCareerId).eq('anio', selectedYear).eq('materia', selectedMateria);

    let userFavs = [];
    if (currentUser) {
        const { data: favs } = await _db.from('favoritos').select('apunte_id').eq('usuario', currentUser.username || currentUser.name);
        if (favs) userFavs = favs.map(f => f.apunte_id);
    }

    const container = document.getElementById('apuntes-list-container');
    if (!container) return;
    if (!apuntes || apuntes.length === 0) {
        container.innerHTML = `<div class="col-span-full py-12 text-center bg-white rounded-3xl border border-slate-200 p-8"><p class="text-slate-500 text-sm">No hay apuntes cargados todavía.</p></div>`;
        return;
    }

    const filtered = apuntes.filter(a => a.titulo.toLowerCase().includes(query) || (a.descripcion && a.descripcion.toLowerCase().includes(query)));

    container.innerHTML = filtered.map(ap => {
        const isFav = userFavs.includes(ap.id);
        return `
            <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between relative">
                ${currentUser ? `<button onclick="toggleFavorito(${ap.id})" class="absolute top-6 right-6 text-xl ${isFav ? 'text-rose-500' : 'text-slate-300 hover:text-rose-400'}"><i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i></button>` : ''}
                <div>
                    <div class="flex items-center space-x-2 mb-3">
                        <span class="text-xs font-bold px-3 py-1 rounded-full border ${ap.tipo === 'PDF' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-blue-50 text-blue-600 border-blue-200'}">${escapeHtml(ap.tipo)}</span>
                    </div>
                    <h4 class="font-bold text-slate-900 text-base pr-8">${escapeHtml(ap.titulo)}</h4>
                    <p class="text-slate-600 text-xs mt-2">${escapeHtml(ap.descripcion || '')}</p>
                </div>
                <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div class="flex space-x-1 text-slate-300 text-xs cursor-pointer">
                        <span onclick="calificarApunte(${ap.id}, 1)" class="hover:text-amber-400">★</span>
                        <span onclick="calificarApunte(${ap.id}, 2)" class="hover:text-amber-400">★</span>
                        <span onclick="calificarApunte(${ap.id}, 3)" class="hover:text-amber-400">★</span>
                        <span onclick="calificarApunte(${ap.id}, 4)" class="hover:text-amber-400">★</span>
                        <span onclick="calificarApunte(${ap.id}, 5)" class="hover:text-amber-400">★</span>
                    </div>
                    <a href="${ap.file_url}" target="_blank" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-md">Descargar</a>
                </div>
            </div>
        `;
    }).join('');
}

async function toggleFavorito(apunteId) {
    if (!currentUser) return alert('Iniciá sesión para guardar favoritos.');
    const username = currentUser.username || currentUser.name;
    const { data: existing } = await _db.from('favoritos').select('*').eq('usuario', username).eq('apunte_id', apunteId);
    if (existing && existing.length > 0) {
        await _db.from('favoritos').delete().eq('usuario', username).eq('apunte_id', apunteId);
    } else {
        await _db.from('favoritos').insert([{ usuario: username, apunte_id: apunteId }]);
    }
    await filterApuntes();
}

async function calificarApunte(apunteId, nota) {
    alert(`¡Gracias por calificar con ${nota} estrellas!`);
}

async function renderFavoritosView() {
    if (!currentUser) { switchView('home'); return; }
    const username = currentUser.username || currentUser.name;
    const { data: favs } = await _db.from('favoritos').select('apunte_id').eq('usuario', username);
    const container = document.getElementById('favoritos-list-container');
    if (!container) return;

    if (!favs || favs.length === 0) {
        container.innerHTML = `<div class="col-span-full py-12 text-center bg-white rounded-3xl border border-slate-200 p-8"><p class="text-slate-500 text-sm">No guardaste ningún apunte en favoritos todavía.</p></div>`;
        return;
    }

    const apunteIds = favs.map(f => f.apunte_id);
    const { data: apuntes } = await _db.from('apuntes').select('*').in('id', apunteIds);

    container.innerHTML = apuntes.map(ap => `
        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between relative">
            <button onclick="toggleFavorito(${ap.id}); renderFavoritosView();" class="absolute top-6 right-6 text-xl text-rose-500"><i class="fa-solid fa-heart"></i></button>
            <div>
                <span class="text-xs font-bold px-3 py-1 rounded-full border bg-rose-50 text-rose-600 border-rose-200">${escapeHtml(ap.tipo)}</span>
                <h4 class="font-bold text-slate-900 text-base mt-3 pr-8">${escapeHtml(ap.titulo)}</h4>
                <p class="text-slate-600 text-xs mt-2">${escapeHtml(ap.descripcion || '')}</p>
            </div>
            <div class="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                <a href="${ap.file_url}" target="_blank" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-md">Descargar</a>
            </div>
        </div>
    `).join('');
}

// --- FORO DE MATERIA EN TIEMPO REAL, CITAS Y MODERACIÓN ---
function stopMateriaChatLiveUpdates() {
    if (materiaChatChannel) {
        _db.removeChannel(materiaChatChannel);
        materiaChatChannel = null;
    }
    if (materiaChatPollInterval) {
        clearInterval(materiaChatPollInterval);
        materiaChatPollInterval = null;
    }
    clearChatReply();
}

function startMateriaChatLiveUpdates() {
    stopMateriaChatLiveUpdates();
    if (!selectedCareerId || !selectedYear || !selectedMateria) return;

    const channelName = `chat-${selectedCareerId}-${selectedYear}-${selectedMateria}`.replace(/[^a-zA-Z0-9_-]/g, '_');

    materiaChatChannel = _db
        .channel(channelName)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'comentarios_materias',
                filter: `materia=eq.${selectedMateria}`
            },
            async (payload) => {
                const row = payload.new || payload.old;
                if (row && row.carrera === selectedCareerId && row.anio === selectedYear) {
                    await renderMateriaChat();
                } else if (!row) {
                    await renderMateriaChat();
                }
            }
        )
        .subscribe();

    materiaChatPollInterval = setInterval(async () => {
        if (document.visibilityState === 'visible') {
            await renderMateriaChat();
        }
    }, 4000);
}

function setReplyToMessage(autor, mensaje) {
    const cleanAutor = (autor || 'Compañero').trim();
    const cleanPreview = String(mensaje || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    replyingToMessage = {
        autor: cleanAutor,
        preview: cleanPreview + (String(mensaje || '').trim().length > 80 ? '...' : '')
    };

    const banner = document.getElementById('chat-reply-banner');
    const autorEl = document.getElementById('chat-reply-autor');
    const previewEl = document.getElementById('chat-reply-preview');
    const textarea = document.getElementById('chat-mensaje');

    if (banner && autorEl && previewEl) {
        autorEl.innerText = replyingToMessage.autor;
        previewEl.innerText = `"${replyingToMessage.preview}"`;
        banner.classList.remove('hidden');
    }

    if (textarea) {
        textarea.focus();
    }
}

function clearChatReply() {
    replyingToMessage = null;
    const banner = document.getElementById('chat-reply-banner');
    if (banner) banner.classList.add('hidden');
}

function handleChatKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const form = document.getElementById('form-materia-chat');
        if (form) {
            form.requestSubmit();
        }
    }
}

function formatChatMessageBody(rawText) {
    const text = String(rawText || '');
    const quoteMatch = text.match(/^>\s*@([^:]+):\s*"([^"]*)"\n\n([\s\S]*)$/);

    if (quoteMatch) {
        const quotedAuthor = escapeHtml(quoteMatch[1]);
        const quotedSnippet = escapeHtml(quoteMatch[2]);
        const replyBody = escapeHtml(quoteMatch[3]).replace(/\n/g, '<br>');

        return `
            <div class="bg-slate-100/90 border-l-2 border-indigo-500 rounded-r-lg px-2.5 py-1.5 mb-1.5 text-[11px] text-slate-600">
                <span class="font-semibold text-indigo-700">@${quotedAuthor}</span>
                <p class="italic text-slate-500 truncate">"${quotedSnippet}"</p>
            </div>
            <p class="text-slate-700 text-xs leading-relaxed break-anywhere">${replyBody}</p>
        `;
    }

    return `<p class="text-slate-700 text-xs leading-relaxed break-anywhere">${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
}

function getAutorIniciales(nombre) {
    if (!nombre) return 'AL';
    const partes = nombre.trim().split(/\s+/);
    return partes.length >= 2
        ? (partes[0][0] + partes[1][0]).toUpperCase()
        : nombre.trim().slice(0, 2).toUpperCase();
}

async function renderMateriaChat() {
    if (!selectedCareerId || !selectedYear || !selectedMateria) return;

    const { data: coms, error } = await _db
        .from('comentarios_materias')
        .select('*')
        .eq('carrera', selectedCareerId)
        .eq('anio', selectedYear)
        .eq('materia', selectedMateria)
        .order('created_at', { ascending: true });

    if (error) return;

    const list = document.getElementById('materia-chat-list');
    const countBadge = document.getElementById('chat-count-badge');
    if (!list) return;

    const currentCount = coms ? coms.length : 0;
    if (countBadge) countBadge.innerText = currentCount;

    const isNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    const hasNewMessages = currentCount > lastRenderedChatCount;

    if (!coms || coms.length === 0) {
        lastRenderedChatCount = 0;
        list.innerHTML = `
            <div class="text-center py-8 px-4 space-y-1.5">
                <div class="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto text-sm">
                    <i class="fa-regular fa-comment-dots"></i>
                </div>
                <p class="text-slate-600 font-semibold text-xs">Todavía no hay consultas</p>
                <p class="text-slate-400 text-[11px]">¡Dejá la primera pregunta o dato útil sobre la materia!</p>
            </div>
        `;
        return;
    }

    const isAdmin = currentUser && currentUser.role === 'admin';
    const currentDisplayName = currentUser ? (currentUser.name || currentUser.username) : null;

    list.innerHTML = coms.map(c => {
        const esMio = currentDisplayName && c.autor === currentDisplayName;
        const iniciales = getAutorIniciales(c.autor);
        const fechaFormateada = c.created_at ? new Date(c.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : '';

        const baseForQuote = String(c.mensaje || '').replace(/^>\s*@[^:]+:\s*"[^"]*"\n\n/, '');
        const encodedAutor = encodeURIComponent(c.autor || '');
        const encodedMsg = encodeURIComponent(baseForQuote);

        return `
            <div class="chat-message-item rounded-2xl p-3.5 border transition-colors ${
                esMio
                    ? 'bg-indigo-50/90 border-indigo-200/90 ml-3'
                    : 'bg-white border-slate-200/80 shadow-2xs mr-2'
            }">
                <div class="flex items-center justify-between gap-2 mb-1.5">
                    <div class="flex items-center space-x-2 min-w-0">
                        <span class="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
                            esMio
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-200 text-slate-700'
                        }">${iniciales}</span>
                        <span class="font-bold text-slate-800 text-[11px] truncate">${escapeHtml(c.autor)}</span>
                        ${esMio ? `<span class="text-[9px] font-semibold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-md">Vos</span>` : ''}
                    </div>
                    <div class="flex items-center space-x-2 flex-shrink-0">
                        <span class="text-[10px] text-slate-400">${fechaFormateada}</span>
                        <button type="button" onclick="setReplyToMessage(decodeURIComponent('${encodedAutor}'), decodeURIComponent('${encodedMsg}'))" class="text-slate-400 hover:text-indigo-600 transition-colors text-[11px]" title="Responder citando">
                            <i class="fa-solid fa-reply"></i>
                        </button>
                        ${isAdmin ? `<button type="button" onclick="deleteComentario(${c.id})" class="text-slate-400 hover:text-rose-600 transition-colors text-[11px]" title="Borrar mensaje del foro"><i class="fa-solid fa-trash"></i></button>` : ''}
                    </div>
                </div>
                <div class="pl-8">
                    ${formatChatMessageBody(c.mensaje)}
                </div>
            </div>
        `;
    }).join('');

    if (lastRenderedChatCount === 0 || hasNewMessages || isNearBottom) {
        list.scrollTop = list.scrollHeight;
    }
    lastRenderedChatCount = currentCount;
}

async function deleteComentario(id) {
    if (!currentUser || currentUser.role !== 'admin') return;
    if (!confirm('¿Eliminar este mensaje del foro?')) return;

    const { error } = await _db.from('comentarios_materias').delete().eq('id', id);
    if (error) {
        alert('Error al eliminar mensaje: ' + error.message);
        return;
    }
    await renderMateriaChat();
}

async function handleSendComentario(event) {
    event.preventDefault();
    const autor = document.getElementById('chat-autor').value.trim();
    const rawMensaje = document.getElementById('chat-mensaje').value.trim();
    if (!rawMensaje) return;

    const finalMensaje = replyingToMessage
        ? `> @${replyingToMessage.autor}: "${replyingToMessage.preview}"\n\n${rawMensaje}`
        : rawMensaje;

    const { error } = await _db.from('comentarios_materias').insert([{
        carrera: selectedCareerId,
        anio: selectedYear,
        materia: selectedMateria,
        autor,
        mensaje: finalMensaje
    }]);
    if (error) { alert('Error: ' + error.message); return; }

    document.getElementById('chat-mensaje').value = '';
    clearChatReply();
    await renderMateriaChat();
}

// --- SOLICITUD DE ALTA CON USUARIO Y CLAVE ELEGIDOS ---
async function populateSolicitudCarreras() {
    const { data: careers } = await _db.from('carreras').select('*');
    const select = document.getElementById('sol-carrera');
    if (careers && select) select.innerHTML = careers.map(car => `<option value="${car.id}">${escapeHtml(car.name)}</option>`).join('');
}

async function handleSolicitudSubmit(event) {
    event.preventDefault();
    const nombre = document.getElementById('sol-nombre').value.trim();
    const dni = document.getElementById('sol-dni').value.trim();
    const carrera = document.getElementById('sol-carrera').value;
    const anio = document.getElementById('sol-anio').value;
    const contacto = document.getElementById('sol-contacto').value.trim();
    const usuario = document.getElementById('sol-usuario').value.trim();
    const pass = document.getElementById('sol-pass').value;

    if (pass.length < 4) {
        alert('La contraseña debe tener al menos 4 caracteres.');
        return;
    }

    const { data: enAlumnos } = await _db.from('alumnos').select('id').eq('usuario', usuario);
    const { data: enSolicitudes } = await _db.from('solicitudes').select('id').eq('usuario', usuario);
    if ((enAlumnos && enAlumnos.length > 0) || (enSolicitudes && enSolicitudes.length > 0)) {
        alert('Ese nombre de usuario ya está en uso. Por favor elegí otro.');
        return;
    }

    const { error } = await _db.from('solicitudes').insert([{
        nombre, dni, carrera, anio, contacto, usuario, pass, estado: 'pendiente'
    }]);
    if (error) { alert('Error al enviar solicitud: ' + error.message); return; }

    alert('¡Solicitud enviada! Una vez que el Centro de Estudiantes valide tus datos, podrás ingresar con el usuario y contraseña que elegiste.');
    event.target.reset();
    switchView('home');
}

window.onload = async function() {
    loadIdentity();
    await switchView('home');
};