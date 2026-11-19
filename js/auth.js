let currentUser = JSON.parse(localStorage.getItem('isfd_current_user')) || null;

function updateNavAuth() {
    const area = document.getElementById('auth-nav-area');
    if (!area) return;
    if (currentUser) {
        let adminBtn = currentUser.role === 'admin' ? `<button onclick="switchView('admin')" class="bg-indigo-700 hover:bg-indigo-600 text-white px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1"><i class="fa-solid fa-gauge"></i><span class="hidden sm:inline">Admin</span></button>` : '';
        area.innerHTML = `
            <div class="flex items-center space-x-2 sm:space-x-3">
                <div class="text-right hidden sm:block">
                    <p class="text-xs font-bold text-white">${currentUser.name || currentUser.username}</p>
                    <span class="text-[10px] text-indigo-200">${currentUser.role === 'admin' ? 'Administrador' : 'Estudiante'}</span>
                </div>
                ${adminBtn}
                <button onclick="logout()" class="text-indigo-300 hover:text-white p-2 text-sm" title="Salir"><i class="fa-solid fa-right-from-bracket"></i></button>
            </div>
        `;
    } else {
        area.innerHTML = `
            <button onclick="openLoginModal()" class="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm shadow-md flex items-center space-x-2">
                <i class="fa-solid fa-right-to-bracket"></i>
                <span>Ingresar</span>
            </button>
        `;
    }
}

async function handleLoginSubmit(event) {
    event.preventDefault();
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value.trim();

    if (u === 'admin' && p === 'admin123') {
        currentUser = { role: 'admin', username: 'admin', name: 'Administrador' };
        localStorage.setItem('isfd_current_user', JSON.stringify(currentUser));
        closeLoginModal();
        updateNavAuth();
        switchView('admin');
        return;
    }

    const { data: alumnos } = await _db.from('alumnos').select('*').eq('usuario', u).eq('pass', p);
    if (alumnos && alumnos.length > 0) {
        currentUser = { role: 'alumno', username: alumnos[0].usuario, name: alumnos[0].nombre };
        localStorage.setItem('isfd_current_user', JSON.stringify(currentUser));
        closeLoginModal();
        updateNavAuth();
        switchView('home');
        alert(`¡Bienvenido/a, ${alumnos[0].nombre}!`);
        return;
    }
    alert('Credenciales incorrectas.');
}

function logout() {
    currentUser = null;
    localStorage.removeItem('isfd_current_user');
    updateNavAuth();
    switchView('home');
}

function openLoginModal() { document.getElementById('login-modal').classList.remove('hidden'); }
function closeLoginModal() { document.getElementById('login-modal').classList.add('hidden'); }