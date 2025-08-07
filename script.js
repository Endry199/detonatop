// Claves de proyecto de Supabase
const supabaseUrl = 'https://nihwpbxkwrndxubpqkes.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5paHdwYnhrd3JuZHh1YnBxa2VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1Njc3MDgsImV4cCI6MjA3MDE0MzcwOH0.MTl0cNJFxkevLJWOUCsSgNyFHSTf9rZ7yop-OQlSNpg';

const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Elementos del DOM
const gruposTableBody = document.getElementById('grupos-table-body');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');

let currentRole = null;
let currentGroupId = null;

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
async function renderGrupos() {
    if (!gruposTableBody) return;

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

// Función para renderizar escuadras y miembros en la vista expandida
async function renderEscuadrasEnGrupo(groupId, containerElement, puedeEditar) {
    // Aseguramos que el grupo tenga la estructura completa antes de renderizar
    const escuadras = await ensureGroupStructure(groupId);

    if (escuadras.length === 0) {
        containerElement.innerHTML = `<td colspan="2">No hay escuadras en este grupo.</td>`;
        return;
    }

    let escuadrasHtml = '';
    for (const escuadra of escuadras) {
        const miembros = escuadra.miembros_del_clan;

        const miembrosHtml = miembros.map(miembro => `
            <tr data-miembro-id="${miembro.id}">
                <td><span class="miembro-nombre">${miembro.nombre}</span></td>
                <td><span class="miembro-puntos">${miembro.puntos}</span></td>
                ${puedeEditar ? `
                    <td>
                        <button class="edit-btn" data-id="${miembro.id}">Editar</button>
                    </td>
                ` : ''}
            </tr>
        `).join('');

        escuadrasHtml += `
            <div class="escuadra-detail">
                <h4>${escuadra.nombre} (Puntos: ${escuadra.puntos_totales})</h4>
                <div class="miembros-list">
                    <table>
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Puntos</th>
                                ${puedeEditar ? '<th>Acciones</th>' : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${miembrosHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    containerElement.innerHTML = `<td colspan="2"><div class="escuadras-container">${escuadrasHtml}</div></td>`;
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
        currentGroupId = userProfile.id_grupo;
        await renderGrupos();
    }

    function handleLogout() {
        if (loginBtn) loginBtn.style.display = 'block';
        if (logoutBtn) logoutBtn.style.display = 'none';
        currentRole = null;
        currentGroupId = null;
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
    
    document.addEventListener('click', async (e) => {
        const groupRow = e.target.closest('.group-row');
        if (groupRow) {
            const groupId = groupRow.dataset.groupId;
            const expandedRow = gruposTableBody.querySelector(`.expanded-content[data-group-id="${groupId}"]`);
            
            if (expandedRow) {
                expandedRow.classList.toggle('hidden');
                if (!expandedRow.classList.contains('hidden')) {
                    const expandedContentTd = expandedRow.querySelector('td');
                    
                    let puedeEditar = false;
                    if (currentRole === 'admin') {
                        puedeEditar = true;
                    } else if (['lider', 'decano'].includes(currentRole) && currentGroupId == groupId) {
                        puedeEditar = true;
                    }

                    await renderEscuadrasEnGrupo(groupId, expandedContentTd, puedeEditar);
                }
            }
            return;
        }
        
        if (e.target.classList.contains('edit-btn')) {
            const row = e.target.closest('tr');
            const miembroId = row.dataset.miembroId;
            const nombreSpan = row.querySelector('.miembro-nombre');
            const puntosSpan = row.querySelector('.miembro-puntos');

            const nombreInput = document.createElement('input');
            nombreInput.type = 'text';
            nombreInput.value = nombreSpan.textContent;
            nombreInput.className = 'edit-input';

            const puntosInput = document.createElement('input');
            puntosInput.type = 'number';
            puntosInput.value = puntosSpan.textContent;
            puntosInput.className = 'edit-input';

            nombreSpan.replaceWith(nombreInput);
            puntosSpan.replaceWith(puntosInput);

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
                const groupId = row.closest('.expanded-content').dataset.groupId;
                const container = row.closest('.expanded-content').querySelector('td');
                const puedeEditar = (currentRole === 'admin') || (['lider', 'decano'].includes(currentRole) && currentGroupId == groupId);
                await renderEscuadrasEnGrupo(groupId, container, puedeEditar);
            }
        }
    });

    renderGrupos();
});