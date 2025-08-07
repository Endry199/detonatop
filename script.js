import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/esm/index.js';

// Claves de Supabase
const supabaseUrl = 'https://nihwpbxkwrndxubpqkes.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5paHdwYnhrd3JuZHh1YnBxa2VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1Njc3MDgsImV4cCI6MjA3MDE0MzcwOH0.MTl0cNJFxkevLJWOUCsSgNyFHSTf9rZ7yop-OQlSNpg';
const supabase = createClient(supabaseUrl, supabaseKey);

// Elementos del DOM
const gruposSection = document.getElementById('grupos-table-section');
const gruposTableBody = document.getElementById('grupos-table-body');
const manageGroupSection = document.getElementById('manage-group-section');
const manageGroupTitle = document.getElementById('manage-group-title');
const escuadrasList = document.getElementById('escuadras-list');
const miembrosTableBody = document.getElementById('miembros-table-body');
const updateMemberForm = document.getElementById('update-member-form');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const memberIdInput = document.getElementById('member-id');
const memberNameInput = document.getElementById('member-name');
const memberPointsInput = document.getElementById('member-points');

let currentGroupId = null;
let currentRole = null;

document.addEventListener('DOMContentLoaded', () => {

    // --- Funciones de Renderizado ---

    async function renderGrupos() {
        const { data: grupos, error } = await supabase
            .from('grupos')
            .select('*')
            .order('puntos_totales', { ascending: false });

        if (error) {
            console.error('Error al obtener los grupos:', error);
            return;
        }

        gruposTableBody.innerHTML = '';
        grupos.forEach(grupo => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${grupo.nombre}</td>
                <td>${grupo.puntos_totales || 0}</td>
            `;
            gruposTableBody.appendChild(row);
        });
    }

    async function renderGrupoParaGestion(idGrupo, puedeEditar) {
        gruposSection.style.display = 'none';
        manageGroupSection.style.display = 'block';

        const { data: grupo, error: grupoError } = await supabase
            .from('grupos')
            .select('*')
            .eq('id', idGrupo)
            .single();
        
        if (grupoError) {
            console.error('Error al obtener el grupo:', grupoError);
            return;
        }
        
        manageGroupTitle.textContent = `${grupo.nombre} | Puntos Totales: ${grupo.puntos_totales || 0}`;

        const { data: escuadras, error: escuadrasError } = await supabase
            .from('escuadras')
            .select('*')
            .eq('id_grupo', idGrupo);

        if (escuadrasError) {
            console.error('Error al obtener las escuadras:', escuadrasError);
            return;
        }

        escuadrasList.innerHTML = '';
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
            escuadrasList.appendChild(escuadraDiv);

            // Cargar los miembros para cada escuadra
            renderMiembrosEnEscuadra(escuadra.id, `miembros-table-body-${escuadra.id}`, puedeEditar);
        });
    }
    
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
        miembrosBody.innerHTML = '';
        miembros.forEach(miembro => {
            const row = document.createElement('tr');
            let actionsCell = '';
            if (puedeEditar) {
                actionsCell = `
                    <td class="actions-cell">
                        <button class="edit-btn" data-id="${miembro.id}" data-name="${miembro.nombre}" data-points="${miembro.puntos}">Editar</button>
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

    // --- Funciones de Autenticación y Lógica ---

    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            handleLogin(session);
        } else {
            handleLogout();
        }
    });

    async function handleLogin(session) {
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'block';
        
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

        const puedeEditar = (userProfile.rol === 'lider' || userProfile.rol === 'decano' || userProfile.rol === 'admin');
        currentGroupId = (userProfile.rol !== 'admin') ? userProfile.id_grupo : null;
        
        if (currentGroupId) {
             await renderGrupoParaGestion(currentGroupId, puedeEditar);
        } else if (currentRole === 'admin') {
            console.log('Admin logeado. Aquí puedes mostrar una vista para que elijas qué grupo gestionar.');
            // Implementa aquí la lógica para que el admin elija un grupo.
        }
    }

    function handleLogout() {
        loginBtn.style.display = 'block';
        logoutBtn.style.display = 'none';
        gruposSection.style.display = 'block';
        manageGroupSection.style.display = 'none';
        renderGrupos(); // Volver a la vista pública
    }

    // --- Event Listeners ---

    loginBtn.addEventListener('click', async () => {
        const email = prompt("Ingresa tu correo:");
        const password = prompt("Ingresa tu contraseña:");
        if (email && password) {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                alert("Error al iniciar sesión: verifica tu correo y contraseña.");
                console.error(error);
            }
        }
    });

    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
    });

    updateMemberForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const miembroId = memberIdInput.value;
        const puntos = parseInt(memberPointsInput.value);

        if (miembroId && !isNaN(puntos)) {
            const { error } = await supabase
                .from('miembros_del_clan')
                .update({ puntos: puntos })
                .eq('id', miembroId);

            if (error) {
                alert('Error al actualizar: Es posible que no tengas permiso o el ID no sea válido.');
                console.error(error);
            } else {
                alert('Puntos actualizados con éxito.');
                // Recargar la vista del grupo actual
                await renderGrupoParaGestion(currentGroupId, (currentRole === 'lider' || currentRole === 'decano' || currentRole === 'admin'));
            }
            updateMemberForm.reset();
            memberNameInput.value = '';
        }
    });

    // Delegación de eventos para los botones de editar
    manageGroupSection.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-btn')) {
            const memberId = e.target.dataset.id;
            const memberName = e.target.dataset.name;
            const memberPoints = e.target.dataset.points;
            
            memberIdInput.value = memberId;
            memberNameInput.value = memberName;
            memberPointsInput.value = memberPoints;
        }
    });

    // Iniciar la aplicación en modo público
    renderGrupos();
});
