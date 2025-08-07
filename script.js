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

// Función auxiliar para asegurar la estructura de escuadras y miembros
async function ensureGroupStructure(groupId) {
    // Definir la estructura por defecto y personalizada
    let targetSquads = 3;
    let memberCounts = [4, 4, 4]; // Por defecto

    const { data: grupos, error: gruposError } = await supabase
        .from('grupos')
        .select('id, nombre');

    if (gruposError) {
        console.error('Error al obtener la lista de grupos:', gruposError);
    } else {
        const manuelGroup = grupos.find(g => g.nombre.toLowerCase().includes('manuel'));
        const frenyedGroup = grupos.find(g => g.nombre.toLowerCase().includes('frenyed'));

        if (manuelGroup && groupId === manuelGroup.id) {
            targetSquads = 2;
            memberCounts = [4, 4];
        } else if (frenyedGroup && groupId === frenyedGroup.id) {
            targetSquads = 3;
            memberCounts = [4, 4, 3];
        }
    }

    // Obtener escuadras existentes
    const { data: existingSquads, error: escuadrasError } = await supabase
        .from('escuadras')
        .select(`id, nombre`)
        .eq('id_grupo', groupId)
        .order('puntos_totales', { ascending: false }); // <-- Modificado

    if (escuadrasError) {
        console.error('Error al obtener escuadras para asegurar la estructura:', escuadrasError);
        return [];
    }

    // 1. Eliminar escuadras sobrantes
    if (existingSquads.length > targetSquads) {
        const squadsToDelete = existingSquads.slice(targetSquads).map(s => s.id);
        if (squadsToDelete.length > 0) {
            await supabase
                .from('escuadras')
                .delete()
                .in('id', squadsToDelete);
        }
    }
    
    // 2. Crear escuadras si faltan
    const missingSquadsCount = targetSquads - existingSquads.length;
    if (missingSquadsCount > 0) {
        const newSquadsToInsert = [];
        for (let i = 0; i < missingSquadsCount; i++) {
            newSquadsToInsert.push({ 
                nombre: `Escuadra ${existingSquads.length + 1 + i}`,
                id_grupo: groupId,
                puntos_totales: 0,
                puntos_semanales: 0
            });
        }
        await supabase
            .from('escuadras')
            .insert(newSquadsToInsert)
            .select();
    }

    // Obtener escuadras y miembros finales
    const { data: finalEscuadras, error: finalError } = await supabase
        .from('escuadras')
        .select(`
            id, nombre, puntos_totales, puntos_semanales,
            miembros_del_clan (
                id, nombre, puntos
            )
        `)
        .eq('id_grupo', groupId)
        .order('puntos_totales', { ascending: false }); // <-- Modificado

    if (finalError) {
        console.error('Error al obtener la estructura final:', finalError);
        return [];
    }

    // 3. Ajustar el número de miembros en cada escuadra
    for (let i = 0; i < finalEscuadras.length; i++) {
        const escuadra = finalEscuadras[i];
        const miembros = escuadra.miembros_del_clan;
        const targetMembers = memberCounts[i] || 4;
        const missingMembersCount = targetMembers - miembros.length;

        // Eliminar miembros sobrantes
        if (miembros.length > targetMembers) {
            const membersToDelete = miembros.slice(targetMembers).map(m => m.id);
            if (membersToDelete.length > 0) {
                await supabase
                    .from('miembros_del_clan')
                    .delete()
                    .in('id', membersToDelete);
            }
        }

        // Añadir miembros faltantes
        if (missingMembersCount > 0) {
            const newMembersToInsert = [];
            for (let j = 0; j < missingMembersCount; j++) {
                newMembersToInsert.push({
                    nombre: 'N/A',
                    puntos: 0,
                    id_escuadra: escuadra.id,
                    id_grupo: groupId
                });
            }
            await supabase
                .from('miembros_del_clan')
                .insert(newMembersToInsert);
        }
    }
    
    // Volver a obtener la estructura para asegurar los datos correctos
    const { data: finalFinalEscuadras, error: finalFinalError } = await supabase
        .from('escuadras')
        .select(`
            id, nombre, puntos_totales, puntos_semanales,
            miembros_del_clan (
                id, nombre, puntos
            )
        `)
        .eq('id_grupo', groupId)
        .order('puntos_totales', { ascending: false }); // <-- Modificado
    
    if(finalFinalError) {
        console.error('Error al obtener la estructura final:', finalFinalError);
        return [];
    }
    
    // 4. Calcular y actualizar puntos de escuadras y grupo
    let grupoPuntosTotales = 0;
    for (const escuadra of finalFinalEscuadras) {
        let escuadraPuntosTotales = 0;
        escuadra.miembros_del_clan.forEach(miembro => {
            escuadraPuntosTotales += miembro.puntos;
        });

        if (escuadraPuntosTotales !== escuadra.puntos_totales) {
            await supabase
                .from('escuadras')
                .update({ puntos_totales: escuadraPuntosTotales })
                .eq('id', escuadra.id);
            escuadra.puntos_totales = escuadraPuntosTotales;
        }
        grupoPuntosTotales += escuadraPuntosTotales;
    }

    await supabase
        .from('grupos')
        .update({ puntos_totales: grupoPuntosTotales })
        .eq('id', groupId);

    finalFinalEscuadras.forEach(escuadra => {
        escuadra.miembros_del_clan.sort((a, b) => b.puntos - a.puntos);
    });

    return finalFinalEscuadras;
}

// Función para renderizar escuadras y miembros en la vista expandida
async function renderEscuadrasEnGrupo(groupId, containerElement, puedeEditar) {
    const escuadras = await ensureGroupStructure(groupId);
    
    const { data: grupo, error } = await supabase
        .from('grupos')
        .select('*')
        .eq('id', groupId)
        .single();
    if (error) {
        console.error('Error al obtener el grupo:', error);
        return;
    }
    
    const groupRow = gruposTableBody.querySelector(`.group-row[data-group-id="${groupId}"]`);
    if (groupRow) {
        groupRow.querySelector('td:last-child').textContent = grupo.puntos_totales || 0;
    }

    if (escuadras.length === 0) {
        containerElement.innerHTML = `<div class="escuadras-container"><p>No hay escuadras en este grupo.</p></div>`;
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
    containerElement.innerHTML = `<div class="escuadras-container">${escuadrasHtml}</div>`;
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
            
            return;
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
                const expandedRow = row.closest('.expanded-content');
                const groupId = expandedRow.dataset.groupId;
                const container = expandedRow.querySelector('td');
                const puedeEditar = (currentRole === 'admin') || (['lider', 'decano'].includes(currentRole) && currentGroupId == groupId);
                await renderGrupos();
                await renderEscuadrasEnGrupo(groupId, container, puedeEditar);
            }
        }
    });

    renderGrupos();
});