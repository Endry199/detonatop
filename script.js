// Claves de proyecto de Supabase
const supabaseUrl = 'https://nihwpbxkwrndxubpqkes.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5paHdwYnhrd3JuZHh1YnBxa2VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1Njc3MDgsImV4cCI6MjA3MDE0MzcwOH0.MTl0cNJFxkevLJWOUCsSgNyFHSTf9rZ7yop-OQlSNpg';

// Accedemos a createClient a través del objeto global 'supabase'
const client = supabase.createClient(supabaseUrl, supabaseKey);

// Elementos del DOM
const gruposSection = document.getElementById('grupos-table-section');
const gruposTableBody = document.getElementById('grupos-table-body');
const manageGroupSection = document.getElementById('manage-group-section');
const manageGroupTitle = document.getElementById('manage-group-title');
const escuadrasList = document.getElementById('escuadras-list');
const updateMemberForm = document.getElementById('update-member-form');
const addMemberForm = document.getElementById('add-member-form');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const memberIdInput = document.getElementById('member-id');
const memberNameInput = document.getElementById('member-name');
const memberPointsInput = document.getElementById('member-points');
const addMemberNameInput = document.getElementById('add-member-name');
const addMemberPointsInput = document.getElementById('add-member-points');
const addMemberEscuadraSelect = document.getElementById('add-member-escuadra');
const manageGroupHeader = document.getElementById('manage-group-header');
const backToGroupsBtn = document.getElementById('back-to-groups-btn');
const addMemberSection = document.getElementById('add-member-section');
const updateMemberSection = document.getElementById('update-member-section');


let currentGroupId = null;
let currentRole = null;
let currentEscuadras = [];

// Función para crear un perfil si no existe
async function createProfileIfNotExists(userId) {
    const { error } = await client
        .from('perfiles')
        .insert({ id: userId, rol: 'miembro' })
        .select()
        .single()
        .ignoreDuplicates(); // Ignora si ya existe
    
    if (error && error.code !== '23505') { // 23505 es el código para "duplicado"
        console.error('Error al crear el perfil:', error);
        return false;
    }
    return true;
}

async function renderGrupos(isAdmin = false) {
    const { data: grupos, error } = await client
        .from('grupos')
        .select('*')
        .order('puntos_totales', { ascending: false });

    if (error) {
        console.error('Error al obtener los grupos:', error);
        return;
    }

    if (gruposTableBody) {
        gruposTableBody.innerHTML = '';
        manageGroupHeader.style.display = isAdmin ? 'table-cell' : 'none';
        
        grupos.forEach(grupo => {
            const row = document.createElement('tr');
            row.classList.add('group-row');
            let gestionBtn = '';
            if (isAdmin) {
                gestionBtn = `<td><button class="manage-btn">Gestionar</button></td>`;
            }
            row.innerHTML = `
                <td>${grupo.nombre}</td>
                <td>${grupo.puntos_totales || 0}</td>
                ${gestionBtn}
            `;
            row.dataset.groupId = grupo.id;
            gruposTableBody.appendChild(row);

            const expandedRow = document.createElement('tr');
            expandedRow.classList.add('expanded-content', 'hidden');
            expandedRow.dataset.groupId = grupo.id;
            expandedRow.innerHTML = `<td colspan="${isAdmin ? 3 : 2}"><div class="loading">Cargando...</div></td>`;
            gruposTableBody.appendChild(expandedRow);
        });
    }
}

async function renderEscuadrasEnGrupo(groupId, containerElement) {
    const { data: escuadras, error } = await client
        .from('escuadras')
        .select('*')
        .eq('id_grupo', groupId);

    if (error) {
        containerElement.innerHTML = `<td colspan="3">Error al cargar las escuadras.</td>`;
        console.error('Error al obtener las escuadras:', error);
        return;
    }

    if (escuadras.length === 0) {
        containerElement.innerHTML = `<td colspan="3">No hay escuadras en este grupo.</td>`;
        return;
    }

    let escuadrasHtml = '';
    for (const escuadra of escuadras) {
        const { data: miembros, error: miembrosError } = await client
            .from('miembros_del_clan')
            .select('*')
            .eq('id_escuadra', escuadra.id)
            .order('puntos', { ascending: false });

        if (miembrosError) {
            console.error('Error al obtener los miembros:', miembrosError);
            continue;
        }

        const miembrosHtml = miembros.map(miembro => `
            <div class="miembro-item">
                <span>${miembro.nombre}</span>
                <span>${miembro.puntos} pts.</span>
            </div>
        `).join('');

        escuadrasHtml += `
            <div class="escuadra-detail">
                <h4>${escuadra.nombre} (Puntos: ${escuadra.puntos_totales})</h4>
                <div class="miembros-list">${miembrosHtml}</div>
            </div>
        `;
    }
    containerElement.innerHTML = escuadrasHtml;
}


