import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/esm/index.js';

// Claves de proyecto de Supabase
const supabaseUrl = 'https://nihwpbxkwrndxubpqkes.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5paHdwYnhrd3JuZHh1YnBxa2VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1Njc3MDgsImV4cCI6MjA3MDE0MzcwOH0.MTl0cNJFxkevLJWOUCsSgNyFHSTf9rZ7yop-OQlSNpg';
const supabase = createClient(supabaseUrl, supabaseKey);

// Elementos del DOM
const gruposTableBody = document.getElementById('grupos-table-body');
const gruposSection = document.getElementById('grupos-table-section');
const manageGroupSection = document.getElementById('manage-group-section');
const manageGroupTitle = document.getElementById('manage-group-title');
const escuadrasList = document.getElementById('escuadras-list');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const backToGroupsBtn = document.getElementById('back-to-groups-btn');
const manageGroupHeader = document.querySelector('.actions-header');

let currentGroupId = null;
let currentRole = null;
let currentEscuadras = [];

// Función para crear un perfil si no existe
async function createProfileIfNotExists(userId) {
    const { data, error } = await supabase
        .from('perfiles')
        .select('id')
        .eq('id', userId);

    if (error && error.code !== 'PGRST116') {
        console.error('Error al buscar el perfil:', error);
        return false;
    }

    if (!data || data.length === 0) {
        const { error: insertError } = await supabase
            .from('perfiles')
            .insert({ id: userId, rol: 'miembro' }); 
        
        if (insertError) {
            console.error('Error al crear el perfil:', insertError);
            return false;
        }
    }
    return true;
}

