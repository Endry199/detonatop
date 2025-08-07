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

let currentGroupId = null;
let currentRole = null;
let currentEscuadras = [];

// Función para crear un perfil si no existe
async function createProfileIfNotExists(userId) {
    const { data, error } = await client
        .from('perfiles')
        .select('id')
        .eq('id', userId)
        .single();
    
    // Si el error es de "0 rows" (PGRST116), significa que no hay perfil, lo creamos
    if (error && error.code === 'PGRST116') { 
        console.log('No se encontró perfil, creando uno nuevo...');
        const { error: insertError } = await client
            .from('perfiles')
            .insert({ id: userId, rol: 'miembro' }); // Rol por defecto
        
        if (insertError) {
            console.error('Error al crear el perfil:', insertError);
            return false;
        }
    } else if (error) {
        // Otros errores al buscar el perfil
        console.error('Error al buscar el perfil:', error);
        return false;
    }
    return true;
}

document.addEventListener('DOMContentLoaded', () => {

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
        }
        
        if (manageGroupHeader) {
            if (isAdmin) {
                manageGroupHeader.style.display = 'table-cell';
            } else {
                manageGroupHeader.style.display = 'none';
            }
        }
        
        grupos.forEach(grupo => {
            const row = document.createElement('tr');
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
            if (gruposTableBody) gruposTableBody.appendChild(row);
        });
    }

    async function renderGrupoParaGestion(idGrupo, puedeEditar) {
        if (gruposSection) gruposSection.style.display = 'none';
        if (manageGroupSection) manageGroupSection.style.display = 'block';

        const { data: grupo, error: grupoError } = await client
            .from('grupos')
            .select('*')
            .eq('id', idGrupo)
            .single();
        
        if (grupoError) {
            console.error('Error al obtener el grupo:', grupoError);
            return;
        }
        
        if (manageGroupTitle) manageGroupTitle.textContent = `${grupo.nombre} | Puntos Totales: ${grupo.puntos_totales || 0}`;

        const { data: escuadras, error: escuadrasError } = await client
            .from('escuadras')
            .select('*')
            .eq('id_grupo', idGrupo);

        if (escuadrasError) {
            console.error('Error al obtener las escuadras:', escuadrasError);
            return;
        }
        
        currentEscuadras = escuadras;
        
        // Llenar el selector de escuadras para el formulario de añadir miembros
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

    client.auth.onAuthStateChange((event, session) => {
        if (session) {
            handleLogin(session);
        } else {
            handleLogout();
        }
    });

    async function handleLogin(session) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'block';

        // Llama a la nueva función para asegurar que el perfil exista
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
        const puedeEditar = (userProfile.rol === 'lider' || userProfile.rol === 'decano' || userProfile.rol === 'admin');

        if (userProfile.rol === 'admin') {
            if (gruposSection) gruposSection.style.display = 'block';
            if (manageGroupSection) manageGroupSection.style.display = 'none';
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
        if (loginBtn) loginBtn.style.display = 'block';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (gruposSection) gruposSection.style.display = 'block';
        if (manageGroupSection) manageGroupSection.style.display = 'none';
        renderGrupos(false); 
    }

    if (loginBtn) {
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
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await client.auth.signOut();
        });
    }

    if (updateMemberForm) {
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
                    await renderGrupoParaGestion(currentGroupId, (currentRole === 'lider' || currentRole === 'decano' || currentRole === 'admin'));
                }
                if (updateMemberForm) updateMemberForm.reset();
                if (memberNameInput) memberNameInput.value = '';
            }
        });
    }
    
    if (addMemberForm) {
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
                if (addMemberForm) addMemberForm.reset();
            }
        });
    }

    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('manage-btn')) {
            const groupIdToManage = e.target.closest('tr').dataset.groupId;
            currentGroupId = groupIdToManage;
            await renderGrupoParaGestion(groupIdToManage, true);
        }
        
        if (e.target.classList.contains('edit-btn')) {
            const memberId = e.target.dataset.id;
            const memberName = e.target.dataset.name;
            const memberPoints = e.target.dataset.points;
            
            if (memberIdInput) memberIdInput.value = memberId;
            if (memberNameInput) memberNameInput.value = memberName;
            if (memberPointsInput) memberPointsInput.value = memberPoints;
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
        if (escuadraTab && !e.target.classList.contains('edit-btn')) {
            escuadraTab.classList.toggle('expanded');
        }
    });

    renderGrupos(false);
});