async function renderGrupoParaGestion(idGrupo, puedeEditar) {
    gruposSection.style.display = 'none';
    manageGroupSection.style.display = 'block';

    const { data: grupo, error: grupoError } = await client
        .from('grupos')
        .select('*')
        .eq('id', idGrupo)
        .single();
    
    if (grupoError) {
        console.error('Error al obtener el grupo:', grupoError);
        return;
    }
    
    manageGroupTitle.textContent = `Gestión de ${grupo.nombre} | Puntos Totales: ${grupo.puntos_totales || 0}`;

    const { data: escuadras, error: escuadrasError } = await client
        .from('escuadras')
        .select('*')
        .eq('id_grupo', idGrupo);

    if (escuadrasError) {
        console.error('Error al obtener las escuadras:', escuadrasError);
        return;
    }
    
    currentEscuadras = escuadras;
    
    if (addMemberEscuadraSelect) {
        addMemberEscuadraSelect.innerHTML = '<option value="">Selecciona Escuadra</option>';
        escuadras.forEach(escuadra => {
            const option = document.createElement('option');
            option.value = escuadra.id;
            option.textContent = escuadra.nombre;
            addMemberEscuadraSelect.appendChild(option);
        });
    }
    
    if (escuadrasList) escuadrasList.innerHTML = '';
    escuadras.forEach(escuadra => {
        const escuadraDiv = document.createElement('div');
        escuadraDiv.className = 'escuadra-tab';
        escuadraDiv.dataset.id = escuadra.id;
        escuadraDiv.innerHTML = `
            <h3 class="escuadra-name">${escuadra.nombre}</h3>
            <p class="escuadra-points">Puntos: ${escuadra.puntos_totales || 0} | Semanal: ${escuadra.puntos_semanales || 0}</p>
            <div class="miembros-section">
                <table>
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Puntos</th>
                            ${puedeEditar ? '<th>Acciones</th>' : ''}
                        </tr>
                    </thead>
                    <tbody id="miembros-table-body-${escuadra.id}"></tbody>
                </table>
            </div>
        `;
        if (escuadrasList) escuadrasList.appendChild(escuadraDiv);

        renderMiembrosEnEscuadra(escuadra.id, `miembros-table-body-${escuadra.id}`, puedeEditar);
    });
}
    