// Función para renderizar todos los grupos en la tabla principal
async function renderGrupos(isAdmin = false) {
    if (!gruposTableBody) return;

    gruposSection.style.display = 'block';
    manageGroupSection.style.display = 'none';

    const { data: grupos, error } = await supabase
        .from('grupos')
        .select('*')
        .order('puntos_totales', { ascending: false });

    if (error) {
        console.error('Error al obtener los grupos:', error);
        gruposTableBody.innerHTML = '<tr><td colspan="3">Error al cargar los grupos.</td></tr>';
        return;
    }

    gruposTableBody.innerHTML = '';
    if (manageGroupHeader) {
        manageGroupHeader.style.display = isAdmin ? 'table-cell' : 'none';
    }

    grupos.forEach(grupo => {
        const row = document.createElement('tr');
        row.classList.add('group-row');
        let gestionBtn = '';
        if (isAdmin) {
            gestionBtn = `<td class="actions-cell"><button class="manage-btn" data-group-id="${grupo.id}">Gestionar</button></td>`;
        } else {
            gestionBtn = `<td class="actions-cell" style="display: none;"></td>`;
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

// Función para renderizar las escuadras y miembros dentro de un grupo (en la tabla principal)
async function renderEscuadrasEnGrupo(groupId, containerElement) {
    const { data: escuadras, error } = await supabase
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
        const { data: miembros, error: miembrosError } = await supabase
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
    containerElement.innerHTML = `<div class="escuadras-container">${escuadrasHtml}</div>`;
}

// Función para renderizar la vista de gestión (con edición en línea)
async function renderGrupoParaGestion(idGrupo, puedeEditar) {
    if (!manageGroupSection || !escuadrasList) return;

    gruposSection.style.display = 'none';
    manageGroupSection.style.display = 'block';

    const { data: grupo, error: grupoError } = await supabase
        .from('grupos')
        .select('*')
        .eq('id', idGrupo)
        .single();
    
    if (grupoError) {
        console.error('Error al obtener el grupo:', grupoError);
        manageGroupTitle.textContent = 'Error al cargar el grupo.';
        return;
    }
    
    manageGroupTitle.textContent = `Gestión de ${grupo.nombre} | Puntos Totales: ${grupo.puntos_totales || 0}`;

    const { data: escuadras, error: escuadrasError } = await supabase
        .from('escuadras')
        .select('*')
        .eq('id_grupo', idGrupo);

    if (escuadrasError) {
        console.error('Error al obtener las escuadras:', escuadrasError);
        escuadrasList.innerHTML = '<p>Error al cargar las escuadras.</p>';
        return;
    }
    
    currentEscuadras = escuadras;
    escuadrasList.innerHTML = '';

    for (const escuadra of escuadras) {
        const escuadraDiv = document.createElement('div');
        escuadraDiv.className = 'escuadra-tab expanded';
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
                ${puedeEditar ? `<button class="add-member-btn" data-escuadra-id="${escuadra.id}">Añadir Miembro</button>` : ''}
            </div>
        `;
        escuadrasList.appendChild(escuadraDiv);
        await renderMiembrosEnEscuadra(escuadra.id, `miembros-table-body-${escuadra.id}`, puedeEditar);
    }
}
    
// Función para renderizar miembros dentro de una escuadra
async function renderMiembrosEnEscuadra(idEscuadra, bodyId, puedeEditar) {
    const { data: miembros, error } = await supabase
        .from('miembros_del_clan')
        .select('*')
        .eq('id_escuadra', idEscuadra)
        .order('puntos', { ascending: false });

    if (error) {
        console.error('Error al obtener los miembros:', error);
        return;
    }

    const miembrosBody = document.getElementById(bodyId);
    if (!miembrosBody) return;
    
    miembrosBody.innerHTML = '';
    
    if (miembros.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td>N/A</td>
            <td>0</td>
            ${puedeEditar ? `<td><button class="add-member-btn" data-escuadra-id="${idEscuadra}">Añadir Miembro</button></td>` : ''}
        `;
        miembrosBody.appendChild(emptyRow);
    } else {
        miembros.forEach(miembro => {
            const row = document.createElement('tr');
            row.dataset.miembroId = miembro.id;
            let actionsCell = '';
            if (puedeEditar) {
                actionsCell = `
                    <td class="actions-cell">
                        <button class="edit-btn" data-id="${miembro.id}">Editar</button>
                        <button class="delete-btn" data-id="${miembro.id}">Expulsar</button>
                    </td>
                `;
            }
            row.innerHTML = `
                <td><span class="miembro-nombre">${miembro.nombre}</span></td>
                <td><span class="miembro-puntos">${miembro.puntos}</span></td>
                ${actionsCell}
            `;
            miembrosBody.appendChild(row);
        });
    }
}

// Manejo de eventos
document.addEventListener('DOMContentLoaded', () => {

    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            handleLogin(session);
        } else {
            handleLogout();
        }
    });

    async function handleLogin(session) {
        if(loginBtn) loginBtn.style.display = 'none';
        if(logoutBtn) logoutBtn.style.display = 'block';

        const profileCreated = await createProfileIfNotExists(session.user.id);
        if (!profileCreated) {
            console.error("No se pudo crear o verificar el perfil del usuario.");
            return handleLogout();
        }
        
        const { data: userProfile, error } = await supabase
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

        if (currentRole === 'admin') {
            await renderGrupos(true);
        } else {
            currentGroupId = userProfile.id_grupo;
            if (currentGroupId) {
                await renderGrupoParaGestion(currentGroupId, puedeEditar);
            } else {
                console.error("El usuario no tiene un ID de grupo asignado.");
                alert("Tu usuario no tiene un grupo asignado. Contacta a un administrador.");
                handleLogout();
            }
        }
    }

    function handleLogout() {
        if (loginBtn) loginBtn.style.display = 'block';
        if (logoutBtn) logoutBtn.style.display = 'none';
        renderGrupos(false); 
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email = prompt("Ingresa tu correo:");
            const password = prompt("Ingresa tu contraseña:");
            if (email && password) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) {
                    alert(`Error al iniciar sesión: ${error.message}`);
                    console.error(error);
                }
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
        });
    }

    if (backToGroupsBtn) {
        backToGroupsBtn.addEventListener('click', async () => {
            await renderGrupos(currentRole === 'admin');
        });
    }

    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('manage-btn')) {
            const groupIdToManage = e.target.dataset.groupId;
            currentGroupId = groupIdToManage;
            await renderGrupoParaGestion(groupIdToManage, true);
            return;
        }

        const groupRow = e.target.closest('.group-row');
        if (groupRow && !e.target.classList.contains('manage-btn')) {
            const groupId = groupRow.dataset.groupId;
            const expandedRow = gruposTableBody.querySelector(`.expanded-content[data-group-id="${groupId}"]`);
            
            if (expandedRow) {
                expandedRow.classList.toggle('hidden');
                if (!expandedRow.classList.contains('hidden')) {
                    const expandedContentTd = expandedRow.querySelector('td');
                    await renderEscuadrasEnGrupo(groupId, expandedContentTd);
                }
            }
            return;
        }
        
        // Manejo del botón de EDITAR
        if (e.target.classList.contains('edit-btn')) {
            const row = e.target.closest('tr');
            const miembroId = row.dataset.miembroId;
            const nombreSpan = row.querySelector('.miembro-nombre');
            const puntosSpan = row.querySelector('.miembro-puntos');

            // Crear campos de entrada
            const nombreInput = document.createElement('input');
            nombreInput.type = 'text';
            nombreInput.value = nombreSpan.textContent;
            nombreInput.className = 'edit-input';

            const puntosInput = document.createElement('input');
            puntosInput.type = 'number';
            puntosInput.value = puntosSpan.textContent;
            puntosInput.className = 'edit-input';

            // Reemplazar spans con inputs
            nombreSpan.replaceWith(nombreInput);
            puntosSpan.replaceWith(puntosInput);

            // Cambiar botón de 'Editar' a 'Guardar'
            e.target.textContent = 'Guardar';
            e.target.classList.remove('edit-btn');
            e.target.classList.add('save-btn');
        }

        // Manejo del botón de GUARDAR
        if (e.target.classList.contains('save-btn')) {
            const row = e.target.closest('tr');
            const miembroId = row.dataset.miembroId;
            const nombreInput = row.querySelector('input[type="text"]');
            const puntosInput = row.querySelector('input[type="number"]');
            
            const nuevoNombre = nombreInput.value;
            const nuevosPuntos = parseInt(puntosInput.value);

            const { error } = await supabase
                .from('miembros_del_clan')
                .update({ nombre: nuevoNombre, puntos: nuevosPuntos })
                .eq('id', miembroId);
            
            if (error) {
                alert('Error al guardar cambios.');
                console.error(error);
            } else {
                alert('Miembro actualizado con éxito.');
                await renderGrupoParaGestion(currentGroupId, true);
            }
        }
        
        // Manejo del botón de EXPULSAR
        if (e.target.classList.contains('delete-btn')) {
            const memberId = e.target.dataset.id;
            if (confirm('¿Estás seguro de que quieres expulsar a este miembro?')) {
                const { error } = await supabase
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

        // Manejo del botón de AÑADIR MIEMBRO
        if (e.target.classList.contains('add-member-btn')) {
            const escuadraId = e.target.dataset.escuadraId;
            const tableBody = e.target.closest('.miembros-section').querySelector('tbody');

            const newRow = document.createElement('tr');
            newRow.innerHTML = `
                <td><input type="text" placeholder="Nombre" class="new-member-name"></td>
                <td><input type="number" placeholder="Puntos" class="new-member-points"></td>
                <td>
                    <button class="save-new-member-btn" data-escuadra-id="${escuadraId}">Guardar</button>
                    <button class="cancel-new-member-btn">Cancelar</button>
                </td>
            `;
            tableBody.appendChild(newRow);
            e.target.style.display = 'none';
        }

        // Manejo del botón de GUARDAR (nuevo miembro)
        if (e.target.classList.contains('save-new-member-btn')) {
            const row = e.target.closest('tr');
            const escuadraId = e.target.dataset.escuadraId;
            const nombre = row.querySelector('.new-member-name').value;
            const puntos = parseInt(row.querySelector('.new-member-points').value);

            if (nombre && !isNaN(puntos)) {
                const { error } = await supabase
                    .from('miembros_del_clan')
                    .insert({ nombre, puntos, id_escuadra: escuadraId, id_grupo: currentGroupId });

                if (error) {
                    alert('Error al añadir miembro.');
                    console.error(error);
                } else {
                    alert('Miembro añadido con éxito.');
                    await renderGrupoParaGestion(currentGroupId, true);
                }
            } else {
                alert('Por favor, ingresa un nombre y puntos válidos.');
            }
        }
        
        // Manejo del botón de CANCELAR (nuevo miembro)
        if (e.target.classList.contains('cancel-new-member-btn')) {
            const row = e.target.closest('tr');
            const parentSection = row.closest('.miembros-section');
            const addBtn = parentSection.querySelector('.add-member-btn');
            
            row.remove();
            if (addBtn) addBtn.style.display = 'block';
        }
    });

    renderGrupos(false);
});