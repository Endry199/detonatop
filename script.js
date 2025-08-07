// AVISO IMPORTANTE: No necesitas la línea de importación si usas el script global.
// La quitamos para evitar el error 404.
// import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/esm/index.js';

// Claves de proyecto de Supabase
const supabaseUrl = 'https://nihwpbxkwrndxubpqkes.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5paHdwYnhrd3JuZHh1YnBxa2VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1Njc3MDgsImV4cCI6MjA3MDE0MzcwOH0.MTl0cNJFxkevLJWOUCsSgNyFHSTf9rZ7yop-OQlSNpg';

// ✅ SOLUCIÓN: Usamos 'window.supabase' para acceder a la librería globalmente.
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Elementos del DOM
const gruposTableBody = document.getElementById('grupos-table-body');
const gruposSection = document.getElementById('grupos-table-section');
const manageGroupSection = document.getElementById('manage-group-section');
const manageGroupTitle = document.getElementById('manage-group-title');
const escuadrasList = document.getElementById('escuadras-list');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const backToGroupsBtn = document.getElementById('back-to-groups-btn');

let currentGroupId = null;
let currentRole = null;
let currentEscuadras = [];

// Función para crear un perfil si no existe
async function createProfileIfNotExists(userId) {
    const { data, error } = await supabase
        .from('perfiles')
        .select('id')
        .eq('id', userId);

    if (error && error.code !== 'PGRST116') { // PGRST116 es "no row found"
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
async function renderGrupos() {
    if (!gruposTableBody) return;

    gruposSection.style.display = 'block';
    manageGroupSection.style.display = 'none';

    const { data: grupos, error } = await supabase
        .from('grupos')
        .select('*')
        .order('puntos_totales', { ascending: false });

    if (error) {
        console.error('Error al obtener los grupos:', error);
        gruposTableBody.innerHTML = '<tr><td colspan="2">Error al cargar los grupos.</td></tr>';
        return;
    }

    gruposTableBody.innerHTML = '';

    grupos.forEach(grupo => {
        const row = document.createElement('tr');
        row.classList.add('group-row');
        row.innerHTML = `
            <td>${grupo.nombre}</td>
            <td>${grupo.puntos_totales || 0}</td>
        `;
        row.dataset.groupId = grupo.id;
        gruposTableBody.appendChild(row);

        const expandedRow = document.createElement('tr');
        expandedRow.classList.add('expanded-content', 'hidden');
        expandedRow.dataset.groupId = grupo.id;
        expandedRow.innerHTML = `<td colspan="2"><div class="loading">Cargando...</div></td>`;
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
        containerElement.innerHTML = `<td colspan="2">Error al cargar las escuadras.</td>`;
        console.error('Error al obtener las escuadras:', error);
        return;
    }

    if (escuadras.length === 0) {
        containerElement.innerHTML = `<td colspan="2">No hay escuadras en este grupo.</td>`;
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

// Función auxiliar para asegurar que el grupo tenga 3 escuadras y 4 miembros cada una
async function ensureGroupStructure(groupId) {
    const { data: escuadras, error: escuadrasError } = await supabase
        .from('escuadras')
        .select('*')
        .eq('id_grupo', groupId);

    if (escuadrasError) {
        console.error('Error al obtener escuadras para asegurar la estructura:', escuadrasError);
        return [];
    }

    // Crear escuadras si no hay 3
    let updatedEscuadras = [...escuadras];
    const missingSquadsCount = 3 - escuadras.length;
    if (missingSquadsCount > 0) {
        const newSquadsToInsert = [];
        for (let i = 0; i < missingSquadsCount; i++) {
            newSquadsToInsert.push({ 
                nombre: `Escuadra ${escuadras.length + 1 + i}`,
                id_grupo: groupId,
                puntos_totales: 0,
                puntos_semanales: 0
            });
        }
        const { data: newSquads, error: insertSquadsError } = await supabase
            .from('escuadras')
            .insert(newSquadsToInsert)
            .select();
        
        if (insertSquadsError) {
            console.error('Error al crear nuevas escuadras:', insertSquadsError);
        } else {
            updatedEscuadras = [...updatedEscuadras, ...newSquads];
        }
    }

    // Asegurar que cada escuadra tenga 4 miembros
    for (const escuadra of updatedEscuadras) {
        const { data: miembros, error: miembrosError } = await supabase
            .from('miembros_del_clan')
            .select('*')
            .eq('id_escuadra', escuadra.id);
        
        if (miembrosError) {
            console.error('Error al obtener miembros para asegurar la estructura:', miembrosError);
            continue;
        }

        const missingMembersCount = 4 - miembros.length;
        if (missingMembersCount > 0) {
            const newMembersToInsert = [];
            for (let i = 0; i < missingMembersCount; i++) {
                newMembersToInsert.push({
                    nombre: 'N/A',
                    puntos: 0,
                    id_escuadra: escuadra.id,
                    id_grupo: groupId
                });
            }
            const { error: insertMembersError } = await supabase
                .from('miembros_del_clan')
                .insert(newMembersToInsert);

            if (insertMembersError) {
                console.error('Error al crear nuevos miembros:', insertMembersError);
            }
        }
    }

    // Volver a obtener todas las escuadras y miembros para el renderizado final
    const { data: finalEscuadras, error: finalError } = await supabase
        .from('escuadras')
        .select(`
            *,
            miembros_del_clan (
                *
            )
        `)
        .eq('id_grupo', groupId);

    if (finalError) {
        console.error('Error al obtener la estructura final:', finalError);
        return [];
    }

    return finalEscuadras;
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

    // Aseguramos que la estructura del grupo esté completa antes de renderizar
    const escuadras = await ensureGroupStructure(idGrupo);
    
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
            </div>
        `;
        escuadrasList.appendChild(escuadraDiv);
        await renderMiembrosEnEscuadra(escuadra.id, `miembros-table-body-${escuadra.id}`, puedeEditar, escuadra.miembros_del_clan);
    }
}
    
// Función para renderizar miembros dentro de una escuadra
async function renderMiembrosEnEscuadra(idEscuadra, bodyId, puedeEditar, miembros) {
    const miembrosBody = document.getElementById(bodyId);
    if (!miembrosBody) return;
    
    miembrosBody.innerHTML = '';
    
    // Los miembros siempre estarán completos gracias a ensureGroupStructure
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
            await renderGrupos();
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
        renderGrupos(); 
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
            await renderGrupos();
        });
    }

    document.addEventListener('click', async (e) => {
        const groupRow = e.target.closest('.group-row');
        if (groupRow) {
            const groupId = groupRow.dataset.groupId;

            if (currentRole === 'admin') {
                // Si es admin, ir a la vista de gestión para ese grupo
                currentGroupId = groupId;
                await renderGrupoParaGestion(groupId, true);
                return;
            } else {
                // Para usuarios no admin, expandir la fila para ver los detalles
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
        }
        
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
    });

    renderGrupos();
});