async function renderMiembrosEnEscuadra(idEscuadra, bodyId, puedeEditar) {
    const { data: miembros, error } = await client
        .from('miembros_del_clan')
        .select('*')
        .eq('id_escuadra', idEscuadra)
        .order('puntos', { ascending: false });

    if (error) {
        console.error('Error al obtener los miembros:', error);
        return;
    }

    const miembrosBody = document.getElementById(bodyId);
    if (miembrosBody) {
        miembrosBody.innerHTML = '';
        miembros.forEach(miembro => {
            const row = document.createElement('tr');
            let actionsCell = '';
            if (puedeEditar) {
                actionsCell = `
                    <td class="actions-cell">
                        <button class="edit-btn" data-id="${miembro.id}" data-name="${miembro.nombre}" data-points="${miembro.puntos}">Editar</button>
                        <button class="delete-btn" data-id="${miembro.id}">Expulsar</button>
                    </td>
                `;
            }
            row.innerHTML = `
                <td>${miembro.nombre}</td>
                <td>${miembro.puntos}</td>
                ${actionsCell}
            `;
            miembrosBody.appendChild(row);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {

    client.auth.onAuthStateChange((event, session) => {
        if (session) {
            handleLogin(session);
        } else {
            handleLogout();
        }
    });

    async function handleLogin(session) {
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'block';

        const profileCreated = await createProfileIfNotExists(session.user.id);
        if (!profileCreated) {
            console.error("No se pudo crear o verificar el perfil del usuario.");
            return handleLogout();
        }
        
        const { data: userProfile, error } = await client
            .from('perfiles')
            .select('rol, id_grupo')
            .eq('id', session.user.id)
            .single();

        if (error) {
            console.error('Error al obtener el perfil del usuario:', error);
            return;
        }
        
        currentRole = userProfile.rol;
        const puedeEditar = ['lider', 'decano', 'admin'].includes(currentRole);

        // Ocultar o mostrar las secciones de gestión según el rol
        addMemberSection.style.display = puedeEditar ? 'block' : 'none';
        updateMemberSection.style.display = puedeEditar ? 'block' : 'none';

        if (currentRole === 'admin') {
            gruposSection.style.display = 'block';
            manageGroupSection.style.display = 'none';
            renderGrupos(true); 
        } else {
            currentGroupId = userProfile.id_grupo;
            if (currentGroupId) {
                 await renderGrupoParaGestion(currentGroupId, puedeEditar);
            } else {
                 console.error("El usuario no tiene un ID de grupo asignado.");
                 handleLogout();
            }
        }
    }

    function handleLogout() {
        loginBtn.style.display = 'block';
        logoutBtn.style.display = 'none';
        gruposSection.style.display = 'block';
        manageGroupSection.style.display = 'none';
        renderGrupos(false); 
    }

    loginBtn.addEventListener('click', async () => {
        const email = prompt("Ingresa tu correo:");
        const password = prompt("Ingresa tu contraseña:");
        if (email && password) {
            const { error } = await client.auth.signInWithPassword({ email, password });
            if (error) {
                alert("Error al iniciar sesión: verifica tu correo y contraseña.");
                console.error(error);
            }
        }
    });

    logoutBtn.addEventListener('click', async () => {
        await client.auth.signOut();
    });

    backToGroupsBtn.addEventListener('click', async () => {
        gruposSection.style.display = 'block';
        manageGroupSection.style.display = 'none';
        await renderGrupos(currentRole === 'admin');
    });

    updateMemberForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const miembroId = memberIdInput.value;
        const puntos = parseInt(memberPointsInput.value);

        if (miembroId && !isNaN(puntos)) {
            const { error } = await client
                .from('miembros_del_clan')
                .update({ puntos: puntos })
                .eq('id', miembroId);

            if (error) {
                alert('Error al actualizar: Es posible que no tengas permiso o el ID no sea válido.');
                console.error(error);
            } else {
                alert('Puntos actualizados con éxito.');
                await renderGrupoParaGestion(currentGroupId, ['lider', 'decano', 'admin'].includes(currentRole));
            }
            updateMemberForm.reset();
            memberNameInput.value = '';
        }
    });
    
    addMemberForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = addMemberNameInput.value;
        const puntos = parseInt(addMemberPointsInput.value);
        const idEscuadra = addMemberEscuadraSelect.value;
        
        if (nombre && idEscuadra) {
            const { error } = await client
                .from('miembros_del_clan')
                .insert({ nombre: nombre, puntos: puntos, id_escuadra: idEscuadra, id_grupo: currentGroupId });
            
            if (error) {
                alert('Error al añadir miembro.');
                console.error(error);
            } else {
                alert('Miembro añadido con éxito.');
                await renderGrupoParaGestion(currentGroupId, true);
            }
            addMemberForm.reset();
        }
    });

    document.addEventListener('click', async (e) => {
        const groupRow = e.target.closest('.group-row');
        if (groupRow) {
            const groupId = groupRow.dataset.groupId;
            const expandedRow = gruposTableBody.querySelector(`.expanded-content[data-group-id="${groupId}"]`);
            
            if (expandedRow) {
                expandedRow.classList.toggle('hidden');
                if (!expandedRow.classList.contains('hidden')) {
                    await renderEscuadrasEnGrupo(groupId, expandedRow.querySelector('td'));
                }
            }
            return;
        }

        if (e.target.classList.contains('manage-btn')) {
            const groupIdToManage = e.target.closest('tr').dataset.groupId;
            currentGroupId = groupIdToManage;
            await renderGrupoParaGestion(groupIdToManage, true);
        }
        
        if (e.target.classList.contains('edit-btn')) {
            const memberId = e.target.dataset.id;
            const memberName = e.target.dataset.name;
            const memberPoints = e.target.dataset.points;
            
            memberIdInput.value = memberId;
            memberNameInput.value = memberName;
            memberPointsInput.value = memberPoints;
        }

        if (e.target.classList.contains('delete-btn')) {
            const memberId = e.target.dataset.id;
            if (confirm('¿Estás seguro de que quieres expulsar a este miembro?')) {
                const { error } = await client
                    .from('miembros_del_clan')
                    .delete()
                    .eq('id', memberId);

                if (error) {
                    alert('Error al expulsar miembro.');
                    console.error(error);
                } else {
                    alert('Miembro expulsado con éxito.');
                    await renderGrupoParaGestion(currentGroupId, true);
                }
            }
        }
        
        const escuadraTab = e.target.closest('.escuadra-tab');
        if (escuadraTab && e.target.tagName !== 'BUTTON') { // Evita que el clic en los botones colapse la sección
            escuadraTab.classList.toggle('expanded');
        }
    });

    renderGrupos(false);
});